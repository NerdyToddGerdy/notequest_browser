import { produce, type Draft } from "immer";
import {
  DUNGEON_NAME_SECOND,
  DUNGEON_NAME_THIRD,
  DUNGEON_TYPES,
  OPEN_DOOR_TABLE,
  SECRET_PASSAGE_TABLE,
  TYPE_LABELS,
  type SegmentType,
} from "../data/dungeonTypes.ts";
import {
  ARMOR_PIECE_LABELS,
  ARMOR_TABLE,
  DUNGEON_TABLES,
  type ArmorPieceKind,
  type ItemEffect,
  type MagicItemEntry,
  type MonsterAbility,
  type MonsterTemplate,
  type RoomContentReward,
  type TrapEntry,
  type WonderEntry,
} from "../data/dungeonTables.ts";
import { SPELL_TABLE } from "../data/spells.ts";
import { buildingTaxTotal } from "../data/buildings.ts";
import { SPELL_TABLE_BY_KEY, spellKey } from "./character.ts";
import {
  boxFromCenter,
  buildConnector,
  classifyDoorOpen,
  assignDirections,
  isTeleportDestination,
  placeChild,
  reachableSegIds,
  resolveBoss,
  resolveRoomExtras,
  rollSegment,
  sizeFor,
} from "./dungeon.ts";
import { rollDie } from "./dice.ts";
import {
  checkUndeadRevival,
  COMBAT_ONLY_SPELL_NAMES,
  HEAL_AMOUNT,
  HORDE_ORC,
  KNOWN_CASTABLE_SPELL_NAMES,
  NECROMANCY_SKELETON,
  parseWeaponFormula,
  resolveMonsterCount,
  resolvePlayerAttack,
  resolveSpellDamage,
  rollLoot,
  spawnMonsters,
  TARGETED_SPELL_NAMES,
} from "./combat.ts";
import {
  createInitialDungeonState,
  makeLevel,
  type ArmorPiece,
  type CombatMonsterState,
  type CombatState,
  type Direction,
  type DungeonAction,
  type DungeonState,
  type DungeonStats,
  type HeldItem,
  type LevelState,
  type SegmentState,
} from "./dungeonState.ts";
import { createInitialMilestones, MAX_HELD_ITEMS } from "./town.ts";
import type { RNG } from "./rng.ts";

function bumpStatsForNewSegment(
  stats: Draft<DungeonStats>,
  type: SegmentType,
  doors: number,
): void {
  stats.segments += 1;
  if (type === "corridor") stats.corridors += 1;
  else if (type === "staircase") stats.staircases += 1;
  else if (type !== "final") stats.rooms += 1;
  stats.doorsRemaining += doors;
}

function pushLog(
  draft: Draft<DungeonState>,
  message: string,
  variant: "normal" | "descend" = "normal",
): void {
  draft.log.unshift({ id: draft.nextLogId, message, variant });
  draft.nextLogId += 1;
}

const DARKNESS_MESSAGE = "The darkness devours you. Without a torch, there is no way forward.";

/**
 * "If you lose all HP, your character is dead and all your equipment will be on the floor of
 * that room to be recovered by your next character" -- and per the Darkness section, the same
 * applies there too. Drops the dying character's coins/Treasures/Keys/held items into `segId`
 * (falling back to the entrance if that segment can't be found), merging with any remains
 * already there.
 */
function leaveRemains(draft: Draft<DungeonState>, segId: number | null): void {
  if (
    draft.coins === 0 &&
    draft.treasures === 0 &&
    draft.keys === 0 &&
    draft.heldItems.length === 0 &&
    draft.armor.length === 0 &&
    draft.spareArmor.length === 0 &&
    !draft.weapon &&
    draft.spareWeapons.length === 0
  ) {
    return;
  }
  const level = draft.levels[draft.activeLevel];
  const seg =
    level?.segments.find((s) => s.id === segId) ?? level?.segments.find((s) => s.isEntrance);
  if (!seg) return;
  if (seg.remains) {
    seg.remains.names.push(draft.characterName);
    seg.remains.coins += draft.coins;
    seg.remains.treasures += draft.treasures;
    seg.remains.keys += draft.keys;
    seg.remains.heldItems.push(...draft.heldItems);
    seg.remains.armor.push(...draft.armor);
    seg.remains.spareArmor.push(...draft.spareArmor);
    if (!seg.remains.weapon) seg.remains.weapon = draft.weapon;
    seg.remains.weapons.push(...draft.spareWeapons);
  } else {
    seg.remains = {
      names: [draft.characterName],
      coins: draft.coins,
      treasures: draft.treasures,
      keys: draft.keys,
      heldItems: [...draft.heldItems],
      armor: [...draft.armor],
      spareArmor: [...draft.spareArmor],
      weapon: draft.weapon,
      weapons: [...draft.spareWeapons],
    };
  }
}

/** Samambro (New Races, issue #60): "When you die, roll a die. If it's 3 or more, you come back to
 * life with 1 HP." Checked at every one of the 7 places `alive` would otherwise flip to false
 * (Darkness, both trap-death branches, Deathtouch, the normal counter-attack, Explosive
 * self-destruct, and the deferred-armor-choice branch) -- returns true (having already set `hp` to
 * 1 and logged the survival) if the character lives after all, so each call site can `return`
 * before its own death bookkeeping (deathCause/leaveRemains/combat-clearing) ever runs. Only rolls
 * for an actual Samambro -- no "wasted roll" for every other race, since nothing else in this
 * codebase's race/class checks bothers with that either. */
function trySamambroSurvival(draft: Draft<DungeonState>, rng: RNG): boolean {
  if (draft.raceName !== "Samambro") return false;
  if (rollDie(rng) < 3) return false;
  draft.hp = 1;
  pushLog(draft, "Samambro's resilience pulls you back from the brink -- you survive with 1 HP!");
  return true;
}

/** Spends `cost` torches, logging `message`; if there aren't enough, the Darkness kills the character instead. */
function spendTorches(
  draft: Draft<DungeonState>,
  cost: number,
  message: string,
  segId: number | null = null,
  rng: RNG = Math.random,
): boolean {
  if (draft.torches < cost) {
    if (draft.className === "Miner") {
      // "If you run out of torches, you can leave the dungeon" -- the Darkness spares a Miner
      // outright rather than killing them; the action they were attempting still fails (they're
      // still out of torches), but they're free to use the existing Retreat to Town button.
      pushLog(
        draft,
        "You're out of torches, but a lifetime underground taught you the way out. Retreat to Town before the Darkness finds you.",
      );
      return false;
    }
    if (trySamambroSurvival(draft, rng)) return false; // still out of torches, but alive
    draft.alive = false;
    pushLog(draft, DARKNESS_MESSAGE, "descend");
    leaveRemains(draft, segId);
    return false;
  }
  draft.torches -= cost;
  pushLog(draft, message);
  return true;
}

/** Builds a new segment (with Room Content/Monsters resolved if it's a room type) and reserves its id. */
function buildSegment(
  draft: Draft<DungeonState>,
  type: SegmentType,
  box: { x: number; y: number; w: number; h: number; cx: number; cy: number },
  cameFromDir: SegmentState["cameFromDir"],
  doorCount: number,
  flavor: string | null,
  rng: RNG,
  isEntrance = false,
): Draft<SegmentState> {
  const id = draft.nextSegmentId;
  draft.nextSegmentId += 1;
  const doors = assignDirections(cameFromDir, doorCount).map((dir) => ({
    dir,
    opened: false,
    childId: null,
    leadsToLevel: null,
  }));
  const extras = draft.dungeonTypeKey
    ? resolveRoomExtras(type, draft.dungeonTypeKey, rng, isEntrance)
    : undefined;
  return {
    id,
    type,
    ...box,
    cameFromDir,
    flavor,
    doors,
    isEntrance,
    ...(extras
      ? {
          roomContent: extras.roomContent,
          monsters: extras.monsters ?? undefined,
          secretPassageSearched: false,
          secretPassageResult: null,
          trapResult: null,
          chestOpened: false,
          chestResult: null,
        }
      : {}),
  };
}

/** Spawns a CombatState for `template` in `segId`; if `wasNoisy`, the monsters get a free first attack. */
function startCombat(
  draft: Draft<DungeonState>,
  segId: number,
  template: MonsterTemplate,
  wasNoisy: boolean,
  rng: RNG,
  isBoss = false,
): void {
  const monsters: CombatMonsterState[] = spawnMonsters(
    template,
    () => {
      const id = draft.nextMonsterId;
      draft.nextMonsterId += 1;
      return id;
    },
    rng,
  );
  draft.combat = {
    segId,
    monsters,
    paralyzedTurns: 0,
    pendingLootRolls: 0,
    isBoss,
    outcome: "ongoing",
    pendingDamage: null,
    playerDamageBonus: 0,
    engulfableBodies: 0,
    damageReduction: 0,
    shields: [],
    absorbSoulActive: false,
    fireOfTheDeadActive: false,
  };
  pushLog(
    draft,
    isBoss
      ? `Segment ${segId}: the Dungeon Boss reveals itself!`
      : `Segment ${segId}: ${monsters.length} monster${monsters.length === 1 ? "" : "s"} attack!`,
  );
  if (wasNoisy && draft.combat) {
    pushLog(draft, "The noise gave you away — the monsters strike first!");
    applyMonsterTurn(draft, draft.combat, rng);
  }
}

/** Starts combat only if this newly-created segment rolled monsters. */
function startCombatIfMonsters(
  draft: Draft<DungeonState>,
  seg: { id: number; monsters?: MonsterTemplate },
  wasNoisy: boolean,
  rng: RNG,
  isBoss = false,
): void {
  if (!seg.monsters) return;
  startCombat(draft, seg.id, seg.monsters, wasNoisy, rng, isBoss);
}

/** True once a quiet arrival has revealed a room's monsters but the player hasn't yet chosen
 * Attack First or Move Silently (RESOLVE_ROOM_ENTRY) -- blocks every other action the same way an
 * active CombatState does, per "if you enter a segment with monsters, you must face them before
 * anything else." Boss rooms never reach this state (they start combat immediately, unconditionally). */
function hasPendingRoomEntry(state: DungeonState): boolean {
  // Once combat is active, entry has already been resolved (Attack First, or a wake-up after a
  // successful sneak) -- without this, every mid-combat action gated by this helper (CAST_SPELL,
  // OPEN_TREASURE) would silently no-op for the rest of the fight, since `seg.monsters` stays set
  // and `monstersDefeated`/`sneakedPast` stay false for the fight's entire duration.
  if (state.combat) return false;
  const level = state.levels[state.activeLevel];
  const seg = level?.segments.find((s) => s.id === state.currentSegId);
  return !!seg?.monsters && !seg.monstersDefeated && !seg.sneakedPast;
}

/** Issue #82: `hasPendingRoomEntry()` plus a pending Pack-full swap (RESOLVE_PACK_SWAP) --
 * every action already gated on the former is gated on this combined check instead, the same
 * breadth `pendingDamage` itself already required when it was introduced. */
function isActionBlocked(state: DungeonState): boolean {
  return hasPendingRoomEntry(state) || state.pendingPackItem != null;
}

/** If a room the player previously moved silently through hears a noisy action (a door breaking,
 * a trap firing) while they're still there, its monsters wake up and attack first -- "If while
 * hiding you set off a trap or make a noise, monsters attack." */
function wakeSneakedPastMonsters(
  draft: Draft<DungeonState>,
  seg: Draft<SegmentState>,
  rng: RNG,
): void {
  const monsters = seg.monsters;
  if (!seg.sneakedPast || !monsters) return;
  seg.sneakedPast = false;
  pushLog(draft, `Segment ${seg.id}: the noise gives you away -- the monsters attack!`);
  startCombat(draft, seg.id, monsters, true, rng);
}

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
function applyTrapEffect(
  draft: Draft<DungeonState>,
  trap: TrapEntry,
  segId: number,
  rng: RNG,
): void {
  if (!draft.alive) return; // a torchCost Darkness death already ended the run this same dispatch

  if (trap.bladeTrap) {
    if (rollDie(rng) === 1) {
      draft.hp = 0;
      if (trySamambroSurvival(draft, rng)) return;
      draft.alive = false;
      draft.deathCause = "combat";
      pushLog(draft, "The blade finds its mark. The dungeon keeps what it took.", "descend");
      leaveRemains(draft, segId);
    }
    // A roll of 2 ("lose an arm") is flavor only -- no hand-economy system exists to enforce
    // against, same simplification tier as WeaponEntry.twoHanded.
    return;
  }

  if (trap.damage) {
    draft.hp = Math.max(0, draft.hp - trap.damage);
    pushLog(draft, `The trap deals ${trap.damage} damage.`);
    if (draft.hp <= 0) {
      if (trySamambroSurvival(draft, rng)) return;
      draft.alive = false;
      draft.deathCause = "combat";
      pushLog(draft, "The trap finishes you. The dungeon keeps what it took.", "descend");
      leaveRemains(draft, segId);
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
function resolveTrapOutcome(
  draft: Draft<DungeonState>,
  trap: TrapEntry,
  segId: number,
  rng: RNG,
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
  if (trap.torchCost) {
    spendTorches(
      draft,
      trap.torchCost,
      `Spent ${trap.torchCost} torch${trap.torchCost > 1 ? "es" : ""} climbing out.`,
      segId,
      rng,
    );
  }
  applyTrapEffect(draft, trap, segId, rng);
}

/**
 * One full monster counter-attack: sums damage (including any queued Firebreath/Sorcery
 * bonuses), applies a queued Deathtouch or Paralyze, then clears those queued effects.
 */
/** Flat damage bonus for the player's next attack: the active fight's `combatDamageBonus` (e.g.
 * Potion of Fury), plus the equipped weapon's `weaponDamageBonus`/`damageBonusVsTag` if its tag
 * matches the target (case-insensitive substring of the monster's name -- there's no formal
 * monster-category system, matching the rulebook's own flavor-driven "+2 damage to Angels" style). */
/** Every currently-equipped item's ability, whether it lives on the weapon or an armor piece --
 * e.g. Emperor's Sandals (a Wonder, "wonderItem" armor piece) grants a damage bonus exactly like
 * a [Weapon] of War would, so damage-bonus effects aren't only ever looked for on the weapon. */
function equippedEffects(draft: Draft<DungeonState>): ItemEffect[] {
  const effects: ItemEffect[] = [];
  if (draft.weapon?.bonusEffect) effects.push(draft.weapon.bonusEffect);
  for (const piece of draft.armor) {
    if (piece.effect) effects.push(piece.effect);
  }
  return effects;
}

function matchesTags(monster: Draft<CombatMonsterState>, tags: string[]): boolean {
  const name = monster.name.toLowerCase();
  return tags.some((tag) => name.includes(tag.toLowerCase()));
}

/** `isHorn`: Rinoceroid's horn attack bypasses the equipped weapon entirely, so it skips any
 * weapon-specific bonus effect -- general combat buffs (Potion of Fury, Grave Digger) still apply. */
function attackBonus(
  draft: Draft<DungeonState>,
  monster: Draft<CombatMonsterState>,
  isHorn = false,
): number {
  let bonus = draft.combat?.playerDamageBonus ?? 0;
  // Grave Digger (base Class) and Gravedigger (Advanced Class, issue #23) are two separate
  // rulebook entries that happen to grant the identical "+2 damage to Undead" bonus -- either one
  // (or both) applies the same single +2, not stacked.
  if (
    (draft.className === "Grave Digger" || draft.advancedClasses.includes("Gravedigger")) &&
    monster.abilities.includes("undead")
  ) {
    bonus += 2;
  }
  // Ogre (New Races, issue #22): "Deals +2 damage." Unconditional, unlike Grave Digger's
  // Undead-only bonus above -- the rulebook doesn't restrict it to any monster type or weapon.
  if (draft.raceName === "Ogre") {
    bonus += 2;
  }
  // Minstrel (Hireling, issue #25): "Can play music in combat (+2 damage)." Unconditional, same
  // shape as Ogre's own +2 above.
  if (draft.hireling === "Minstrel") {
    bonus += 2;
  }
  // Dwarf Soldier (Hireling, issue #25): "Deals +1 damage against Orcs and Goblins." Reuses the
  // exact tag-substring-match mechanism the equipped-item effects below already establish.
  if (draft.hireling === "Dwarf Soldier" && matchesTags(monster, ["orc", "goblin"])) {
    bonus += 1;
  }
  // Helsing (Advanced Class, issue #71): "+1 damage against Vampires and Ghouls" -- the identical
  // tags the Garlic necklace item's own damageBonusVsTag effect already uses.
  if (draft.advancedClasses.includes("Helsing") && matchesTags(monster, ["vampire", "ghoul"])) {
    bonus += 1;
  }
  // Bugcatcher (Advanced Class, issue #71): "+1 damage against insects and arachnids" -- matches
  // the same curated spider/scorpion/wasp names its kill-count requirement sums (see
  // advancedClasses.ts's BUG_MONSTER_NAMES), as a substring so plural/boss variants match too.
  if (
    draft.advancedClasses.includes("Bugcatcher") &&
    matchesTags(monster, ["spider", "scorpion", "wasp"])
  ) {
    bonus += 1;
  }
  if (isHorn) return bonus;
  for (const effect of equippedEffects(draft)) {
    if (effect.kind === "weaponDamageBonus") {
      bonus += effect.amount;
    } else if (effect.kind === "damageBonusVsTag" && matchesTags(monster, effect.tags)) {
      bonus += effect.amount;
    }
  }
  return bonus;
}

/** Multiplier applied to just the weapon's own roll (e.g. "[Weapon] of the Dragon Slayer: Double
 * damage against Dragons"), before `attackBonus` is added. */
function attackMultiplier(
  draft: Draft<DungeonState>,
  monster: Draft<CombatMonsterState>,
  isHorn = false,
): number {
  let multiplier = 1;
  if (isHorn) return multiplier;
  for (const effect of equippedEffects(draft)) {
    if (effect.kind === "damageMultiplierVsTag" && matchesTags(monster, effect.tags)) {
      multiplier *= effect.multiplier;
    }
  }
  return multiplier;
}

/** True if any equipped item (weapon or armor) ignores this specific monster ability. */
function ignoresAbility(draft: Draft<DungeonState>, ability: MonsterAbility): boolean {
  return equippedEffects(draft).some(
    (effect) => effect.kind === "ignoresMonsterAbility" && effect.ability === ability,
  );
}

/** Every monster ability ignored by an equipped item, e.g. Boatman's Oar bypassing Intangible's
 * damage-parity block -- fed into `resolvePlayerAttack`'s defensive-ability filter. */
function ignoredAbilities(draft: Draft<DungeonState>): MonsterAbility[] {
  return equippedEffects(draft)
    .filter(
      (effect): effect is Extract<ItemEffect, { kind: "ignoresMonsterAbility" }> =>
        effect.kind === "ignoresMonsterAbility",
    )
    .map((effect) => effect.ability);
}

/** True once at least one equipped armor piece can actually absorb something. */
function hasUsableArmor(draft: Draft<DungeonState>): boolean {
  return draft.armor.some((piece) => piece.hp > 0);
}

function applyMonsterTurn(draft: Draft<DungeonState>, combat: Draft<CombatState>, rng: RNG): void {
  // Poison: "All damage from this creature cannot be absorbed by armor or other means" -- tallied
  // apart from every other monster's damage, which the player may still choose to absorb.
  // Pirate (Advanced Class, issue #72): "Ignores Poison" -- the damage still lands, but no longer
  // bypasses armor, so it folds into absorbableDamage below instead of the poison-only pool.
  const ignoresPoison = draft.advancedClasses.includes("Pirate");
  let poisonDamage = 0;
  let absorbableDamage = 0;
  let deathtouchKill = false;
  let paralyzeTurns = 0;
  for (const monster of combat.monsters) {
    // Vimes/Paralyze (New Spells, issue #61): a silenced monster skips its attack entirely, same
    // as a Cold Ray freeze, but for multiple rounds -- decremented once per round regardless of
    // whether it actually had a turn to skip yet (silencedTurns already accounts for this round).
    if (monster.silencedTurns > 0) {
      monster.silencedTurns -= 1;
    } else if (!monster.skipNextAttack) {
      // Ethereal Body (New Spells, issue #61): "all damage you take is reduced by 1 point," applied
      // per monster hit -- floored at 0, so it can't turn a hit into healing.
      const dmg = Math.max(0, monster.damage + monster.bonusDamage - combat.damageReduction);
      if (monster.abilities.includes("poison") && !ignoresPoison) {
        poisonDamage += dmg;
      } else {
        absorbableDamage += dmg;
      }
      if (monster.deathtouchPending) deathtouchKill = true;
      if (monster.paralyzePending > paralyzeTurns) paralyzeTurns = monster.paralyzePending;
    }
    monster.bonusDamage = 0;
    monster.deathtouchPending = false;
    monster.paralyzePending = 0;
    monster.skipNextAttack = false;
  }

  // Deathtouch "kills you" outright per the rulebook -- armor doesn't get a say.
  if (deathtouchKill) {
    draft.hp = 0;
    if (trySamambroSurvival(draft, rng)) return;
    draft.alive = false;
    draft.deathCause = "combat";
    pushLog(draft, "A deathly touch stops your heart instantly.", "descend");
    leaveRemains(draft, combat.segId);
    draft.combat = null;
    return;
  }

  if (paralyzeTurns > 0) {
    combat.paralyzedTurns += paralyzeTurns;
    pushLog(draft, `You are paralyzed for ${paralyzeTurns} turn${paralyzeTurns > 1 ? "s" : ""}!`);
  }

  // Applied first and unconditionally so a fatal poison tick doesn't leave a moot absorption
  // choice pending for whatever non-poison damage landed in the same round.
  if (poisonDamage > 0) {
    draft.hp = Math.max(0, draft.hp - poisonDamage);
    pushLog(draft, `Poison courses through you for ${poisonDamage} damage.`);
  }

  // Magic Shield (New Spells, issue #61): "it can absorb 4 damage points. Can cast more than one" --
  // drains the oldest shield first, spilling into the next, before offering the normal
  // armor-or-HP choice; poison already bypassed this pool entirely above, same as it bypasses
  // armor ("cannot be absorbed by armor or other means"). Depleted shields are dropped.
  while (absorbableDamage > 0 && combat.shields.length > 0) {
    const absorbed = Math.min(absorbableDamage, combat.shields[0]!);
    combat.shields[0] = combat.shields[0]! - absorbed;
    absorbableDamage -= absorbed;
    if (combat.shields[0] === 0) combat.shields.shift();
  }

  if (draft.hp > 0 && absorbableDamage > 0) {
    // "Reduce this value from your HP (or armor's HP, if you're using one -- your call)": with
    // usable armor equipped, defer to RESOLVE_DAMAGE instead of subtracting HP immediately.
    if (hasUsableArmor(draft)) {
      combat.pendingDamage = absorbableDamage;
      pushLog(
        draft,
        `The monsters strike for ${absorbableDamage} damage -- choose what absorbs it.`,
      );
      return;
    }
    draft.hp = Math.max(0, draft.hp - absorbableDamage);
    pushLog(draft, `The monsters strike back for ${absorbableDamage} damage.`);
  }
  if (draft.hp <= 0) {
    if (trySamambroSurvival(draft, rng)) return;
    draft.alive = false;
    draft.deathCause = "combat";
    pushLog(draft, "You fall in combat, overwhelmed by your foes.", "descend");
    leaveRemains(draft, combat.segId);
    draft.combat = null;
  }
}

/** Removes a monster reduced to 0 HP, resolving Undead revival and queuing a Loot roll first. */
function handleMonsterDefeat(
  draft: Draft<DungeonState>,
  combat: Draft<CombatState>,
  monster: Draft<CombatMonsterState>,
  rng: RNG,
  // Banish the Dead (issue #61): "Destroy any Undead" -- a decisive banishment, not an ordinary
  // kill, so it bypasses the Undead ability's own roll-of-1 revival entirely rather than letting
  // RNG contradict the spell's own text.
  bypassRevival = false,
): void {
  if (monster.hp > 0) return;
  const revived = !bypassRevival && !ignoresAbility(draft, "undead") && checkUndeadRevival(monster, rng);
  if (revived) {
    monster.hp = 1;
    pushLog(draft, `${monster.name} rises again with 1 HP!`);
  } else {
    if (monster.abilities.includes("loot")) combat.pendingLootRolls += 1;
    combat.monsters = combat.monsters.filter((m) => m.id !== monster.id);
    draft.monsterKills += 1;
    if (combat.isBoss) draft.bossKills += 1;
    const nameKey = monster.name.toLowerCase();
    draft.killsByName[nameKey] = (draft.killsByName[nameKey] ?? 0) + 1;
    for (const ability of monster.abilities) {
      draft.killsByAbility[ability] = (draft.killsByAbility[ability] ?? 0) + 1;
    }
    pushLog(draft, `${monster.name} is defeated!`);

    combat.engulfableBodies += 1; // Slimemen's engulf-for-full-HP -- no Undead exception in the rulebook
    if (draft.className === "Cook" && !monster.abilities.includes("undead")) {
      draft.coins += 1;
      pushLog(draft, "Cook's instincts: +1 coin from the kill.");
    }
  }
}

/** If every monster is gone, resolves Loot (or the Boss's flat 2d6 Treasures), marks the room cleared, and closes out combat. */
function finishIfVictorious(
  draft: Draft<DungeonState>,
  combat: Draft<CombatState>,
  rng: RNG,
): void {
  if (combat.monsters.length > 0) return;
  const level = draft.levels[draft.activeLevel];
  const seg = level?.segments.find((s) => s.id === combat.segId);
  if (seg) seg.monstersDefeated = true;

  // Absorb Soul/Fire of the Dead (New Spells, issue #61): deferred-to-victory triggers, off the
  // same "monsters actually killed this fight" count Slimemen's engulfableBodies already tracks --
  // applies to a Boss victory too, since neither spell's text carves out an exception for one.
  if (combat.absorbSoulActive && combat.engulfableBodies > 0) {
    const healed = Math.min(5 * combat.engulfableBodies, draft.maxHp - draft.hp);
    draft.hp += healed;
    pushLog(draft, `Absorb Soul restores ${healed} HP from the fallen.`);
  }
  if (combat.fireOfTheDeadActive && combat.engulfableBodies > 0) {
    const gained = Math.min(2 * combat.engulfableBodies, 10 - draft.torches);
    draft.torches += gained;
    pushLog(
      draft,
      `Fire of the Dead grants you ${gained} torch${gained === 1 ? "" : "es"} from the fallen.`,
    );
  }

  if (combat.isBoss) {
    const treasures = rollDie(rng) + rollDie(rng);
    draft.treasures += treasures;
    pushLog(draft, `The Boss falls! You find ${treasures} Treasures among the remains.`);
    // Buildings (issue #27): "You get N coins when you kill a Dungeon Boss" -- summed across every
    // Palace/Castle/City/Fortress owned (House/Tower have no tax).
    const tax = buildingTaxTotal(draft.buildings.map((b) => b.kind));
    if (tax > 0) {
      draft.coins += tax;
      pushLog(draft, `Your holdings collect ${tax} coins in taxes from the Boss's fall.`);
    }
    pushLog(draft, "You have conquered the dungeon!", "descend");
    draft.combat = null;
    return;
  }

  if (combat.pendingLootRolls > 0) {
    const loot = rollLoot(combat.pendingLootRolls, rng);
    if (loot.coins > 0) {
      draft.coins += loot.coins;
      pushLog(draft, `Loot: found ${loot.coins} coin${loot.coins > 1 ? "s" : ""}.`);
    }
    if (loot.keys > 0) {
      draft.keys += loot.keys;
      pushLog(draft, `Loot: found ${loot.keys} Key${loot.keys > 1 ? "s" : ""}.`);
    }
    if (loot.treasures > 0) {
      draft.treasures += loot.treasures;
      pushLog(draft, `Loot: found ${loot.treasures} Treasure${loot.treasures > 1 ? "s" : ""}.`);
    }
  }
  pushLog(draft, "The room falls silent. You are victorious!", "descend");
  draft.combat = null;
}

/** Copies a persisted run's map/exploration state onto a fresh draft, shared by RESUME_DUNGEON
 * (a new character taking over a dead one's map) and RETURN_TO_DUNGEON (the same character
 * coming back from Town) -- the two differ in what happens to the character's resources (which
 * the caller has already seeded via `createInitialDungeonState()` before calling this) and in
 * `resetToEntrance`, see below. */
function restoreMapFromPersisted(
  draft: Draft<DungeonState>,
  persisted: DungeonState,
  rng: RNG,
  logMessage: string,
  /** RESUME_DUNGEON only: a brand new character walks in from the entrance and must explore to
   * find whatever the previous one left behind, rather than starting wherever they died --
   * "he will find his backpack and clothes on the floor" implies discovering it, not teleporting
   * to it. RETURN_TO_DUNGEON (the same still-living character) instead picks up exactly in place. */
  resetToEntrance: boolean,
): void {
  draft.dungeonTypeKey = persisted.dungeonTypeKey;
  draft.dungeonName = persisted.dungeonName;
  draft.entranceFlavor = persisted.entranceFlavor;
  draft.levels = persisted.levels;
  draft.activeLevel = persisted.activeLevel;
  draft.nextSegmentId = persisted.nextSegmentId;
  draft.nextLogId = persisted.nextLogId;
  draft.nextMonsterId = persisted.nextMonsterId;
  // Positional movement (see CLAUDE.md): the player starts back at their level's own entry point,
  // not wherever they last stood -- "you must roll on the Monster table for each empty room you
  // enter" only means something if walking back through those rooms is unavoidable.
  draft.selectedSegId = draft.levels[draft.activeLevel]?.segments[0]?.id ?? null;
  draft.currentSegId = draft.selectedSegId;
  draft.stats = persisted.stats;
  draft.log = persisted.log;
  pushLog(draft, logMessage, "descend");

  if (resetToEntrance) {
    draft.activeLevel = 0;
    draft.selectedSegId = draft.levels[0]?.segments[0]?.id ?? null;
    draft.currentSegId = draft.selectedSegId;
  }

  // Per the rulebook: returning to a dungeon means any room still holding monsters has them
  // recover to full health. There's at most one such room -- wherever the previous session's
  // fight was interrupted, since every other room's combat had already resolved (won) before
  // its doors could be opened further. RETURN_TO_DUNGEON (the same character) drops right back
  // into it, matching where they actually stood. RESUME_DUNGEON (a new character, reset to the
  // entrance above) must instead walk there like anywhere else -- eagerly starting combat here
  // regardless would leave `combat` set on a segment the player isn't even positioned at anymore,
  // dropping them straight into the Boss fight instead of the entrance. The segment's monsters
  // stay at their full-HP template and `monstersDefeated` stays false, so rerollMonstersIfNeeded's
  // fallback below picks the fight back up the moment the new character actually arrives.
  const oldCombat = persisted.combat;
  if (oldCombat && !resetToEntrance) {
    const level = draft.levels[draft.activeLevel];
    const seg = level?.segments.find((s) => s.id === oldCombat.segId);
    if (seg?.monsters) {
      draft.selectedSegId = seg.id;
      draft.currentSegId = seg.id;
      startCombat(draft, seg.id, seg.monsters, false, rng, oldCombat.isBoss);
    }
  }

  // Per the rulebook, this also applies: "you must roll on the Monster table for each empty
  // room you enter" -- fresh monsters may have moved in while the character was away. Flagged
  // here and resolved lazily by SELECT_SEGMENT (rather than eagerly for the whole map) since this
  // app only has one combat slot at a time; eagerly rolling every empty room could produce several
  // newly-occupied rooms with no way to fight more than one of them. The interrupted-fight room
  // above is excluded (it already has monsters, full-health, from persisted state). Content
  // (roomContent/chests/secret passages already searched) is untouched -- the rulebook penalty is
  // specifically about monsters repopulating, not the room resetting.
  for (const level of draft.levels) {
    for (const seg of level.segments) {
      if (!seg.type.startsWith("room-")) continue;
      if (seg.isEntrance) continue; // exempt from Monsters at creation (#43) and reroll alike
      if (oldCombat && seg.id === oldCombat.segId) continue;
      if (seg.monsters && !seg.monstersDefeated) continue;
      seg.needsMonsterReroll = true;
    }
  }
  const current = draft.levels[draft.activeLevel]?.segments.find(
    (s) => s.id === draft.currentSegId,
  );
  if (current) rerollMonstersIfNeeded(draft, current, rng);
}

/** Rolls a fresh Monster table entry for a room flagged `needsMonsterReroll` (see
 * `restoreMapFromPersisted`), replacing whatever was there (empty or already-cleared) and
 * starting combat if the roll produced one -- the moment the player actually looks at the room is
 * this app's closest equivalent to the rulebook's "each empty room you enter." Otherwise, if the
 * room's monsters were never actually defeated and nothing is currently fighting them -- Teleport
 * (the flee spell) clears `combat` outright without marking `monstersDefeated`, and unlike a
 * death or a Town retreat mid-fight, there's no persisted `CombatState` for `restoreMapFromPersisted`
 * to eagerly respawn, so nothing else would ever pick the fight back up -- resumes it right here,
 * at full HP, same as encountering it for the first time (Final Room segments are always the
 * Boss, so `seg.type === "final"` doubles as `isBoss` with no separate field to track). */
function rerollMonstersIfNeeded(
  draft: Draft<DungeonState>,
  seg: Draft<SegmentState>,
  rng: RNG,
): void {
  if (seg.needsMonsterReroll) {
    seg.needsMonsterReroll = false;
    if (!draft.dungeonTypeKey) return;
    const monsterSum = rollDie(rng) + rollDie(rng);
    const monsters = DUNGEON_TABLES[draft.dungeonTypeKey].monsters[monsterSum] ?? null;
    seg.monsters = monsters ?? undefined;
    seg.monstersDefeated = undefined;
    if (monsters) {
      pushLog(draft, `Segment ${seg.id}: fresh monsters have moved in.`);
      startCombat(draft, seg.id, monsters, false, rng);
    }
    return;
  }
  if (seg.monsters && !seg.monstersDefeated && !seg.sneakedPast && draft.combat?.segId !== seg.id) {
    pushLog(draft, `Segment ${seg.id}: the fight you fled from is still waiting.`);
    startCombat(draft, seg.id, seg.monsters, false, rng, seg.type === "final");
  }
}

/** Issue #82: "can't use more than one identical piece" -- only these 5 real body slots are
 * subject to it (same list `Collector`'s Advanced Class check already uses,
 * `src/engine/advancedClasses.ts`); `ring` (a documented 0-HP dud, not one of the rulebook's own
 * "5 pieces") and `wonderItem` (an unlimited trinket collection) are exempt. */
const REAL_ARMOR_SLOTS = new Set<ArmorPieceKind>([
  "bracelets",
  "boots",
  "shoulderpads",
  "helm",
  "breastplate",
]);

/** Adds a found armor piece, benching it into `spareArmor` instead of `armor` if its slot is a
 * real one that's already occupied -- the single chokepoint every armor-granting site now funnels
 * through, replacing what used to be a raw, unconditional `draft.armor.push(...)`. */
function addArmorPiece(draft: Draft<DungeonState>, piece: ArmorPiece): void {
  if (REAL_ARMOR_SLOTS.has(piece.piece) && draft.armor.some((p) => p.piece === piece.piece)) {
    draft.spareArmor.push(piece);
  } else {
    draft.armor.push(piece);
  }
}

function addArmorPieces(draft: Draft<DungeonState>, pieces: ArmorPiece[]): void {
  for (const piece of pieces) addArmorPiece(draft, piece);
}

/** Issue #82: the single chokepoint `OPEN_TREASURE`'s `heldValue`/`heldValueRoll` cases funnel
 * through -- pushes normally, or (Pack already at `MAX_HELD_ITEMS`) sets `pendingPackItem`
 * instead, blocking every other action until RESOLVE_PACK_SWAP settles it. `foundText` is still
 * logged either way (the item was still found), with a note appended when it doesn't fit yet. */
function addHeldItem(draft: Draft<DungeonState>, item: HeldItem, foundText: string): void {
  if (draft.heldItems.length >= MAX_HELD_ITEMS) {
    draft.pendingPackItem = item;
    pushLog(draft, `${foundText} Your Pack is full -- choose what to do.`);
  } else {
    draft.heldItems.push(item);
    pushLog(draft, foundText);
  }
}

/** Issue #83: flat placeholder worth for an Ogre-unusable potion/scroll outcome that has no coin
 * value of its own to draw on (unlike armor, which at least has a `maxHp` to derive one from) --
 * matches the scale of this dungeon type's other small heldValue Treasures (Religious Object/
 * Sinister Idol, 3 coins). */
const OGRE_UNUSABLE_TREASURE_WORTH = 3;

/** A Wonder either grants its own HP-bearing item (Jester Hat, 2 HP) or a standing ability with
 * nothing else to attach to (Amulet of the Dead) -- both become a `draft.armor` entry (0 HP for
 * the latter, so it's never offered as a damage-absorption choice but still equipped/trackable and
 * checked by whichever system its effect concerns), except `combatDamageBonus`/`grantsTorches`/
 * `randomSpell`, which apply immediately (to the active fight, the torch count, or spellUses
 * respectively) rather than lingering as an item. */
function resolveWonder(draft: Draft<DungeonState>, entry: WonderEntry, rng: RNG): void {
  // Ogre (New Races, issue #60): "Cannot use potions, scrolls or wear armor" -- every Wonder
  // outcome that would otherwise grant *something* (a worn trinket, or an immediate potion/scroll/
  // combat-buff effect) is one of exactly those three restricted things, so instead of vanishing
  // outright it becomes a sellable HeldItem (issue #83) -- worth taken from the item's own HP pool
  // where it has one (a worn trinket), else a flat placeholder matching this dungeon type's other
  // small heldValue Treasures (Religious Object/Sinister Idol, 3 coins) for the potion/scroll-shaped
  // outcomes that never had a coin value of their own to draw on. A pure-flavor Wonder with no
  // `grantsHp` (e.g. "Lamp") grants nothing to anyone, Ogre included, so it's excluded here.
  if (draft.raceName === "Ogre" && (entry.grantsHp !== undefined || entry.effect.kind !== "flavor")) {
    const worth = entry.grantsHp !== undefined ? Math.max(1, entry.grantsHp) : OGRE_UNUSABLE_TREASURE_WORTH;
    addHeldItem(
      draft,
      { name: entry.name, worth },
      `Treasure: ${entry.text} Ogres cannot use this -- sold instead.`,
    );
    return;
  }
  if (entry.grantsHp !== undefined) {
    addArmorPiece(draft, {
      piece: "wonderItem",
      hp: entry.grantsHp,
      maxHp: entry.grantsHp,
      itemName: entry.name,
      effect: entry.effect,
    });
  } else if (entry.effect.kind === "combatDamageBonus") {
    // OPEN_TREASURE is "usable anytime, not tied to a room" (see CLAUDE.md), so opening one
    // outside a fight is normal, expected usage -- but this bonus only means anything mid-fight,
    // so it's simply wasted rather than banked for whatever fight comes next.
    if (draft.combat) {
      draft.combat.playerDamageBonus += entry.effect.amount;
    } else {
      pushLog(draft, `Treasure: ${entry.text} No fight is happening right now, so it has no effect.`);
      return;
    }
  } else if (entry.effect.kind === "grantsTorches") {
    const gained = Math.min(entry.effect.amount, 10 - draft.torches);
    draft.torches += gained;
  } else if (entry.effect.kind === "randomSpell") {
    // Always a random *Basic* Spell per the rulebook's own wording for every Wonder/Magic
    // Scroll/Mana Potion that grants one -- New Spells (issue #24) tables are never rolled here.
    const spellRoll = rollDie(rng);
    draft.spellUses[spellKey("basic", spellRoll)] = (draft.spellUses[spellKey("basic", spellRoll)] ?? 0) + 1;
    const spellName = SPELL_TABLE[spellRoll]?.name ?? "a spell";
    pushLog(draft, `Treasure: ${entry.text} — learned ${spellName}!`);
    return;
  } else if (entry.effect.kind !== "flavor") {
    addArmorPiece(draft, {
      piece: "wonderItem",
      hp: 0,
      maxHp: 0,
      itemName: entry.name,
      effect: entry.effect,
    });
  }
  pushLog(draft, `Treasure: ${entry.text}`);
}

/** A Magic Item is always "[Armor] of X" or "[Weapon] of X" -- roll the base table for the
 * concrete piece/weapon, then layer the named item's bonus on top (an armor bonus is baked into
 * the piece's HP if it's `extraHp`, or attached as `effect` for anything else the piece grants;
 * a weapon bonus always rides along as `bonusEffect`, applied during combat). */
function resolveMagicItem(draft: Draft<DungeonState>, entry: MagicItemEntry, rng: RNG): void {
  if (entry.grants === "armor") {
    // Ogre (New Races, issue #60): "Cannot use potions, scrolls or wear armor" -- only the armor
    // half of this table is blocked; Ogre still fully benefits from "[Weapon] of X" items below,
    // since the restriction never mentions weapons. The base Armor table is still rolled (same RNG
    // consumption as anyone else), since its `maxHp` is what gives the unusable piece a worth once
    // it becomes a sellable HeldItem instead of vanishing outright (issue #83).
    const roll = rollDie(rng);
    const base = ARMOR_TABLE[roll]!;
    if (draft.raceName === "Ogre") {
      addHeldItem(
        draft,
        { name: entry.name, worth: Math.max(1, base.maxHp) },
        `Treasure: ${entry.text} Ogres cannot wear armor -- sold instead.`,
      );
      return;
    }
    const bonusHp = entry.effect.kind === "extraHp" ? entry.effect.amount : 0;
    const maxHp = Math.max(0, base.maxHp + bonusHp);
    addArmorPiece(draft, {
      piece: base.piece,
      hp: maxHp,
      maxHp,
      itemName: entry.name,
      effect: entry.effect.kind === "extraHp" ? undefined : entry.effect,
    });
    pushLog(draft, `Treasure: ${entry.text} (${ARMOR_PIECE_LABELS[base.piece]}, ${maxHp} HP)`);
  } else if (entry.fixedFormula) {
    draft.spareWeapons.push({
      name: entry.name,
      formula: entry.fixedFormula,
      bonusEffect: entry.effect.kind !== "flavor" ? entry.effect : undefined,
    });
    pushLog(draft, `Treasure: ${entry.text} (${entry.fixedFormula} damage)`);
  } else {
    const roll = rollDie(rng);
    const base = DUNGEON_TABLES[draft.dungeonTypeKey!].weapon[roll]!;
    draft.spareWeapons.push({
      name: base.name,
      formula: base.formula,
      twoHanded: base.twoHanded,
      bonusEffect: entry.effect.kind !== "flavor" ? entry.effect : undefined,
    });
    pushLog(draft, `Treasure: ${entry.text} (${base.name}, ${base.formula} damage)`);
  }
}

/**
 * Applies a Room Content row's automatic reward -- unlike Chests/Treasures (an explicit player
 * action), these are just there the moment the room is built, same as its flavor text. `coins`/
 * `treasures` credit the rolled count directly (`multiplier` for rows like "2d6 paintings, 2
 * coins each"); `magicScrolls` grants that many random Basic Spell uses; `magicItems` rolls that
 * many Magic Items off the dungeon's own table, reusing `resolveMagicItem()` (its "Treasure:" log
 * prefix is a little off for an Armory's own contents, but the base-table-roll/bonus-layering
 * logic it reuses is exactly right, so that's an acceptable trade).
 */
function applyRoomContentReward(
  draft: Draft<DungeonState>,
  reward: RoomContentReward,
  rng: RNG,
): void {
  const count = resolveMonsterCount(reward.count, rng);
  if (count <= 0) return;

  switch (reward.kind) {
    case "coins": {
      const coins = count * (reward.multiplier ?? 1);
      draft.coins += coins;
      pushLog(draft, `You find ${coins} coin${coins === 1 ? "" : "s"}.`);
      break;
    }
    case "treasures": {
      draft.treasures += count;
      pushLog(draft, `You find ${count} Treasure${count === 1 ? "" : "s"}.`);
      break;
    }
    case "magicScrolls": {
      // Ogre (New Races, issue #60): "Cannot use scrolls" -- the scrolls are still found, but
      // instead of vanishing they're sold as one bundled HeldItem (issue #83) rather than granting
      // spell uses.
      if (draft.raceName === "Ogre") {
        const label = `${count} Magic Scroll${count === 1 ? "" : "s"}`;
        addHeldItem(
          draft,
          { name: label, worth: count * OGRE_UNUSABLE_TREASURE_WORTH },
          `You find ${label}, but Ogres cannot use scrolls -- sold instead.`,
        );
        break;
      }
      const spellNames: string[] = [];
      for (let i = 0; i < count; i++) {
        const spellRoll = rollDie(rng);
        const key = spellKey("basic", spellRoll);
        draft.spellUses[key] = (draft.spellUses[key] ?? 0) + 1;
        // Raises the ceiling too (issue #75), same as every other spell-granting site.
        draft.maxSpellUses[key] = (draft.maxSpellUses[key] ?? 0) + 1;
        spellNames.push(SPELL_TABLE[spellRoll]?.name ?? "a spell");
      }
      pushLog(
        draft,
        `You find ${count} Magic Scroll${count === 1 ? "" : "s"}, learning ${spellNames.join(", ")}.`,
      );
      break;
    }
    case "magicItems": {
      if (!draft.dungeonTypeKey) break;
      for (let i = 0; i < count; i++) {
        const roll = rollDie(rng);
        const entry = DUNGEON_TABLES[draft.dungeonTypeKey].magicItem[roll]!;
        resolveMagicItem(draft, entry, rng);
      }
      break;
    }
  }
}

/** Everything that happens once a new *room* segment (not a Final Room, which has no Content roll
 * and so never has `roomContent`) is built and pushed onto the level: its Room Content reward (if
 * any) applies first. A noisy arrival (a broken door, a fired trap) starts combat immediately with
 * the monsters attacking first, same as always. A quiet arrival with monsters instead waits for the
 * player's RESOLVE_ROOM_ENTRY choice (Attack First / Move Silently) rather than defaulting straight
 * into combat -- see docs/game-rules-reference.md's Move Silently rule. */
function finishRoomSegment(
  draft: Draft<DungeonState>,
  seg: { id: number; monsters?: MonsterTemplate; roomContent?: { reward?: RoomContentReward } },
  wasNoisy: boolean,
  rng: RNG,
): void {
  if (seg.roomContent?.reward) {
    applyRoomContentReward(draft, seg.roomContent.reward, rng);
  }
  if (wasNoisy) {
    startCombatIfMonsters(draft, seg, true, rng);
  }
}

/** "A secret door to a Staircase" (Secret Passage roll of 6) -- builds a real, descendable
 * staircase segment off the room, exactly like an ordinary door resolving to the Segments
 * table's "staircase" outcome (1 door, "the door in the end"), except the door itself is brand
 * new (not one of the room's already-rolled doors) and already open, since finding it via a
 * search *is* the reveal -- no separate OPEN_DOOR click needed. Placed in whichever cardinal
 * direction the room doesn't already have a door facing; a non-entrance room always has at least
 * one free direction (assignDirections caps a non-entrance room's own door count at 3 of 4), so
 * this only ever silently no-ops (the flavor text alone still stands) for a fully 4-doored
 * entrance, the one segment type that can actually use all four. Doesn't touch
 * `stats.doorsRemaining` the way a normal door resolution does beyond `bumpStatsForNewSegment`'s
 * own `+= doors` -- this door was never a previously-counted pending slot to "consume," it's a
 * wholly new one the search just added. */
function buildSecretPassageStaircase(
  draft: Draft<DungeonState>,
  level: Draft<LevelState>,
  seg: Draft<SegmentState>,
  rng: RNG,
): void {
  const usedDirs = new Set(seg.doors.map((d) => d.dir));
  const freeDir = (["N", "E", "S", "W"] satisfies Direction[]).find((d) => !usedDirs.has(d));
  if (!freeDir) return;

  const box = placeChild(seg, freeDir, "staircase", level.segments);
  const stairSeg = buildSegment(draft, "staircase", box, freeDir, 1, null, rng);
  level.segments.push(stairSeg);
  level.connectors.push(buildConnector(seg, freeDir, box));
  seg.doors.push({ dir: freeDir, opened: true, childId: stairSeg.id, leadsToLevel: null });
  level.hasStaircase = true;

  bumpStatsForNewSegment(draft.stats, "staircase", 1);

  pushLog(draft, `Segment ${seg.id}: a secret door reveals a Staircase (Segment ${stairSeg.id})!`);
  finishRoomSegment(draft, stairSeg, false, rng);
}

export function dungeonReducer(
  state: DungeonState,
  action: DungeonAction,
  rng: RNG = Math.random,
): DungeonState {
  switch (action.type) {
    case "ROLL_DUNGEON": {
      const dtype = DUNGEON_TYPES[action.typeRoll];
      if (!dtype) throw new Error(`No dungeon type for roll ${action.typeRoll}`);
      const second = DUNGEON_NAME_SECOND[action.secondRoll];
      const third = DUNGEON_NAME_THIRD[action.thirdRoll];

      return produce(state, (draft) => {
        draft.dungeonTypeKey = dtype.key;
        draft.dungeonName = `${dtype.name} ${second ?? ""} ${third ?? ""}`.trim();
        draft.entranceFlavor = dtype.entrance;
        draft.levels = [makeLevel(1)];
        draft.activeLevel = 0;
        draft.nextSegmentId = 1;
        draft.nextLogId = 1;
        draft.selectedSegId = null;
        draft.log = [];
        draft.stats = {
          segments: 0,
          corridors: 0,
          rooms: 0,
          staircases: 0,
          doorsRemaining: 0,
          finalRooms: 0,
        };
        draft.torches -= 1;
        pushLog(draft, "Entering the dungeon costs 1 torch to light the way.");

        const level = draft.levels[0]!;
        const box = boxFromCenter(0, 0, sizeFor(dtype.entranceType, null));
        const entrance = buildSegment(
          draft,
          dtype.entranceType,
          box,
          null,
          dtype.doors,
          null,
          rng,
          true,
        );
        level.segments.push(entrance);
        level.doorsRemaining += dtype.doors;
        draft.currentSegId = entrance.id;
        draft.selectedSegId = entrance.id;
        bumpStatsForNewSegment(draft.stats, dtype.entranceType, dtype.doors);
        finishRoomSegment(draft, entrance, false, rng);
      });
    }

    case "SELECT_SEGMENT": {
      if (state.selectedSegId === action.segId) return state;
      // Moving to a *different* segment than the one the player currently occupies is only
      // possible into the fog-of-war boundary (see reachableSegIds) and never mid-combat;
      // re-selecting the segment you're already standing in (e.g. to trigger its monster
      // re-roll after a restore, see restoreMapFromPersisted) is always allowed.
      if (action.segId != null && action.segId !== state.currentSegId) {
        if (state.combat || isActionBlocked(state)) return state;
        const level = state.levels[state.activeLevel];
        const reachable = level ? reachableSegIds(level, state.currentSegId) : new Set<number>();
        if (!reachable.has(action.segId)) return state;
      }
      return produce(state, (draft) => {
        draft.selectedSegId = action.segId;
        if (action.segId == null) return;
        draft.currentSegId = action.segId;
        const level = draft.levels[draft.activeLevel];
        const seg = level?.segments.find((s) => s.id === action.segId);
        if (seg) rerollMonstersIfNeeded(draft, seg, rng);
      });
    }

    case "SWITCH_LEVEL": {
      if (state.combat || isActionBlocked(state)) return state;
      // A plain LevelTabs click (no segId) just changes which level's map is displayed -- always
      // allowed, though nothing on a level other than wherever currentSegId actually is will be
      // reachable once you get there (see reachableSegIds). Physically stepping through an
      // already-opened staircase (segId set, from DungeonMap's descend button) additionally moves
      // the player -- only valid if that staircase leads out of the segment they're currently in.
      if (action.segId != null) {
        const level = state.levels[state.activeLevel];
        const reachable = level ? reachableSegIds(level, state.currentSegId) : new Set<number>();
        if (!reachable.has(action.segId)) return state;
      } else if (state.activeLevel === action.levelIndex) {
        return state;
      }
      return produce(state, (draft) => {
        draft.activeLevel = action.levelIndex;
        draft.selectedSegId = action.segId ?? null;
        if (action.segId == null) return;
        draft.currentSegId = action.segId;
        const targetLevel = draft.levels[action.levelIndex];
        const seg = targetLevel?.segments.find((s) => s.id === action.segId);
        if (seg) rerollMonstersIfNeeded(draft, seg, rng);
      });
    }

    case "ROLL_SECRET_PASSAGE": {
      if (!state.alive || state.combat || isActionBlocked(state)) return state;
      return produce(state, (draft) => {
        const level = draft.levels[draft.activeLevel];
        const seg = level?.segments.find((s) => s.id === action.segId);
        if (!seg || seg.secretPassageSearched) return;

        if (
          !spendTorches(
            draft,
            1,
            `Segment ${seg.id}: spent 1 torch searching for a secret passage.`,
            seg.id,
            rng,
          )
        ) {
          return;
        }

        seg.secretPassageSearched = true;
        seg.secretPassageResult = SECRET_PASSAGE_TABLE[action.roll] ?? null;
        if (action.roll === 1 && action.trapRoll != null && draft.dungeonTypeKey) {
          const trap = DUNGEON_TABLES[draft.dungeonTypeKey].trap[action.trapRoll];
          if (trap) {
            seg.trapResult = trap.text;
            resolveTrapOutcome(draft, trap, seg.id, rng);
            wakeSneakedPastMonsters(draft, seg, rng);
          }
        }
        if (action.roll === 6) {
          buildSecretPassageStaircase(draft, level!, seg, rng);
        }
      });
    }

    case "ROLL_CHEST": {
      if (!state.alive || state.combat || isActionBlocked(state)) return state;
      return produce(state, (draft) => {
        const level = draft.levels[draft.activeLevel];
        const seg = level?.segments.find((s) => s.id === action.segId);
        if (!seg || seg.chestOpened) return;
        const chestAvailable =
          !!seg.roomContent?.hasChest ||
          seg.secretPassageResult === "You have found a hidden Chest!";
        if (!chestAvailable) return;

        seg.chestOpened = true;
        const [a, b] = action.dice;

        if (a === 1 && b === 1) {
          seg.chestResult = "The chest was empty — it was a trap!";
          pushLog(draft, `Segment ${seg.id}: the chest was empty and triggered a trap!`);
          if (action.trapRoll != null && draft.dungeonTypeKey) {
            const trap = DUNGEON_TABLES[draft.dungeonTypeKey].trap[action.trapRoll];
            if (trap) {
              seg.trapResult = trap.text;
              pushLog(draft, trap.text);
              resolveTrapOutcome(draft, trap, seg.id, rng);
              wakeSneakedPastMonsters(draft, seg, rng);
            }
          }
          return;
        }

        const hasDoubleChestCoins = draft.armor.some(
          (piece) => piece.effect?.kind === "doubleChestCoins",
        );
        const coins = Math.max(a, b) * (hasDoubleChestCoins ? 2 : 1);
        const treasures = Math.min(a, b);
        draft.coins += coins;
        draft.treasures += treasures;
        seg.chestResult = `Found ${coins} coin${coins === 1 ? "" : "s"} and ${treasures} Treasure${treasures === 1 ? "" : "s"}.`;
        pushLog(
          draft,
          `Segment ${seg.id}: opened the chest — ${coins} coin${coins === 1 ? "" : "s"}, ${treasures} Treasure${treasures === 1 ? "" : "s"}.`,
        );
      });
    }

    case "COLLECT_REMAINS": {
      if (!state.alive || state.combat || isActionBlocked(state)) return state;
      return produce(state, (draft) => {
        const level = draft.levels[draft.activeLevel];
        const seg = level?.segments.find((s) => s.id === action.segId);
        if (!seg?.remains) return;
        const { names, coins, treasures, keys, heldItems, armor, spareArmor, weapon, weapons } =
          seg.remains;
        draft.coins += coins;
        draft.treasures += treasures;
        draft.keys += keys;
        // Ogre (New Races, issue #60): "Cannot... wear armor" -- recovered armor (worn or benched)
        // is left behind rather than picked up (coins/Treasures/Keys/held items/weapons are all
        // unaffected).
        if (draft.raceName !== "Ogre") {
          addArmorPieces(draft, armor);
          addArmorPieces(draft, spareArmor);
        }
        if (weapon) draft.spareWeapons.push(weapon);
        draft.spareWeapons.push(...weapons);
        // Pack cap (issue #82): none of coins/treasures/keys/armor/weapons are capped, only
        // heldItems -- take as many as currently fit, first-overflow becomes pendingPackItem, and
        // anything past that stays behind in a shrunken remains (nothing is ever silently lost;
        // collecting again later, once there's room, picks up the next one the same way).
        const room = Math.max(0, MAX_HELD_ITEMS - draft.heldItems.length);
        const fitting = heldItems.slice(0, room);
        const overflow = heldItems.slice(room);
        draft.heldItems.push(...fitting);
        const itemsPart =
          fitting.length > 0 ? `, and ${fitting.map((item) => item.name).join(", ")}` : "";
        pushLog(
          draft,
          `Segment ${seg.id}: recovered ${coins} coin${coins === 1 ? "" : "s"}, ${treasures} Treasure${treasures === 1 ? "" : "s"}, and ${keys} Key${keys === 1 ? "" : "s"}${itemsPart} from the remains of ${names.join(", ")}.`,
        );
        if (overflow.length > 0) {
          draft.pendingPackItem = overflow[0]!;
          seg.remains = {
            names,
            coins: 0,
            treasures: 0,
            keys: 0,
            heldItems: overflow.slice(1),
            armor: [],
            spareArmor: [],
            weapon: null,
            weapons: [],
          };
          pushLog(draft, `Your Pack is full -- ${overflow[0]!.name} is still waiting in the remains.`);
        } else {
          seg.remains = null;
        }
      });
    }

    case "WIELD_WEAPON": {
      if (!state.alive || state.combat || isActionBlocked(state)) return state;
      return produce(state, (draft) => {
        const chosen = draft.spareWeapons[action.index];
        if (!chosen) return;
        draft.spareWeapons.splice(action.index, 1);
        if (draft.weapon) draft.spareWeapons.push(draft.weapon);
        draft.weapon = chosen;
        pushLog(draft, `You wield the ${chosen.name}.`);
      });
    }

    case "WIELD_ARMOR": {
      // Issue #82: armor's own per-slot equivalent of WIELD_WEAPON -- unlike weapon's single
      // equipped slot, this has to find-and-replace by `piece` kind, since several different
      // slots can be worn at once.
      if (!state.alive || state.combat || isActionBlocked(state)) return state;
      return produce(state, (draft) => {
        const chosen = draft.spareArmor[action.index];
        if (!chosen) return;
        draft.spareArmor.splice(action.index, 1);
        const displacedIndex = draft.armor.findIndex((p) => p.piece === chosen.piece);
        if (displacedIndex >= 0) {
          const [displaced] = draft.armor.splice(displacedIndex, 1);
          draft.spareArmor.push(displaced!);
        }
        draft.armor.push(chosen);
        pushLog(draft, `You wear the ${chosen.itemName ?? ARMOR_PIECE_LABELS[chosen.piece]}.`);
      });
    }

    case "DISCARD_ITEM": {
      // Issue #82: a free, anywhere-usable Pack discard -- same minimal out-of-combat gate as
      // WIELD_WEAPON/WIELD_ARMOR.
      if (!state.alive || state.combat || isActionBlocked(state)) return state;
      return produce(state, (draft) => {
        const item = draft.heldItems[action.index];
        if (!item) return;
        draft.heldItems.splice(action.index, 1);
        pushLog(draft, `You leave the ${item.name} behind.`);
      });
    }

    case "RESOLVE_PACK_SWAP": {
      // Unlike the other free actions above, this is the *resolution* of an already-pending
      // choice, so it's the one case that must run even while isActionBlocked(state) is true (it
      // IS what clears that block) -- only `state.alive`/`state.pendingPackItem` gate it.
      if (!state.alive || state.pendingPackItem == null) return state;
      return produce(state, (draft) => {
        const incoming = draft.pendingPackItem;
        if (!incoming) return;
        draft.pendingPackItem = null;
        if (action.discardIndex === "decline") {
          pushLog(draft, `You leave the ${incoming.name} behind.`);
          return;
        }
        const existing = draft.heldItems[action.discardIndex];
        if (!existing) return;
        draft.heldItems.splice(action.discardIndex, 1);
        draft.heldItems.push(incoming);
        pushLog(draft, `You drop the ${existing.name} to make room for the ${incoming.name}.`);
      });
    }

    case "RESOLVE_DOOR_LOCK": {
      if (
        !state.alive ||
        state.combat ||
        isActionBlocked(state) ||
        action.segId !== state.currentSegId
      ) {
        return state;
      }
      return produce(state, (draft) => {
        const level = draft.levels[draft.activeLevel];
        const seg = level?.segments.find((s) => s.id === action.segId);
        const door = seg?.doors[action.doorIdx];
        if (!seg || !door || door.opened) return;

        const outcome = OPEN_DOOR_TABLE[action.doorRoll];
        if (outcome === "trap") {
          if (!draft.dungeonTypeKey || action.trapRoll == null) return;
          const trap = DUNGEON_TABLES[draft.dungeonTypeKey].trap[action.trapRoll];
          if (!trap) return;
          pushLog(draft, `Segment ${seg.id}: ${trap.text}`);
          resolveTrapOutcome(draft, trap, seg.id, rng);
          wakeSneakedPastMonsters(draft, seg, rng);
        } else if (outcome === "locked") {
          if (action.lockChoice === "pickLock") {
            // Thief (Advanced Class, issue #70): counts as opened regardless of whether the
            // free-pick bypass below applies -- the lock was still opened either way.
            draft.milestones.locksOpened += 1;
            // Locksmith (base Class), Burglar (Hireling, issue #25), and Thief (Advanced Class,
            // its own "Does not waste torches when Opening Locks" ability) all grant the identical
            // "no torch spent picking a lock" benefit.
            if (
              draft.className === "Locksmith" ||
              draft.hireling === "Burglar" ||
              draft.advancedClasses.includes("Thief")
            ) {
              pushLog(draft, `Segment ${seg.id}: your lockpicking skill needs no torch.`);
            } else {
              spendTorches(draft, 1, `Segment ${seg.id}: spent 1 torch to pick the lock.`, seg.id, rng);
            }
          } else if (action.lockChoice === "breakDoor") {
            pushLog(
              draft,
              `Segment ${seg.id}: broke the door open — no torch spent, but it alerts nearby monsters.`,
            );
            if (draft.className === "Lumberjack") {
              const roll = rollDie(rng);
              if (roll === 6) {
                draft.torches = Math.min(draft.torches + 1, 10);
                pushLog(draft, "Splintered wood makes for good kindling — you gain 1 torch.");
              }
            }
            wakeSneakedPastMonsters(draft, seg, rng);
          }
        }
      });
    }

    case "OPEN_DOOR": {
      if (
        !state.alive ||
        state.combat ||
        isActionBlocked(state) ||
        action.segId !== state.currentSegId
      ) {
        return state;
      }
      const classification = classifyDoorOpen(state, action.segId, action.doorIdx);

      return produce(state, (draft) => {
        const level = draft.levels[draft.activeLevel]!;
        const seg = level.segments.find((s) => s.id === action.segId)!;
        const door = seg.doors[action.doorIdx]!;

        switch (classification.kind) {
          case "reuse-final": {
            const targetLevel = draft.levels[classification.targetLevel]!;
            const finalSeg = targetLevel.segments[0]!;
            door.opened = true;
            door.childId = finalSeg.id;
            door.leadsToLevel = classification.targetLevel;
            level.doorsRemaining -= 1;
            draft.stats.doorsRemaining -= 1;
            pushLog(
              draft,
              `Segment ${seg.id} (staircase) → the same Final Room already found on Level ${classification.targetLevel + 1}`,
              "descend",
            );
            draft.activeLevel = classification.targetLevel;
            draft.currentSegId = finalSeg.id;
            draft.selectedSegId = finalSeg.id;
            break;
          }

          case "reuse-normal": {
            // A second staircase down to an already-discovered level opens onto that level's own
            // single entrance (its root segment, segments[0]) rather than a new, disconnected
            // entry point -- the same "one shared destination" shape reuse-final already gives a
            // second staircase down to an already-found Final Room. No Segments-table roll is
            // needed since nothing new is built (see DungeonMap's AUTOMATIC_KINDS).
            const targetLevel = draft.levels[classification.targetLevel]!;
            const rootSeg = targetLevel.segments[0]!;
            door.opened = true;
            door.childId = rootSeg.id;
            door.leadsToLevel = classification.targetLevel;
            level.doorsRemaining -= 1;
            draft.stats.doorsRemaining -= 1;

            pushLog(
              draft,
              `Segment ${seg.id} (staircase) → the same Level ${classification.targetLevel + 1} already found — Segment ${rootSeg.id} (${TYPE_LABELS[rootSeg.type]})`,
              "descend",
            );
            draft.activeLevel = classification.targetLevel;
            draft.currentSegId = rootSeg.id;
            draft.selectedSegId = rootSeg.id;
            break;
          }

          case "descend-final": {
            const finalLevel = makeLevel(level.depth + 1);
            finalLevel.isFinalRoomLevel = true;
            finalLevel.finalRoomPlaced = true;
            const box = boxFromCenter(0, 0, sizeFor("final", null));
            const finalId = draft.nextSegmentId;
            draft.nextSegmentId += 1;
            const finalSeg: Draft<SegmentState> = {
              id: finalId,
              type: "final",
              ...box,
              cameFromDir: null,
              flavor: "A large room with no doors. The Boss waits at its center.",
              doors: [],
              isEntrance: false,
              monsters: resolveBoss(draft.dungeonTypeKey!, rng),
            };
            finalLevel.segments.push(finalSeg);
            draft.levels.push(finalLevel);
            const targetIndex = draft.levels.length - 1;

            door.opened = true;
            door.childId = finalId;
            door.leadsToLevel = targetIndex;
            level.stairwayTarget = targetIndex;
            level.doorsRemaining -= 1;

            draft.stats.segments += 1;
            draft.stats.finalRooms += 1;
            draft.stats.doorsRemaining -= 1;

            pushLog(
              draft,
              `Segment ${seg.id} (staircase) → the Final Room — Level ${targetIndex + 1}, Segment ${finalId}`,
              "descend",
            );
            draft.activeLevel = targetIndex;
            draft.currentSegId = finalId;
            draft.selectedSegId = finalId;
            startCombatIfMonsters(draft, finalSeg, false, rng, true);
            break;
          }

          case "dead-end-final": {
            const box = placeChild(seg, door.dir, "final", level.segments);
            const finalId = draft.nextSegmentId;
            draft.nextSegmentId += 1;
            const finalSeg: Draft<SegmentState> = {
              id: finalId,
              type: "final",
              ...box,
              cameFromDir: door.dir,
              flavor: "No stairs were ever found on this level. The Boss waits at its center.",
              doors: [],
              isEntrance: false,
              monsters: resolveBoss(draft.dungeonTypeKey!, rng),
            };
            level.segments.push(finalSeg);
            level.connectors.push(buildConnector(seg, door.dir, box));

            door.opened = true;
            door.childId = finalId;
            level.doorsRemaining -= 1;
            level.finalRoomPlaced = true;
            // Bug fix: this level now holds the Final Room, same as a descend-final level does --
            // without this, isDungeonBeaten() (which requires isFinalRoomLevel) never recognized a
            // dead-end-final victory as beating the dungeon.
            level.isFinalRoomLevel = true;

            draft.stats.segments += 1;
            draft.stats.finalRooms += 1;
            draft.stats.doorsRemaining -= 1;

            pushLog(
              draft,
              `Segment ${seg.id} was the last door on Level ${draft.activeLevel + 1} — the Final Room (Segment ${finalId}), no stairs ever found`,
              "descend",
            );
            draft.currentSegId = finalId;
            draft.selectedSegId = finalId;
            startCombatIfMonsters(draft, finalSeg, false, rng, true);
            break;
          }

          case "descend-normal": {
            if (action.roll == null) throw new Error("descend-normal requires a roll");
            const row = rollSegment(seg.type, action.roll);
            const newLevel = makeLevel(level.depth + 1);
            const box = boxFromCenter(0, 0, sizeFor(row.type, null));
            const rootSeg = buildSegment(
              draft,
              row.type,
              box,
              null,
              row.doors,
              row.flavor ?? null,
              rng,
            );
            newLevel.segments.push(rootSeg);
            newLevel.doorsRemaining += row.doors;
            if (row.type === "staircase") newLevel.hasStaircase = true;
            draft.levels.push(newLevel);
            const targetIndex = draft.levels.length - 1;

            door.opened = true;
            door.childId = rootSeg.id;
            door.leadsToLevel = targetIndex;
            level.stairwayTarget = targetIndex;
            level.doorsRemaining -= 1;

            bumpStatsForNewSegment(draft.stats, row.type, row.doors);
            draft.stats.doorsRemaining -= 1;

            pushLog(
              draft,
              `Segment ${seg.id} (staircase) → descends to Level ${targetIndex + 1} — Segment ${rootSeg.id} (${TYPE_LABELS[row.type]})`,
              "descend",
            );
            draft.activeLevel = targetIndex;
            draft.currentSegId = rootSeg.id;
            draft.selectedSegId = rootSeg.id;
            finishRoomSegment(draft, rootSeg, false, rng);
            break;
          }

          case "normal": {
            if (action.roll == null) throw new Error("normal requires a roll");
            const row = rollSegment(seg.type, action.roll);
            const box = placeChild(seg, door.dir, row.type, level.segments);
            const childSeg = buildSegment(
              draft,
              row.type,
              box,
              door.dir,
              row.doors,
              row.flavor ?? null,
              rng,
            );
            level.segments.push(childSeg);
            level.connectors.push(buildConnector(seg, door.dir, box));

            door.opened = true;
            door.childId = childSeg.id;
            level.doorsRemaining += row.doors - 1;
            if (row.type === "staircase") level.hasStaircase = true;

            bumpStatsForNewSegment(draft.stats, row.type, row.doors);
            draft.stats.doorsRemaining -= 1;

            pushLog(draft, `Segment ${seg.id} → ${TYPE_LABELS[row.type]} (Segment ${childSeg.id})`);
            draft.currentSegId = childSeg.id;
            draft.selectedSegId = childSeg.id;
            finishRoomSegment(draft, childSeg, action.wasNoisy, rng);
            break;
          }
        }
      });
    }

    case "RESOLVE_ROOM_ENTRY": {
      if (!state.alive || state.combat || action.segId !== state.currentSegId) return state;
      return produce(state, (draft) => {
        const level = draft.levels[draft.activeLevel];
        const seg = level?.segments.find((s) => s.id === action.segId);
        const monsters = seg?.monsters;
        if (!seg || !monsters || seg.monstersDefeated || seg.sneakedPast) return;

        if (action.choice === "attack") {
          startCombat(draft, seg.id, monsters, false, rng);
          return;
        }

        // Dog (issue #26): "In the dungeon, it doesn't allow you to Move in Silence." The reducer
        // is the actual authority (RoomEntryPrompt.tsx mirrors this by not offering the button).
        if (draft.animals.includes("Dog")) return;

        // Move Silently: "Spend 1 torch and roll a die for each monster inside the room; if any
        // die results in a 1, the monsters see you and attack first." The room's monster count can
        // itself be a dice roll (e.g. "1d6 Goblins"), so it's resolved here rather than passed in
        // from the client, same as any other hidden roll (a fresh room's monster count included).
        if (
          !spendTorches(
            draft,
            1,
            `Segment ${seg.id}: spent 1 torch trying to move silently.`,
            seg.id,
            rng,
          )
        ) {
          return;
        }
        const monsterCount = resolveMonsterCount(monsters.count, rng);
        // Halfling: "When you roll to Move Silently, roll two dice and discard the lowest (except
        // in the Boss)" -- Boss rooms never reach this action at all (see startCombatIfMonsters's
        // direct, unconditional calls for descend-final/dead-end-final), so no extra check needed.
        const isHalfling = draft.raceName === "Halfling";
        const detected = Array.from({ length: monsterCount }, () => {
          const rolls = isHalfling ? [rollDie(rng), rollDie(rng)] : [rollDie(rng)];
          return Math.max(...rolls);
        }).some((roll) => roll === 1);
        if (detected) {
          pushLog(draft, `Segment ${seg.id}: you're spotted! The monsters attack first.`);
          startCombat(draft, seg.id, monsters, true, rng);
        } else {
          seg.sneakedPast = true;
          pushLog(draft, `Segment ${seg.id}: you slip through undetected.`);
        }
      });
    }

    case "PLAYER_ATTACK": {
      if (
        !state.alive ||
        !state.combat ||
        state.combat.outcome !== "ongoing" ||
        state.combat.pendingDamage !== null
      ) {
        return state;
      }
      return produce(state, (draft) => {
        const combat = draft.combat;
        if (!combat) return;

        if (combat.paralyzedTurns > 0) {
          combat.paralyzedTurns -= 1;
          pushLog(draft, "You are paralyzed and cannot act this turn.");
          applyMonsterTurn(draft, combat, rng);
          return;
        }

        const monster = combat.monsters.find((m) => m.id === action.targetId);
        if (!monster) return;

        const useHorn = action.useHorn === true && draft.raceName === "Rinoceroid";
        const weaponBonus = useHorn ? undefined : draft.weapon?.bonusEffect;
        if (weaponBonus?.kind === "instantKillOnRoll" && action.roll === weaponBonus.roll) {
          pushLog(
            draft,
            `Your ${draft.weapon!.name} strikes true, killing ${monster.name} instantly!`,
          );
          monster.hp = 0;
          handleMonsterDefeat(draft, combat, monster, rng);
        } else {
          const { modifier } = useHorn
            ? { modifier: 0 }
            : parseWeaponFormula(draft.weapon?.formula ?? draft.weaponFormula);
          const baseTotal = Math.max(0, action.roll + modifier);
          const weaponTotal =
            baseTotal * attackMultiplier(draft, monster, useHorn) +
            attackBonus(draft, monster, useHorn);
          const result = resolvePlayerAttack(
            monster,
            action.roll,
            weaponTotal,
            rng,
            useHorn ? [] : ignoredAbilities(draft),
          );

          if (result.selfDestructDamageToPlayer > 0) {
            // Goblinator (Advanced Class, issue #23): "Take -2 damage per Explosion."
            const explosionDamage = draft.advancedClasses.includes("Goblinator")
              ? Math.max(0, result.selfDestructDamageToPlayer - 2)
              : result.selfDestructDamageToPlayer;
            pushLog(draft, `${monster.name} explodes, dealing ${explosionDamage} damage to you!`);
            draft.hp = Math.max(0, draft.hp - explosionDamage);
          } else if (result.damageDealt > 0) {
            pushLog(draft, `You hit ${monster.name} for ${result.damageDealt} damage.`);
          } else {
            const blockedBy = result.events.find(
              (e) => e.kind === "stoneskin" || e.kind === "intangible",
            );
            pushLog(
              draft,
              blockedBy
                ? `Your attack fails to harm ${monster.name} (${blockedBy.kind}).`
                : `Your attack fails to harm ${monster.name}.`,
            );
          }
          monster.hp = Math.max(0, monster.hp - result.damageDealt);

          if (result.damageDealt > 0 && !useHorn) {
            const lifesteal = equippedEffects(draft).find((e) => e.kind === "lifesteal");
            if (lifesteal && lifesteal.kind === "lifesteal") {
              const healed = Math.min(lifesteal.amount, draft.maxHp - draft.hp);
              if (healed > 0) {
                draft.hp += healed;
                pushLog(draft, `Your weapon drains ${healed} HP from ${monster.name}.`);
              }
            }
          }

          for (const event of result.events) {
            if (event.kind === "horde") {
              const id = draft.nextMonsterId;
              draft.nextMonsterId += 1;
              combat.monsters.push({ ...HORDE_ORC, id });
              pushLog(draft, "An Orc joins the fight!");
            } else if (event.kind === "necromancy") {
              const id = draft.nextMonsterId;
              draft.nextMonsterId += 1;
              combat.monsters.push({ ...NECROMANCY_SKELETON, id });
              pushLog(draft, "A Skeleton rises to join the fight!");
            }
          }

          if (draft.hp <= 0) {
            if (trySamambroSurvival(draft, rng)) return;
            draft.alive = false;
            draft.deathCause = "combat";
            pushLog(draft, "The explosion kills you instantly.", "descend");
            leaveRemains(draft, combat.segId);
            draft.combat = null;
            return;
          }

          if (result.monsterDefeated) {
            handleMonsterDefeat(draft, combat, monster, rng);
          } else {
            for (const event of result.events) {
              if (event.kind === "firebreath") {
                if (ignoresAbility(draft, "firebreath")) {
                  pushLog(
                    draft,
                    `${monster.name} breathes fire, but your weapon shields you from the flames.`,
                  );
                } else {
                  monster.bonusDamage += 10;
                  pushLog(
                    draft,
                    `${monster.name} breathes fire, readying a scorching counterattack!`,
                  );
                }
              } else if (event.kind === "sorcery") {
                monster.bonusDamage += event.bonus;
                pushLog(
                  draft,
                  `${monster.name} casts a spell, empowering its next attack by ${event.bonus}!`,
                );
              } else if (event.kind === "deathtouch") {
                if (ignoresAbility(draft, "deathtouch")) {
                  pushLog(
                    draft,
                    `${monster.name}'s touch turns deathly cold, but your ward protects you.`,
                  );
                } else {
                  monster.deathtouchPending = true;
                  pushLog(draft, `${monster.name}'s touch turns deathly cold...`);
                }
              } else if (event.kind === "regeneration") {
                monster.hp = Math.min(monster.maxHp, monster.hp + event.amount);
                pushLog(draft, `${monster.name} regenerates ${event.amount} HP.`);
              } else if (event.kind === "paralyze") {
                if (ignoresAbility(draft, "paralyze")) {
                  pushLog(
                    draft,
                    `${monster.name} prepares a paralyzing strike, but your ward protects you.`,
                  );
                } else {
                  monster.paralyzePending = event.turns;
                  pushLog(draft, `${monster.name} prepares a paralyzing strike!`);
                }
              }
            }
          }
        }

        finishIfVictorious(draft, combat, rng);
        if (draft.combat && draft.combat.outcome === "ongoing") {
          applyMonsterTurn(draft, draft.combat, rng);
        }
      });
    }

    case "ENGULF_BODY": {
      if (
        !state.alive ||
        !state.combat ||
        state.combat.outcome !== "ongoing" ||
        state.combat.pendingDamage !== null ||
        state.raceName !== "Slimemen" ||
        state.combat.engulfableBodies <= 0
      ) {
        return state;
      }
      return produce(state, (draft) => {
        const combat = draft.combat;
        if (!combat) return;

        if (combat.paralyzedTurns > 0) {
          combat.paralyzedTurns -= 1;
          pushLog(draft, "You are paralyzed and cannot act this turn.");
          applyMonsterTurn(draft, combat, rng);
          return;
        }

        combat.engulfableBodies -= 1;
        draft.hp = draft.maxHp;
        pushLog(draft, "You engulf a fallen enemy's body, regaining all your HP.");

        if (draft.combat && draft.combat.outcome === "ongoing") {
          applyMonsterTurn(draft, draft.combat, rng);
        }
      });
    }

    case "RESOLVE_DAMAGE": {
      if (!state.alive || !state.combat || state.combat.pendingDamage === null) return state;
      return produce(state, (draft) => {
        const combat = draft.combat;
        if (!combat || combat.pendingDamage === null) return;
        const amount = combat.pendingDamage;
        combat.pendingDamage = null;

        if (action.absorbWith === "hp") {
          draft.hp = Math.max(0, draft.hp - amount);
        } else {
          const piece = draft.armor[action.absorbWith];
          if (!piece) return;
          const absorbed = Math.min(amount, piece.hp);
          piece.hp -= absorbed;
          const overflow = amount - absorbed;
          if (overflow > 0) draft.hp = Math.max(0, draft.hp - overflow);
          const label = piece.itemName ?? ARMOR_PIECE_LABELS[piece.piece];
          if (piece.hp <= 0) draft.milestones.hasHadArmorDestroyed = true; // Blacksmith (issue #70)
          pushLog(
            draft,
            piece.hp <= 0
              ? `Your ${label} absorbs ${absorbed} damage and is destroyed!`
              : `Your ${label} absorbs ${absorbed} damage (${piece.hp}/${piece.maxHp} HP left).`,
          );
        }

        if (draft.hp <= 0) {
          if (trySamambroSurvival(draft, rng)) return;
          draft.alive = false;
          draft.deathCause = "combat";
          pushLog(draft, "You fall in combat, overwhelmed by your foes.", "descend");
          leaveRemains(draft, combat.segId);
          draft.combat = null;
        }
      });
    }

    case "CAST_SPELL": {
      if (!state.alive || state.combat?.pendingDamage != null || isActionBlocked(state))
        return state;
      const spell = SPELL_TABLE_BY_KEY[action.table]?.[action.spellRoll];
      const key = spellKey(action.table, action.spellRoll);
      const remaining = state.spellUses[key] ?? 0;
      // Matched by name, not (table, roll) -- see KNOWN_CASTABLE_SPELL_NAMES's own doc comment
      // (combat.ts) for why: New Spells (issue #24) means the same name can appear under more than
      // one table (Elemental's Cold Ray/Lightning/Fireball are the identical Core spells), and
      // every New Spells effect beyond those isn't wired up to a real case here yet regardless of
      // how many uses of it the character actually has.
      if (!spell || remaining <= 0 || !KNOWN_CASTABLE_SPELL_NAMES.has(spell.name)) return state;
      const combatOnly = COMBAT_ONLY_SPELL_NAMES.has(spell.name);
      if (combatOnly && !state.combat) return state;
      if (TARGETED_SPELL_NAMES.has(spell.name) && action.targetId == null) return state;
      if (spell.name === "Teleport") {
        const destLevel = action.destLevel != null ? state.levels[action.destLevel] : undefined;
        const destSeg = destLevel?.segments.find((s) => s.id === action.destSegId);
        if (!destSeg || !isTeleportDestination(destSeg, state.combat!.segId)) return state;
      }

      return produce(state, (draft) => {
        draft.spellUses[key] = remaining - 1;
        draft.milestones.hasCastSpell = true; // Scholar (issue #70)
        const combat = draft.combat;

        if (combat && combat.paralyzedTurns > 0) {
          combat.paralyzedTurns -= 1;
          pushLog(draft, "You are paralyzed and cannot cast a spell this turn.");
          applyMonsterTurn(draft, combat, rng);
          return;
        }

        switch (spell.name) {
          case "Heal": {
            const healed = Math.min(HEAL_AMOUNT, draft.maxHp - draft.hp);
            draft.hp += healed;
            pushLog(draft, `You cast Heal, recovering ${healed} HP.`);
            break;
          }

          // Natural Cure (Nature 1, issue #61): "Recovers 12 HP" -- Heal's identical shape, just a
          // bigger fixed amount.
          case "Natural Cure": {
            const healed = Math.min(12, draft.maxHp - draft.hp);
            draft.hp += healed;
            pushLog(draft, `You cast Natural Cure, recovering ${healed} HP.`);
            break;
          }

          case "Light": {
            // "Worth a torch (does not use a hand)" -- modeled as a free torch, since this
            // codebase collapses light-source and hand-economy into the single torches count.
            const gained = Math.min(1, 10 - draft.torches);
            draft.torches += gained;
            pushLog(
              draft,
              gained > 0
                ? "You cast Light, conjuring a globe worth a torch."
                : "You cast Light, but you're already carrying the maximum 10 torches.",
            );
            break;
          }

          case "Teleport": {
            if (!combat) break;
            const destLevelIndex = action.destLevel!;
            const destSeg = draft.levels[destLevelIndex]!.segments.find(
              (s) => s.id === action.destSegId,
            )!;
            pushLog(
              draft,
              `You cast Teleport and vanish from the fight, reappearing in ${TYPE_LABELS[destSeg.type]} (Segment ${destSeg.id}, Level ${destLevelIndex + 1}).`,
              "descend",
            );
            draft.combat = null;
            draft.activeLevel = destLevelIndex;
            draft.currentSegId = destSeg.id;
            draft.selectedSegId = destSeg.id;
            rerollMonstersIfNeeded(draft, destSeg, rng);
            return; // fled -- no monster counter-turn
          }

          case "Cold Ray": {
            if (!combat) break;
            const monster = combat.monsters.find((m) => m.id === action.targetId);
            if (!monster) break;
            draft.milestones.hasCastColdRay = true; // Necromancer (issue #70)
            const result = resolveSpellDamage(monster, 4);
            monster.hp = Math.max(0, monster.hp - result.damageDealt);
            monster.skipNextAttack = true;
            pushLog(
              draft,
              result.blocked
                ? `Cold Ray fails to harm ${monster.name} (${result.blocked}), but it freezes in place.`
                : `Cold Ray strikes ${monster.name} for ${result.damageDealt} damage, freezing it in place.`,
            );
            handleMonsterDefeat(draft, combat, monster, rng);
            break;
          }

          case "Lightning": {
            if (!combat) break;
            const monster = combat.monsters.find((m) => m.id === action.targetId);
            if (!monster) break;
            const result = resolveSpellDamage(monster, 6);
            monster.hp = Math.max(0, monster.hp - result.damageDealt);
            pushLog(
              draft,
              result.blocked
                ? `Lightning fails to harm ${monster.name} (${result.blocked}).`
                : `Lightning strikes ${monster.name} for ${result.damageDealt} damage.`,
            );
            handleMonsterDefeat(draft, combat, monster, rng);
            break;
          }

          // Magic Blast (Advanced 10, issue #61): "Attack that deals 12 damage" -- Lightning's
          // identical single-target shape, just a bigger fixed amount and no freeze.
          case "Magic Blast": {
            if (!combat) break;
            const monster = combat.monsters.find((m) => m.id === action.targetId);
            if (!monster) break;
            const result = resolveSpellDamage(monster, 12);
            monster.hp = Math.max(0, monster.hp - result.damageDealt);
            pushLog(
              draft,
              result.blocked
                ? `Magic Blast fails to harm ${monster.name} (${result.blocked}).`
                : `Magic Blast strikes ${monster.name} for ${result.damageDealt} damage.`,
            );
            handleMonsterDefeat(draft, combat, monster, rng);
            break;
          }

          // Vimes (Nature 2, issue #61): "Leaves a monster without attacking for 1d6 turns" -- a
          // multi-turn version of Cold Ray's single-round freeze (see CombatMonsterState.silencedTurns).
          case "Vimes": {
            if (!combat) break;
            const monster = combat.monsters.find((m) => m.id === action.targetId);
            if (!monster) break;
            const turns = rollDie(rng);
            monster.silencedTurns = turns;
            pushLog(draft, `You cast Vimes, silencing ${monster.name} for ${turns} turns.`);
            break;
          }

          // Paralyze (Advanced 5, issue #61): "Leave all monsters in a room without attacking for
          // 2 turns" -- Vimes' identical mechanism, room-wide and at a fixed duration.
          case "Paralyze": {
            if (!combat) break;
            pushLog(draft, "You cast Paralyze, freezing every monster in the room for 2 turns.");
            for (const monster of combat.monsters) monster.silencedTurns = 2;
            break;
          }

          // Ethereal Body (Death 1 / Advanced 12, issue #61): "Until the end of the fight, all
          // damage you take is reduced by 1 point" -- doesn't stack from a second cast.
          case "Ethereal Body": {
            if (!combat) break;
            combat.damageReduction = Math.max(combat.damageReduction, 1);
            pushLog(draft, "You cast Ethereal Body, dulling every blow against you.");
            break;
          }

          // Magic Shield (Advanced 8, issue #61): "it can absorb 4 damage points. Can cast more
          // than one" -- each cast is its own independently-depleting pool (see applyMonsterTurn).
          case "Magic Shield": {
            if (!combat) break;
            combat.shields.push(4);
            pushLog(draft, "You cast Magic Shield, conjuring a barrier that can absorb 4 damage.");
            break;
          }

          // Absorb Soul (Death 2, issue #61): "After a fight, recover 5 HP for each monster
          // killed" -- a deferred-to-victory trigger resolved in finishIfVictorious().
          case "Absorb Soul": {
            if (!combat) break;
            combat.absorbSoulActive = true;
            pushLog(draft, "You cast Absorb Soul -- victory here will restore your HP.");
            break;
          }

          // Fire of the Dead (Death 4, issue #61): "After a fight, you get 2 torches for every
          // monster killed" -- same deferred-to-victory shape as Absorb Soul above.
          case "Fire of the Dead": {
            if (!combat) break;
            combat.fireOfTheDeadActive = true;
            pushLog(draft, "You cast Fire of the Dead -- victory here will grant you torches.");
            break;
          }

          case "Fireball": {
            if (!combat) break;
            pushLog(draft, "You cast Fireball, engulfing the room in flame.");
            for (const monster of [...combat.monsters]) {
              const result = resolveSpellDamage(monster, 5);
              monster.hp = Math.max(0, monster.hp - result.damageDealt);
              if (result.blocked) {
                pushLog(draft, `${monster.name} is unharmed (${result.blocked}).`);
              } else if (result.damageDealt > 0) {
                pushLog(draft, `${monster.name} takes ${result.damageDealt} fire damage.`);
              }
              handleMonsterDefeat(draft, combat, monster, rng);
            }
            break;
          }

          // Insect Rain (Nature 6 / Advanced 2, issue #61): "Attack that deals 7 damage to all
          // opponents" -- Fireball's identical room-wide shape, just a different fixed amount.
          case "Insect Rain": {
            if (!combat) break;
            pushLog(draft, "You cast Insect Rain, swarming the room with biting insects.");
            for (const monster of [...combat.monsters]) {
              const result = resolveSpellDamage(monster, 7);
              monster.hp = Math.max(0, monster.hp - result.damageDealt);
              if (result.blocked) {
                pushLog(draft, `${monster.name} is unharmed (${result.blocked}).`);
              } else if (result.damageDealt > 0) {
                pushLog(draft, `${monster.name} takes ${result.damageDealt} damage.`);
              }
              handleMonsterDefeat(draft, combat, monster, rng);
            }
            break;
          }

          // Banish the Dead (Death 3, issue #61): "Destroy any Undead that are in the same area
          // as you" -- filters the room's Undead and destroys each outright, bypassing the normal
          // damage math and the Undead ability's own revival roll (see handleMonsterDefeat).
          case "Banish the Dead": {
            if (!combat) break;
            const undead = combat.monsters.filter((m) => m.abilities.includes("undead"));
            if (undead.length === 0) {
              pushLog(draft, "You cast Banish the Dead, but no Undead linger here.");
              break;
            }
            pushLog(draft, "You cast Banish the Dead, destroying every Undead in the room.");
            for (const monster of undead) {
              monster.hp = 0;
              handleMonsterDefeat(draft, combat, monster, rng, true);
            }
            break;
          }
        }

        if (draft.combat) {
          finishIfVictorious(draft, draft.combat, rng);
          if (draft.combat && draft.combat.outcome === "ongoing") {
            applyMonsterTurn(draft, draft.combat, rng);
          }
        }
      });
    }

    case "OPEN_TREASURE": {
      if (
        !state.alive ||
        state.treasures <= 0 ||
        !state.dungeonTypeKey ||
        state.combat?.pendingDamage != null ||
        isActionBlocked(state)
      ) {
        return state;
      }
      const outcome = DUNGEON_TABLES[state.dungeonTypeKey].treasure[action.roll];
      if (!outcome) return state;

      return produce(state, (draft) => {
        const combat = draft.combat;

        if (combat && combat.paralyzedTurns > 0) {
          combat.paralyzedTurns -= 1;
          pushLog(draft, "You are paralyzed and cannot examine the treasure this turn.");
          applyMonsterTurn(draft, combat, rng);
          return;
        }

        draft.treasures -= 1;

        switch (outcome.effect.kind) {
          case "heldValue": {
            addHeldItem(
              draft,
              { name: outcome.effect.name, worth: outcome.effect.amount },
              `Treasure: ${outcome.text}`,
            );
            break;
          }
          case "heldValueRoll": {
            let sum = 0;
            for (let i = 0; i < outcome.effect.dice; i++) sum += rollDie(rng);
            const worth = sum * outcome.effect.multiplier;
            addHeldItem(
              draft,
              { name: outcome.effect.name, worth },
              `Treasure: ${outcome.text} (worth ${worth} coins)`,
            );
            break;
          }
          case "healAll": {
            // Ogre (New Races, issue #60): "Cannot use potions" -- the Treasure is still spent
            // (already decremented above), but instead of vanishing outright it becomes a sellable
            // HeldItem (issue #83), same flat placeholder worth every Ogre-unusable potion/scroll
            // outcome uses.
            if (draft.raceName === "Ogre") {
              addHeldItem(
                draft,
                { name: "Health Potion", worth: OGRE_UNUSABLE_TREASURE_WORTH },
                `Treasure: ${outcome.text} Ogres cannot use potions -- sold instead.`,
              );
              break;
            }
            const healed = draft.maxHp - draft.hp;
            draft.hp = draft.maxHp;
            pushLog(draft, `Treasure: ${outcome.text}${healed > 0 ? ` (+${healed} HP)` : ""}`);
            break;
          }
          case "restoreAllSpells": {
            if (draft.raceName === "Ogre") {
              addHeldItem(
                draft,
                { name: "Mana Potion", worth: OGRE_UNUSABLE_TREASURE_WORTH },
                `Treasure: ${outcome.text} Ogres cannot use potions -- sold instead.`,
              );
              break;
            }
            // Reads the persisted ceiling directly (issue #75) rather than a client-computed value
            // passed through the action -- the same fix `rest()` needed, and for the same reason.
            draft.spellUses = { ...draft.maxSpellUses };
            pushLog(draft, `Treasure: ${outcome.text}`);
            break;
          }
          case "randomSpell": {
            // Ogre (New Races, issue #60): "Cannot use scrolls" -- the scroll is still spent, but
            // instead of vanishing it becomes a sellable HeldItem (issue #83).
            if (draft.raceName === "Ogre") {
              addHeldItem(
                draft,
                { name: "Magic Scroll", worth: OGRE_UNUSABLE_TREASURE_WORTH },
                `Treasure: ${outcome.text} Ogres cannot use scrolls -- sold instead.`,
              );
              break;
            }
            const spellRoll = rollDie(rng);
            const key = spellKey("basic", spellRoll);
            draft.spellUses[key] = (draft.spellUses[key] ?? 0) + 1;
            // Raises the ceiling too (issue #75), same as every other spell-granting site.
            draft.maxSpellUses[key] = (draft.maxSpellUses[key] ?? 0) + 1;
            const spellName = SPELL_TABLE[spellRoll]?.name ?? "a spell";
            draft.milestones.hasCastSpell = true; // Scholar (issue #70): "used a spell or scroll"
            pushLog(draft, `Treasure: ${outcome.text} — learned ${spellName}!`);
            break;
          }
          case "flavor": {
            pushLog(draft, `Treasure: ${outcome.text}`);
            break;
          }
          case "rerollColumn": {
            const roll = rollDie(rng);
            if (outcome.effect.column === "wonders") {
              resolveWonder(draft, DUNGEON_TABLES[draft.dungeonTypeKey!].wonders[roll]!, rng);
            } else if (outcome.effect.column === "magicItem") {
              resolveMagicItem(draft, DUNGEON_TABLES[draft.dungeonTypeKey!].magicItem[roll]!, rng);
            } else {
              const base = DUNGEON_TABLES[draft.dungeonTypeKey!].weapon[roll]!;
              draft.spareWeapons.push({
                name: base.name,
                formula: base.formula,
                twoHanded: base.twoHanded,
              });
              pushLog(draft, `Treasure: You find a ${base.name} (${base.formula} damage).`);
            }
            break;
          }
        }

        if (draft.combat) {
          applyMonsterTurn(draft, draft.combat, rng);
        }
      });
    }

    case "RESUME_DUNGEON": {
      // Immer deep-freezes everything it produces; action.dungeon is the frozen output of
      // some earlier produce() call (possibly still sitting in a caller's pendingDungeons
      // list). Deep-cloning it before handing pieces to a *new* draft avoids both mutating
      // frozen data (which throws) and aliasing that old snapshot's objects going forward.
      const persisted = structuredClone(action.dungeon);
      return produce(
        createInitialDungeonState(
          action.torches,
          action.hp,
          action.weaponFormula,
          action.spellUses,
          action.characterName,
          0,
          0,
          0,
          [],
          action.maxHp,
          [],
          null,
          0,
          0,
          action.raceName,
          action.className,
          {},
          {},
          [],
          [],
          null,
          [],
          createInitialMilestones(),
          action.maxSpellUses,
          [],
          [],
        ),
        (draft) => {
          restoreMapFromPersisted(
            draft,
            persisted,
            rng,
            "A new adventurer takes up the fallen's path.",
            true,
          );
        },
      );
    }

    case "RETURN_TO_DUNGEON": {
      // Same aliasing/freezing concern as RESUME_DUNGEON above.
      const persisted = structuredClone(action.dungeon);
      return produce(
        createInitialDungeonState(
          action.torches,
          action.hp,
          action.weaponFormula,
          action.spellUses,
          action.characterName,
          action.coins,
          action.treasures,
          action.keys,
          action.heldItems,
          action.maxHp,
          action.armor,
          action.weapon,
          action.monsterKills,
          action.bossKills,
          action.raceName,
          action.className,
          action.killsByName,
          action.killsByAbility,
          action.spareWeapons,
          action.advancedClasses,
          action.hireling,
          action.animals,
          action.milestones,
          action.maxSpellUses,
          action.buildings,
          action.spareArmor,
        ),
        (draft) => {
          restoreMapFromPersisted(draft, persisted, rng, "You return to the dungeon.", false);
        },
      );
    }

    default:
      return state;
  }
}
