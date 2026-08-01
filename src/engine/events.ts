import {
  EVENT_TABLE,
  eventBandFor,
  type EventBand,
  type EventEffect,
  type EventRow,
} from "../data/events.ts";
import type { OverworldTerrain } from "../data/hexTables.ts";
import { HIRELING_BY_NAME } from "../data/hirelings.ts";
import { produce, type Draft } from "immer";
import { ANIMAL_BY_NAME } from "../data/animals.ts";
import { SPELL_TABLE_BY_KEY, spellKey } from "./character.ts";
import { parseWeaponFormula, spawnMonsters } from "./combat.ts";
import {
  animalAttack,
  applyMonsterTurn,
  castCombatSpell,
  createCombatState,
  fightRound,
  hirelingAttack,
  applyConsumableEffect,
  payOutVictory,
  resolveDamageChoice,
  type FightLog,
} from "./fight.ts";
import { rollDie } from "./dice.ts";
import type { CombatState } from "./dungeonState.ts";
import type { RNG } from "./rng.ts";
import { MAX_TORCHES, type AdventurerResources } from "./town.ts";
import type { SpellTableKey } from "../data/types.ts";

/** "Events on Travel" (`docs/game-rules-reference.md` lines 908-926, issue #91) -- the last unbuilt
 * piece of Hexploring the World (#19). Deliberately its own engine module rather than part of
 * `hexReducer.ts`: an Event can touch `AdventurerResources` (provisions/HP/coins), `WorldState`
 * (Storm's relocation), *and* kill the character, so no single existing reducer owns it -- the same
 * reason Thug Life and Warfare resolve in `WorldScreen.tsx` off pure engine functions instead.
 *
 * Monster Events reuse `combat.ts`'s pure functions directly rather than `dungeonReducer.ts`'s
 * `CombatState`, exactly as `arena.ts` does and for the same reasons (no segment, no loot-per-
 * segment bookkeeping, no armor-absorption choice). The differences from Arena, both forced by the
 * table itself: an Event can field *several* monsters (4 Pirates, 2 Orcs, 1d6 Goblins), so this
 * needs a target choice and filters `resolveMonsterTurn()` to the living; and several rows are
 * Loot-tagged, so victory pays out through the same `rollLoot()` a dungeon fight uses.
 *
 * Same documented simplifications as Arena: no armor absorption (all damage hits `hp`), no
 * spellcasting mid-fight, no race/class attack bonuses, and no equipped-weapon `bonusEffect` --
 * just the base weapon formula. Ability coverage is complete for what the table actually contains
 * (Firebreath/Regeneration/Explosive/Loot); Horde/Necromancy/Sorcery/Deathtouch/Paralyze/Poison/
 * Stoneskin/Intangible/Weakness/Undead appear on no Event row, so they're not wired here, the same
 * call `arena.ts` documents for its own Champion table.
 */

/** The result of the 2d6 check made on entering a location-less hex. `dice` carries the two raw
 * values (not just their total) so the UI can animate the actual dice rolled, the same way every
 * other multi-die roll in this app does -- deriving a plausible pair from the total instead would
 * show the player dice they didn't roll. */
export type TravelEventRoll =
  /** An ability suppressed the roll outright -- no dice, no Event. */
  | { kind: "skipped"; reason: string }
  /** "If it's 7 or more, nothing happened." */
  | { kind: "none"; total: number; dice: [number, number] }
  | {
      kind: "event";
      total: number;
      dice: [number, number];
      terrain: OverworldTerrain;
      band: EventBand;
      row: EventRow;
    };

/** Patovsky (race, `races.ts`) and Elf Ranger (hireling) both simply never have Events. Checked
 * before any dice are rolled, so an Event is never even generated for them.
 *
 * Fly's own "...and activate Event" clause is *not* handled here -- `WorldScreen.tsx` skips calling
 * this function entirely on a Fly move, since Fly's skip is a property of that one move rather than
 * of the character (see `rollTravelEvent`'s call site and CLAUDE.md's Fly note for the reading). */
export function eventSkipReason(resources: AdventurerResources, raceName: string): string | null {
  if (raceName === "Patovsky") return "You slip through unnoticed, as your kind always do.";
  if (resources.hireling === "Elf Ranger") {
    return "Your Elf Ranger reads the land ahead and guides you clear of trouble.";
  }
  return null;
}

/** "Whenever you enter a hex that doesn't have a location, roll 2d6." The caller is responsible for
 * only invoking this on a location-less hex -- `HexTile.location === null` -- since this module has
 * no `WorldState` to check it against. Nothing is spent or applied here; resolution is deferred so
 * Camouflage/Star Stone can still intervene (see `ignoreEvent`/`rerollEvent`). */
export function rollTravelEvent(
  resources: AdventurerResources,
  raceName: string,
  terrain: OverworldTerrain,
  rng: RNG = Math.random,
): TravelEventRoll {
  const skip = eventSkipReason(resources, raceName);
  if (skip) return { kind: "skipped", reason: skip };

  const dice: [number, number] = [rollDie(rng), rollDie(rng)];
  const total = dice[0] + dice[1];
  const band = eventBandFor(total);
  if (band === null) return { kind: "none", total, dice };
  return { kind: "event", total, dice, terrain, band, row: EVENT_TABLE[terrain][band] };
}

const CAMOUFLAGE_KEY = spellKey("nature", 3);

/** Camouflage (Nature 3): "Can ignore an Event generated in a forest or swamp territory." One of
 * #61's deferred spells, deliberately kept off the shared `CAST_SPELL`/`KNOWN_CASTABLE_SPELL_NAMES`
 * pipeline for the same reason Fly is: that pipeline's "Cast" button also renders inside a dungeon,
 * where an Event can't exist. Instead it's offered only on the pending-Event panel itself, which is
 * also the only moment the choice is meaningful -- unlike every other spell, this one is cast
 * *in response to* a specific rolled outcome, not proactively. */
export function canIgnoreEvent(resources: AdventurerResources, terrain: OverworldTerrain): boolean {
  if (terrain !== "forest" && terrain !== "swamp") return false;
  return (resources.spellUses[CAMOUFLAGE_KEY] ?? 0) > 0;
}

export function ignoreEvent(
  resources: AdventurerResources,
  terrain: OverworldTerrain,
): AdventurerResources {
  if (!canIgnoreEvent(resources, terrain)) return resources;
  return {
    ...resources,
    spellUses: {
      ...resources.spellUses,
      [CAMOUFLAGE_KEY]: resources.spellUses[CAMOUFLAGE_KEY]! - 1,
    },
  };
}

/** Star Stone (Ziggurat Wonder, issue #30): "Spend 1 Provision to Reroll an Event." Held as a
 * `wonderItem` armor entry, so found by name the same way `hasElvenBoots()`/`hasFeatheredBoots()`
 * are. Unlike a `trapImmunity` item this is *not* one-shot -- the rulebook gives it no use limit,
 * and the provision is the cost that bounds it. */
export function hasStarStone(resources: AdventurerResources): boolean {
  return resources.armor.some((p) => p.itemName?.toLowerCase().includes("star stone"));
}

export function canRerollEvent(resources: AdventurerResources): boolean {
  return hasStarStone(resources) && resources.provisions >= 1;
}

export interface EventRerollResult {
  resources: AdventurerResources;
  roll: TravelEventRoll;
}

/** Spends the provision first, then rerolls -- "pay then roll," the same shape Gamble/Thug Life/
 * `trainAnimal()` already use, so a reroll into another Event still costs the provision. The
 * reroll deliberately goes back through `rollTravelEvent`, so a 7+ result ("nothing happened") is a
 * legitimate and desirable outcome of using the Star Stone. */
export function rerollEvent(
  resources: AdventurerResources,
  raceName: string,
  terrain: OverworldTerrain,
  rng: RNG = Math.random,
): EventRerollResult {
  if (!canRerollEvent(resources))
    return { resources, roll: { kind: "none", total: 7, dice: [3, 4] } };
  const spent = { ...resources, provisions: resources.provisions - 1 };
  return { resources: spent, roll: rollTravelEvent(spent, raceName, terrain, rng) };
}

export interface EventEffectResult {
  resources: AdventurerResources;
  /** Glacier's Cracked Ice -- the caller writes the Graveyard entry and clears the session. */
  died: boolean;
  /** Storm -- the caller relocates the player, since only it holds `WorldState`. */
  relocate: boolean;
  message: string;
}

/** Applies a non-combat Event outcome. HP loss is floored at 1, matching every other non-dungeon HP
 * cost in this codebase (Hard Work's `maxHp` drain, the Forgotten Gods' lightning): only an
 * explicitly fatal outcome -- here just Cracked Ice -- ever actually kills. Provision loss likewise
 * floors at 0 rather than converting a shortfall into HP damage the way `payTravelCost()` does;
 * the rulebook describes these as losing provisions you have, not a debt. */
export function applyEventEffect(
  resources: AdventurerResources,
  effect: EventEffect,
): EventEffectResult {
  switch (effect.kind) {
    case "loseProvisions": {
      const lost = Math.min(effect.amount, resources.provisions);
      return {
        resources: { ...resources, provisions: resources.provisions - lost },
        died: false,
        relocate: false,
        message:
          lost > 0
            ? `You lose ${lost} provision${lost === 1 ? "" : "s"}.`
            : "You had no provisions left to lose.",
      };
    }
    case "loseHp": {
      const lost = Math.min(effect.amount, Math.max(0, resources.hp - 1));
      return {
        resources: { ...resources, hp: resources.hp - lost },
        died: false,
        relocate: false,
        message: lost > 0 ? `You lose ${lost} HP.` : "Battered, but you keep your feet.",
      };
    }
    case "moveToRandomHex":
      return {
        resources,
        died: false,
        relocate: true,
        message: "You come to on unfamiliar ground.",
      };
    case "instantDeath":
      // Never actually surfaced -- the caller hands straight off to the death handler.
      return { resources, died: true, relocate: false, message: "" };
  }
}

// --- Monster Events ------------------------------------------------------------------------------
//
// Issue #120: these used to run on a small parallel implementation that took only `hp` and
// `weaponFormula`, so a wilderness fight silently disabled armor, spells, attack bonuses, the
// Hireling, animals and potions. That was inherited from `arena.ts`, where it was defensible -- you
// choose to enter the Arena. An Event fires unbidden and offered only a Fight button, so a player
// was forced into a fight without the character they had built, and lost one to a Wyvern.
//
// Now they run on the same `CombatState` and the same `fight.ts` core the dungeon uses. The only
// thing an Event fight still lacks is a segment to leave remains in, which is why death is reported
// back rather than handled here.

/** `AdventurerResources` carries everything a fight needs except the character's race and class,
 * which live on `CreatedCharacter`. They're threaded in for the duration of the fight and dropped on
 * the way out, rather than duplicated into the persisted blob -- `DungeonState` copies them because
 * a run outlives the screen that created it; a single Event doesn't. */
export interface FighterIdentity {
  raceName: string;
  className: string;
}

type WildFighter = AdventurerResources & FighterIdentity;

/** A wilderness fight in progress. Both fields move together, so every action returns both. */
export interface WildFight {
  resources: AdventurerResources;
  combat: CombatState;
  /** Newest-first transcript for the panel, the same order `DungeonState.log` uses. */
  log: string[];
  /** The caller writes the Graveyard entry -- out here there's no `alive` flag to set. */
  died: boolean;
}

/** Builds the fight, including the Hireling's own copy at its persisted HP (issue #114). */
export function startEventCombat(
  row: EventRow,
  resources: AdventurerResources,
  rng: RNG = Math.random,
): CombatState | null {
  if (!row.monsters) return null;
  let nextId = 1;
  const def = resources.hireling ? HIRELING_BY_NAME[resources.hireling] : undefined;
  return createCombatState({
    monsters: spawnMonsters(row.monsters, () => nextId++, rng),
    hireling: def
      ? {
          name: def.name,
          hp: Math.min(resources.hirelingHp ?? def.hp, def.hp),
          maxHp: def.hp,
        }
      : null,
  });
}

/** Runs `mutate` against a draft of both halves, collecting anything it logs. The one place Immer is
 * used outside the dungeon reducer -- `fight.ts` mutates drafts, and rebuilding these by hand at
 * every call site would be far more error-prone than borrowing `produce` for them. */
function inFight(
  resources: AdventurerResources,
  who: FighterIdentity,
  combat: CombatState,
  mutate: (fighter: Draft<WildFighter>, combat: Draft<CombatState>, log: FightLog) => boolean,
): WildFight {
  const log: string[] = [];
  let died = false;
  const [fought, nextCombat] = produce(
    [{ ...resources, ...who }, combat] as [WildFighter, CombatState],
    ([draftFighter, draftCombat]) => {
      died = mutate(draftFighter, draftCombat, (message) => log.unshift(message));
    },
  );
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { raceName, className, ...nextResources } = fought;
  return { resources: nextResources, combat: nextCombat, log, died };
}

/** One full round. `rawRoll` is the weapon die the *caller* rolled, not one rolled here -- the same
 * split `dungeonReducer.ts`'s `PLAYER_ATTACK` uses, so the die the player watches land is the one
 * that resolved. */
export function eventFightRound(
  resources: AdventurerResources,
  who: FighterIdentity,
  combat: CombatState,
  targetId: number,
  rawRoll: number,
  weaponFormula: string,
  rng: RNG = Math.random,
  opts: { isHorn?: boolean } = {},
): WildFight {
  return inFight(resources, who, combat, (fighter, draftCombat, log) => {
    const result = fightRound(
      fighter,
      draftCombat,
      targetId,
      rawRoll,
      weaponFormula,
      rng,
      log,
      opts,
    );
    return result.died;
  });
}

/** Resolves the armor-or-HP-or-Hireling choice a monster round can leave pending. Wilderness fights
 * now get this at all -- before, all damage went straight to HP. */
export function eventResolveDamage(
  resources: AdventurerResources,
  who: FighterIdentity,
  combat: CombatState,
  absorbWith: "hp" | "hireling" | number,
  rng: RNG = Math.random,
): WildFight {
  return inFight(resources, who, combat, (fighter, draftCombat, log) => {
    const result = resolveDamageChoice(fighter, draftCombat, absorbWith, rng, log);
    if (result.armorDestroyed) fighter.milestones.hasHadArmorDestroyed = true;
    return result.died;
  });
}

/** The Hireling's free once-per-round swing. */
export function eventHirelingAttack(
  resources: AdventurerResources,
  who: FighterIdentity,
  combat: CombatState,
  targetId: number,
  roll: number,
  rng: RNG = Math.random,
): WildFight {
  const def = combat.hireling ? HIRELING_BY_NAME[combat.hireling.name] : undefined;
  const modifier = def?.weaponFormula ? parseWeaponFormula(def.weaponFormula).modifier : 0;
  return inFight(resources, who, combat, (fighter, draftCombat, log) => {
    hirelingAttack(fighter, draftCombat, targetId, roll, modifier, rng, log);
    return false;
  });
}

/** Snake's free bite (issue #26/#67). */
export function eventAnimalAttack(
  resources: AdventurerResources,
  who: FighterIdentity,
  combat: CombatState,
  targetId: number,
  rng: RNG = Math.random,
): WildFight {
  const damage = ANIMAL_BY_NAME["Snake"]?.damage ?? 1;
  return inFight(resources, who, combat, (fighter, draftCombat, log) => {
    animalAttack(fighter, draftCombat, targetId, damage, rng, log);
    return false;
  });
}

/** Casting mid-fight out in the world (issue #120). Teleport is deliberately absent: its dungeon
 * form needs a destination room, and out here fleeing is the equivalent escape -- which now exists.
 * Everything else runs the same `castCombatSpell()` the dungeon does. */
export function eventCastSpell(
  resources: AdventurerResources,
  who: FighterIdentity,
  combat: CombatState,
  table: SpellTableKey,
  spellRoll: number,
  targetId: number | undefined,
  rng: RNG = Math.random,
): WildFight {
  const spell = SPELL_TABLE_BY_KEY[table]?.[spellRoll];
  const key = spellKey(table, spellRoll);
  if (!spell || (resources.spellUses[key] ?? 0) <= 0) {
    return { resources, combat, log: [], died: false };
  }
  return inFight(resources, who, combat, (fighter, draftCombat, log) => {
    fighter.spellUses[key] = (fighter.spellUses[key] ?? 0) - 1;
    fighter.milestones.hasCastSpell = true; // Scholar (issue #70)
    if (spell.name === "Cold Ray") fighter.milestones.hasCastColdRay = true; // Necromancer
    if (draftCombat.paralyzedTurns > 0) {
      draftCombat.paralyzedTurns -= 1;
      log("You are paralyzed and cannot cast a spell this turn.");
    } else if (
      !castCombatSpell(fighter, draftCombat, spell.name, targetId, rng, log, MAX_TORCHES)
    ) {
      return false; // nothing this app implements -- no round spent
    }
    // Casting consumes the round, exactly as it does in a dungeon.
    if (draftCombat.monsters.length === 0) {
      payOutVictory(fighter, draftCombat, rng, log);
      draftCombat.outcome = "victory";
      return false;
    }
    const turn = applyMonsterTurn(fighter, draftCombat, rng, log);
    if (turn.died) draftCombat.outcome = "defeat";
    return turn.died;
  });
}

/** Drinking a held potion mid-fight (issue #110), out in the world. Consumes the round like a spell. */
export function eventUseConsumable(
  resources: AdventurerResources,
  who: FighterIdentity,
  combat: CombatState,
  index: number,
  rng: RNG = Math.random,
): WildFight {
  if (!resources.consumables[index]) return { resources, combat, log: [], died: false };
  return inFight(resources, who, combat, (fighter, draftCombat, log) => {
    const item = fighter.consumables[index]!;
    fighter.consumables.splice(index, 1);
    applyConsumableEffect(fighter, draftCombat, item, rng, log, MAX_TORCHES);
    if (draftCombat.monsters.length === 0) {
      payOutVictory(fighter, draftCombat, rng, log);
      draftCombat.outcome = "victory";
      return false;
    }
    const turn = applyMonsterTurn(fighter, draftCombat, rng, log);
    if (turn.died) draftCombat.outcome = "defeat";
    return turn.died;
  });
}

/** "You can always run" (issue #120). The rulebook says nothing about fleeing a travel encounter, so
 * this is a deliberate addition rather than a transcription -- and the reason it's justified is that
 * the encounter itself is *mandatory*: an Event fires unbidden and, before this, offered exactly one
 * button. A fight you cannot avoid and cannot leave isn't a decision.
 *
 * Priced at one provision, matching every other "spend to get out of trouble" cost on the World map
 * (the Star Stone's reroll, Dense Fog's wait). Free when you have none, so it can never be the
 * provisions that trap you -- running away is always available, it just isn't always free. */
export const FLEE_PROVISION_COST = 1;

export function fleeEvent(resources: AdventurerResources): {
  resources: AdventurerResources;
  message: string;
} {
  const spent = Math.min(FLEE_PROVISION_COST, resources.provisions);
  return {
    resources: { ...resources, provisions: resources.provisions - spent },
    message:
      spent > 0
        ? "You break away and put distance between you and it, at the cost of a provision."
        : "You break away and run, scattering what little you were carrying.",
  };
}

/** Exported for the panel's Camouflage row, so the UI names the spell from its own data rather than
 * hardcoding the string a second time. */
export function camouflageSpellName(): string {
  return SPELL_TABLE_BY_KEY.nature![3]!.name;
}

/** Elf Ranger's ability text, resolved from its own data for the same reason. */
export function elfRangerAbilityText(): string | undefined {
  return HIRELING_BY_NAME["Elf Ranger"]?.abilityText;
}
