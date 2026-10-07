/**
 * Trap effects and resolving a trap roll's outcome.
 *
 * Split out of `dungeonReducer.ts` (issue #144), which still owns every action -- these are the
 * helpers its cases share. Behavior is unchanged; only where the code lives moved.
 */
import type { Draft } from "immer";
import { ARMOR_PIECE_LABELS, DUNGEON_TABLES, type TrapEntry } from "../../data/dungeonTables.ts";
import { rollDie } from "../dice.ts";
import { trySurviveDeath } from "../fight.ts";
import type { DungeonState } from "../dungeonState.ts";
import { benchUnusableWeapon } from "../hands.ts";
import type { RNG } from "../rng.ts";
import { pushLog, leaveRemains, dungeonLog, spendTorches } from "./core.ts";
import { startCombat } from "./combat.ts";

/**
 * Applies a trap's mechanical effect beyond its already-handled `torchCost` (each of this
 * function's three call sites -- RESOLVE_DOOR_LOCK, ROLL_SECRET_PASSAGE, ROLL_CHEST -- spends
 * that separately, since it existed before this and its message/segId plumbing already differs
 * slightly per site). Handles the three remaining shapes a trap can take: flat `damage`, the
 * Blade Trap's roll-based instant death, or an ambush of `monsters` spawned into combat exactly
 * like an ordinary room encounter (always `wasNoisy: true` -- the player was just caught by a
 * surprise trap, same "the noise gave you away" framing `startCombat` already logs). A no-op for
 * CLICK_NOTHING/DITCH_TRAP, which have none of these fields.
 *
 * Trap deaths reuse `deathCause: "combat"` rather than a distinct third cause -- both Graveyard
 * and DungeonScreen's death messaging only ever branch on "darkness" vs. everything else, and
 * "not the Darkness" is the only distinction that actually matters there today.
 */
export function applyTrapEffect(
  draft: Draft<DungeonState>,
  trap: TrapEntry,
  segId: number,
  rng: RNG,
  /** Issue #112: the blade trap's kill die, rolled by the UI so it can be *shown*. A 1-in-6 that
   * ends the run was previously rolled silently here, so the death read as arbitrary rather than as
   * a roll that was lost. Falls back to rolling internally for any caller that doesn't animate. */
  bladeRoll?: number | null,
): void {
  if (!draft.alive) return; // a torchCost Darkness death already ended the run this same dispatch

  if (trap.bladeTrap) {
    // Resolved once, not per-branch: the roll of 1 and the roll of 2 are two outcomes of the *same*
    // die, so re-reading `bladeRoll ?? rollDie(rng)` would roll a second one for any caller that
    // doesn't animate (tests, and anything else that leaves `bladeRoll` undefined).
    const blade = bladeRoll ?? rollDie(rng);
    if (blade === 1) {
      draft.hp = 0;
      if (trySurviveDeath(draft, rng, dungeonLog(draft))) return;
      draft.alive = false;
      draft.deathCause = "combat";
      pushLog(draft, "The blade finds its mark. The dungeon keeps what it took.", "descend");
      leaveRemains(draft, segId);
    }
    // A roll of 2 costs an arm -- real as of issue #100, having been flavor-only for exactly as
    // long as there was no hand economy to enforce it against. "Losing an arm has the same effect"
    // as holding the torch, and it's permanent: no light source gives the arm back, so this is an
    // absolute veto on two-handed weapons for the rest of the character's life.
    if (blade === 2 && !draft.armLost) {
      draft.armLost = true;
      pushLog(draft, "The blade takes your arm. You will fight one-handed from now on.", "descend");
      const benched = benchUnusableWeapon(draft);
      if (benched) {
        pushLog(draft, `You can no longer wield the ${benched} -- it goes into your pack.`);
      }
    }
    return;
  }

  if (trap.damage) {
    draft.hp = Math.max(0, draft.hp - trap.damage);
    pushLog(draft, `The trap deals ${trap.damage} damage.`);
    if (draft.hp <= 0) {
      if (trySurviveDeath(draft, rng, dungeonLog(draft))) return;
      draft.alive = false;
      draft.deathCause = "combat";
      pushLog(draft, "The trap finishes you. The dungeon keeps what it took.", "descend");
      leaveRemains(draft, segId);
    }
    return;
  }

  if (trap.destroysArmor) {
    const usable = draft.armor.filter((piece) => piece.maxHp > 0);
    if (usable.length > 0) {
      const piece = usable[(rollDie(rng) - 1) % usable.length]!;
      piece.hp = 0;
      draft.milestones.hasHadArmorDestroyed = true; // Blacksmith (issue #70)
      pushLog(draft, `Acid destroys your ${ARMOR_PIECE_LABELS[piece.piece]}!`);
    } else {
      pushLog(draft, "Acid squirts from the ceiling, but you have no armor to destroy.");
    }
    return;
  }

  if (trap.rollsMonsterTable) {
    const sum = rollDie(rng) + rollDie(rng);
    const monsters = draft.dungeonTypeKey
      ? DUNGEON_TABLES[draft.dungeonTypeKey].monsters[sum]
      : null;
    if (monsters) {
      startCombat(draft, segId, monsters, true, rng);
    } else {
      pushLog(draft, "A passage opens, but nothing emerges.");
    }
    return;
  }

  if (trap.monsters) {
    startCombat(draft, segId, trap.monsters, true, rng);
  }
}

/**
 * Resolves everything a fired trap does: a trapImmunity item (Potion of Luck, Cultist's
 * [Armor]) blocks the whole trap -- torchCost included -- and is consumed, matching the
 * rulebook's "ignores the next activated trap" / "discard to ignore a trap" phrasing (a one-shot
 * use, not a standing immunity like `ignoresMonsterAbility`). Every `trapImmunity` grant in
 * `dungeonTables.ts` is a Wonder or `grants: "armor"` Magic Item, so only `draft.armor` needs
 * checking, never the weapon. Otherwise applies `torchCost` (if any) then `applyTrapEffect()`.
 */
export function resolveTrapOutcome(
  draft: Draft<DungeonState>,
  trap: TrapEntry,
  segId: number,
  rng: RNG,
  /** Issue #112 -- threaded to `applyTrapEffect` so the blade trap's kill die can be animated. */
  bladeRoll?: number | null,
): void {
  const immunityIndex = draft.armor.findIndex((piece) => piece.effect?.kind === "trapImmunity");
  if (immunityIndex !== -1) {
    const item = draft.armor[immunityIndex]!;
    draft.armor.splice(immunityIndex, 1);
    pushLog(
      draft,
      `Your ${item.itemName ?? "trinket"} shields you from the trap and crumbles to dust.`,
    );
    return;
  }
  if (trap.torchCostDice) {
    let rolled = 0;
    for (let i = 0; i < trap.torchCostDice.dice; i++) rolled += rollDie(rng);
    spendTorches(
      draft,
      rolled,
      `Spent ${rolled} torch${rolled > 1 ? "es" : ""} climbing out of the cage.`,
      segId,
      rng,
    );
    return;
  }
  if (trap.torchCost) {
    spendTorches(
      draft,
      trap.torchCost,
      `Spent ${trap.torchCost} torch${trap.torchCost > 1 ? "es" : ""} climbing out.`,
      segId,
      rng,
    );
  }
  applyTrapEffect(draft, trap, segId, rng, bladeRoll);
}
