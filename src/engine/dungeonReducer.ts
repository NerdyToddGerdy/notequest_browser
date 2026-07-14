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
  type ItemEffect,
  type MagicItemEntry,
  type MonsterAbility,
  type MonsterTemplate,
  type RoomContentReward,
  type TrapEntry,
  type WonderEntry,
} from "../data/dungeonTables.ts";
import { SPELL_TABLE } from "../data/spells.ts";
import {
  boxFromCenter,
  buildConnector,
  classifyDoorOpen,
  assignDirections,
  placeChild,
  placeIslandRoot,
  resolveBoss,
  resolveRoomExtras,
  rollSegment,
  sizeFor,
} from "./dungeon.ts";
import { rollDie } from "./dice.ts";
import {
  checkUndeadRevival,
  HEAL_AMOUNT,
  HORDE_ORC,
  NECROMANCY_SKELETON,
  parseWeaponFormula,
  resolveMonsterCount,
  resolvePlayerAttack,
  resolveSpellDamage,
  rollLoot,
  spawnMonsters,
} from "./combat.ts";
import {
  createInitialDungeonState,
  makeLevel,
  type CombatMonsterState,
  type CombatState,
  type DungeonAction,
  type DungeonState,
  type DungeonStats,
  type SegmentState,
} from "./dungeonState.ts";
import type { RNG } from "./rng.ts";

function bumpStatsForNewSegment(stats: Draft<DungeonStats>, type: SegmentType, doors: number): void {
  stats.segments += 1;
  if (type === "corridor") stats.corridors += 1;
  else if (type === "staircase") stats.staircases += 1;
  else if (type !== "final") stats.rooms += 1;
  stats.doorsRemaining += doors;
}

function pushLog(draft: Draft<DungeonState>, message: string, variant: "normal" | "descend" = "normal"): void {
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
    !draft.weapon
  ) {
    return;
  }
  const level = draft.levels[draft.activeLevel];
  const seg = level?.segments.find((s) => s.id === segId) ?? level?.segments.find((s) => s.isEntrance);
  if (!seg) return;
  if (seg.remains) {
    seg.remains.names.push(draft.characterName);
    seg.remains.coins += draft.coins;
    seg.remains.treasures += draft.treasures;
    seg.remains.keys += draft.keys;
    seg.remains.heldItems.push(...draft.heldItems);
    seg.remains.armor.push(...draft.armor);
    if (!seg.remains.weapon) seg.remains.weapon = draft.weapon;
  } else {
    seg.remains = {
      names: [draft.characterName],
      coins: draft.coins,
      treasures: draft.treasures,
      keys: draft.keys,
      heldItems: [...draft.heldItems],
      armor: [...draft.armor],
      weapon: draft.weapon,
    };
  }
}

/** Spends `cost` torches, logging `message`; if there aren't enough, the Darkness kills the character instead. */
function spendTorches(draft: Draft<DungeonState>, cost: number, message: string, segId: number | null = null): boolean {
  if (draft.torches < cost) {
    if (draft.className === "Miner") {
      // "If you run out of torches, you can leave the dungeon" -- the Darkness spares a Miner
      // outright rather than killing them; the action they were attempting still fails (they're
      // still out of torches), but they're free to use the existing Retreat to Town button.
      pushLog(draft, "You're out of torches, but a lifetime underground taught you the way out. Retreat to Town before the Darkness finds you.");
      return false;
    }
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
  const extras = draft.dungeonTypeKey ? resolveRoomExtras(type, draft.dungeonTypeKey, rng) : undefined;
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
  };
  pushLog(
    draft,
    isBoss
      ? `Segment ${segId}: the Dungeon Boss reveals itself!`
      : `Segment ${segId}: ${monsters.length} monster${monsters.length === 1 ? "" : "s"} attack!`,
  );
  if (wasNoisy && draft.combat) {
    pushLog(draft, "The noise gave you away — the monsters strike first!");
    applyMonsterTurn(draft, draft.combat);
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
function applyTrapEffect(draft: Draft<DungeonState>, trap: TrapEntry, segId: number, rng: RNG): void {
  if (!draft.alive) return; // a torchCost Darkness death already ended the run this same dispatch

  if (trap.bladeTrap) {
    if (rollDie(rng) === 1) {
      draft.hp = 0;
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
function resolveTrapOutcome(draft: Draft<DungeonState>, trap: TrapEntry, segId: number, rng: RNG): void {
  const immunityIndex = draft.armor.findIndex((piece) => piece.effect?.kind === "trapImmunity");
  if (immunityIndex !== -1) {
    const item = draft.armor[immunityIndex]!;
    draft.armor.splice(immunityIndex, 1);
    pushLog(draft, `Your ${item.itemName ?? "trinket"} shields you from the trap and crumbles to dust.`);
    return;
  }
  if (trap.torchCost) {
    spendTorches(draft, trap.torchCost, `Spent ${trap.torchCost} torch${trap.torchCost > 1 ? "es" : ""} climbing out.`, segId);
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
function attackBonus(draft: Draft<DungeonState>, monster: Draft<CombatMonsterState>, isHorn = false): number {
  let bonus = draft.combat?.playerDamageBonus ?? 0;
  if (draft.className === "Grave Digger" && monster.abilities.includes("undead")) {
    bonus += 2;
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
function attackMultiplier(draft: Draft<DungeonState>, monster: Draft<CombatMonsterState>, isHorn = false): number {
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
  return equippedEffects(draft).some((effect) => effect.kind === "ignoresMonsterAbility" && effect.ability === ability);
}

/** Every monster ability ignored by an equipped item, e.g. Boatman's Oar bypassing Intangible's
 * damage-parity block -- fed into `resolvePlayerAttack`'s defensive-ability filter. */
function ignoredAbilities(draft: Draft<DungeonState>): MonsterAbility[] {
  return equippedEffects(draft)
    .filter((effect): effect is Extract<ItemEffect, { kind: "ignoresMonsterAbility" }> => effect.kind === "ignoresMonsterAbility")
    .map((effect) => effect.ability);
}

/** True once at least one equipped armor piece can actually absorb something. */
function hasUsableArmor(draft: Draft<DungeonState>): boolean {
  return draft.armor.some((piece) => piece.hp > 0);
}

function applyMonsterTurn(draft: Draft<DungeonState>, combat: Draft<CombatState>): void {
  // Poison: "All damage from this creature cannot be absorbed by armor or other means" -- tallied
  // apart from every other monster's damage, which the player may still choose to absorb.
  let poisonDamage = 0;
  let absorbableDamage = 0;
  let deathtouchKill = false;
  let paralyzeTurns = 0;
  for (const monster of combat.monsters) {
    if (!monster.skipNextAttack) {
      const dmg = monster.damage + monster.bonusDamage;
      if (monster.abilities.includes("poison")) {
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
    draft.alive = false;
    draft.deathCause = "combat";
    pushLog(draft, "A deathly touch stops your heart instantly.", "descend");
    leaveRemains(draft, combat.segId);
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

  if (draft.hp > 0 && absorbableDamage > 0) {
    // "Reduce this value from your HP (or armor's HP, if you're using one -- your call)": with
    // usable armor equipped, defer to RESOLVE_DAMAGE instead of subtracting HP immediately.
    if (hasUsableArmor(draft)) {
      combat.pendingDamage = absorbableDamage;
      pushLog(draft, `The monsters strike for ${absorbableDamage} damage -- choose what absorbs it.`);
      return;
    }
    draft.hp = Math.max(0, draft.hp - absorbableDamage);
    pushLog(draft, `The monsters strike back for ${absorbableDamage} damage.`);
  }
  if (draft.hp <= 0) {
    draft.alive = false;
    draft.deathCause = "combat";
    pushLog(draft, "You fall in combat, overwhelmed by your foes.", "descend");
    leaveRemains(draft, combat.segId);
  }
}

/** Removes a monster reduced to 0 HP, resolving Undead revival and queuing a Loot roll first. */
function handleMonsterDefeat(
  draft: Draft<DungeonState>,
  combat: Draft<CombatState>,
  monster: Draft<CombatMonsterState>,
  rng: RNG,
): void {
  if (monster.hp > 0) return;
  const revived = !ignoresAbility(draft, "undead") && checkUndeadRevival(monster, rng);
  if (revived) {
    monster.hp = 1;
    pushLog(draft, `${monster.name} rises again with 1 HP!`);
  } else {
    if (monster.abilities.includes("loot")) combat.pendingLootRolls += 1;
    combat.monsters = combat.monsters.filter((m) => m.id !== monster.id);
    draft.monsterKills += 1;
    if (combat.isBoss) draft.bossKills += 1;
    pushLog(draft, `${monster.name} is defeated!`);

    combat.engulfableBodies += 1; // Slimemen's engulf-for-full-HP -- no Undead exception in the rulebook
    if (draft.className === "Cook" && !monster.abilities.includes("undead")) {
      draft.coins += 1;
      pushLog(draft, "Cook's instincts: +1 coin from the kill.");
    }
  }
}

/** If every monster is gone, resolves Loot (or the Boss's flat 2d6 Treasures), marks the room cleared, and closes out combat. */
function finishIfVictorious(draft: Draft<DungeonState>, combat: Draft<CombatState>, rng: RNG): void {
  if (combat.monsters.length > 0) return;
  const level = draft.levels[draft.activeLevel];
  const seg = level?.segments.find((s) => s.id === combat.segId);
  if (seg) seg.monstersDefeated = true;

  if (combat.isBoss) {
    const treasures = rollDie(rng) + rollDie(rng);
    draft.treasures += treasures;
    pushLog(draft, `The Boss falls! You find ${treasures} Treasures among the remains.`);
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
  draft.selectedSegId = persisted.selectedSegId;
  draft.stats = persisted.stats;
  draft.log = persisted.log;
  pushLog(draft, logMessage, "descend");

  // Per the rulebook: returning to a dungeon means any room still holding monsters has them
  // recover to full health. There's at most one such room -- wherever the previous session's
  // fight was interrupted, since every other room's combat had already resolved (won) before
  // its doors could be opened further.
  const oldCombat = persisted.combat;
  if (oldCombat) {
    const level = draft.levels[draft.activeLevel];
    const seg = level?.segments.find((s) => s.id === oldCombat.segId);
    if (seg?.monsters) {
      draft.selectedSegId = seg.id;
      startCombat(draft, seg.id, seg.monsters, false, rng, oldCombat.isBoss);
    }
  }

  if (resetToEntrance) {
    draft.activeLevel = 0;
    draft.selectedSegId = draft.levels[0]?.segments[0]?.id ?? null;
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
      if (oldCombat && seg.id === oldCombat.segId) continue;
      if (seg.monsters && !seg.monstersDefeated) continue;
      seg.needsMonsterReroll = true;
    }
  }
  const current = draft.levels[draft.activeLevel]?.segments.find((s) => s.id === draft.selectedSegId);
  if (current) rerollMonstersIfNeeded(draft, current, rng);
}

/** Rolls a fresh Monster table entry for a room flagged `needsMonsterReroll` (see
 * `restoreMapFromPersisted`), replacing whatever was there (empty or already-cleared) and
 * starting combat if the roll produced one -- the moment the player actually looks at the room is
 * this app's closest equivalent to the rulebook's "each empty room you enter." */
function rerollMonstersIfNeeded(draft: Draft<DungeonState>, seg: Draft<SegmentState>, rng: RNG): void {
  if (!seg.needsMonsterReroll) return;
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
}

/** A Wonder either grants its own HP-bearing item (Jester Hat, 2 HP) or a standing ability with
 * nothing else to attach to (Amulet of the Dead) -- both become a `draft.armor` entry (0 HP for
 * the latter, so it's never offered as a damage-absorption choice but still equipped/trackable and
 * checked by whichever system its effect concerns), except `combatDamageBonus`/`grantsTorches`/
 * `randomSpell`, which apply immediately (to the active fight, the torch count, or spellUses
 * respectively) rather than lingering as an item. */
function resolveWonder(draft: Draft<DungeonState>, entry: WonderEntry, rng: RNG): void {
  if (entry.grantsHp !== undefined) {
    draft.armor.push({ piece: "wonderItem", hp: entry.grantsHp, maxHp: entry.grantsHp, itemName: entry.name, effect: entry.effect });
  } else if (entry.effect.kind === "combatDamageBonus") {
    if (draft.combat) draft.combat.playerDamageBonus += entry.effect.amount;
  } else if (entry.effect.kind === "grantsTorches") {
    const gained = Math.min(entry.effect.amount, 10 - draft.torches);
    draft.torches += gained;
  } else if (entry.effect.kind === "randomSpell") {
    const spellRoll = rollDie(rng);
    draft.spellUses[spellRoll] = (draft.spellUses[spellRoll] ?? 0) + 1;
    const spellName = SPELL_TABLE[spellRoll]?.name ?? "a spell";
    pushLog(draft, `Treasure: ${entry.text} — learned ${spellName}!`);
    return;
  } else if (entry.effect.kind !== "flavor") {
    draft.armor.push({ piece: "wonderItem", hp: 0, maxHp: 0, itemName: entry.name, effect: entry.effect });
  }
  pushLog(draft, `Treasure: ${entry.text}`);
}

/** A Magic Item is always "[Armor] of X" or "[Weapon] of X" -- roll the base table for the
 * concrete piece/weapon, then layer the named item's bonus on top (an armor bonus is baked into
 * the piece's HP if it's `extraHp`, or attached as `effect` for anything else the piece grants;
 * a weapon bonus always rides along as `bonusEffect`, applied during combat). */
function resolveMagicItem(draft: Draft<DungeonState>, entry: MagicItemEntry, rng: RNG): void {
  if (entry.grants === "armor") {
    const roll = rollDie(rng);
    const base = ARMOR_TABLE[roll]!;
    const bonusHp = entry.effect.kind === "extraHp" ? entry.effect.amount : 0;
    const maxHp = Math.max(0, base.maxHp + bonusHp);
    draft.armor.push({
      piece: base.piece,
      hp: maxHp,
      maxHp,
      itemName: entry.name,
      effect: entry.effect.kind === "extraHp" ? undefined : entry.effect,
    });
    pushLog(draft, `Treasure: ${entry.text} (${ARMOR_PIECE_LABELS[base.piece]}, ${maxHp} HP)`);
  } else if (entry.fixedFormula) {
    draft.weapon = {
      name: entry.name,
      formula: entry.fixedFormula,
      bonusEffect: entry.effect.kind !== "flavor" ? entry.effect : undefined,
    };
    pushLog(draft, `Treasure: ${entry.text} (${entry.fixedFormula} damage)`);
  } else {
    const roll = rollDie(rng);
    const base = DUNGEON_TABLES[draft.dungeonTypeKey!].weapon[roll]!;
    draft.weapon = {
      name: base.name,
      formula: base.formula,
      twoHanded: base.twoHanded,
      bonusEffect: entry.effect.kind !== "flavor" ? entry.effect : undefined,
    };
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
function applyRoomContentReward(draft: Draft<DungeonState>, reward: RoomContentReward, rng: RNG): void {
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
      const spellNames: string[] = [];
      for (let i = 0; i < count; i++) {
        const spellRoll = rollDie(rng);
        draft.spellUses[spellRoll] = (draft.spellUses[spellRoll] ?? 0) + 1;
        spellNames.push(SPELL_TABLE[spellRoll]?.name ?? "a spell");
      }
      pushLog(draft, `You find ${count} Magic Scroll${count === 1 ? "" : "s"}, learning ${spellNames.join(", ")}.`);
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
 * any) applies first, then combat starts if it rolled monsters -- matching the natural order of
 * noticing what's in the room before whatever's in it notices you back. */
function finishRoomSegment(
  draft: Draft<DungeonState>,
  seg: { id: number; monsters?: MonsterTemplate; roomContent?: { reward?: RoomContentReward } },
  wasNoisy: boolean,
  rng: RNG,
): void {
  if (seg.roomContent?.reward) {
    applyRoomContentReward(draft, seg.roomContent.reward, rng);
  }
  startCombatIfMonsters(draft, seg, wasNoisy, rng);
}

export function dungeonReducer(state: DungeonState, action: DungeonAction, rng: RNG = Math.random): DungeonState {
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
        draft.stats = { segments: 0, corridors: 0, rooms: 0, staircases: 0, doorsRemaining: 0, finalRooms: 0 };
        draft.torches -= 1;
        pushLog(draft, "Entering the dungeon costs 1 torch to light the way.");

        const level = draft.levels[0]!;
        const box = boxFromCenter(0, 0, sizeFor(dtype.entranceType, null));
        const entrance = buildSegment(draft, dtype.entranceType, box, null, dtype.doors, null, rng, true);
        level.segments.push(entrance);
        level.doorsRemaining += dtype.doors;
        bumpStatsForNewSegment(draft.stats, dtype.entranceType, dtype.doors);
        finishRoomSegment(draft, entrance, false, rng);
      });
    }

    case "SELECT_SEGMENT": {
      if (state.selectedSegId === action.segId) return state;
      return produce(state, (draft) => {
        draft.selectedSegId = action.segId;
        if (draft.combat) return;
        const level = draft.levels[draft.activeLevel];
        const seg = level?.segments.find((s) => s.id === action.segId);
        if (seg) rerollMonstersIfNeeded(draft, seg, rng);
      });
    }

    case "SWITCH_LEVEL": {
      if (state.combat) return state;
      if (state.activeLevel === action.levelIndex) return state;
      return produce(state, (draft) => {
        draft.activeLevel = action.levelIndex;
        draft.selectedSegId = null;
      });
    }

    case "ROLL_SECRET_PASSAGE": {
      if (!state.alive || state.combat) return state;
      return produce(state, (draft) => {
        const level = draft.levels[draft.activeLevel];
        const seg = level?.segments.find((s) => s.id === action.segId);
        if (!seg || seg.secretPassageSearched) return;

        if (
          !spendTorches(draft, 1, `Segment ${seg.id}: spent 1 torch searching for a secret passage.`, seg.id)
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
          }
        }
      });
    }

    case "ROLL_CHEST": {
      if (!state.alive || state.combat) return state;
      return produce(state, (draft) => {
        const level = draft.levels[draft.activeLevel];
        const seg = level?.segments.find((s) => s.id === action.segId);
        if (!seg || seg.chestOpened) return;
        const chestAvailable =
          !!seg.roomContent?.hasChest || seg.secretPassageResult === "You have found a hidden Chest!";
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
            }
          }
          return;
        }

        const hasDoubleChestCoins = draft.armor.some((piece) => piece.effect?.kind === "doubleChestCoins");
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
      if (!state.alive || state.combat) return state;
      return produce(state, (draft) => {
        const level = draft.levels[draft.activeLevel];
        const seg = level?.segments.find((s) => s.id === action.segId);
        if (!seg?.remains) return;
        const { names, coins, treasures, keys, heldItems, armor, weapon } = seg.remains;
        draft.coins += coins;
        draft.treasures += treasures;
        draft.keys += keys;
        draft.heldItems.push(...heldItems);
        draft.armor.push(...armor);
        if (weapon) draft.weapon = weapon;
        const itemsPart = heldItems.length > 0 ? `, and ${heldItems.map((item) => item.name).join(", ")}` : "";
        pushLog(
          draft,
          `Segment ${seg.id}: recovered ${coins} coin${coins === 1 ? "" : "s"}, ${treasures} Treasure${treasures === 1 ? "" : "s"}, and ${keys} Key${keys === 1 ? "" : "s"}${itemsPart} from the remains of ${names.join(", ")}.`,
        );
        seg.remains = null;
      });
    }

    case "RESOLVE_DOOR_LOCK": {
      if (!state.alive || state.combat) return state;
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
        } else if (outcome === "locked") {
          if (action.lockChoice === "pickLock") {
            if (draft.className === "Locksmith") {
              pushLog(draft, `Segment ${seg.id}: your lockpicking skill needs no torch.`);
            } else {
              spendTorches(draft, 1, `Segment ${seg.id}: spent 1 torch to pick the lock.`, seg.id);
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
          }
        }
      });
    }

    case "OPEN_DOOR": {
      if (!state.alive || state.combat) return state;
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
            draft.selectedSegId = null;
            break;
          }

          case "reuse-normal": {
            if (action.roll == null) throw new Error("reuse-normal requires a roll");
            const row = rollSegment(seg.type, action.roll);
            const targetLevel = draft.levels[classification.targetLevel]!;
            const box = placeIslandRoot(targetLevel.segments, row.type);
            const island = buildSegment(draft, row.type, box, null, row.doors, row.flavor ?? null, rng);
            targetLevel.segments.push(island);
            targetLevel.doorsRemaining += row.doors;
            if (row.type === "staircase") targetLevel.hasStaircase = true;
            bumpStatsForNewSegment(draft.stats, row.type, row.doors);

            door.opened = true;
            door.childId = island.id;
            door.leadsToLevel = classification.targetLevel;
            level.doorsRemaining -= 1;
            draft.stats.doorsRemaining -= 1;

            pushLog(
              draft,
              `Segment ${seg.id} (staircase) → joins the existing Level ${classification.targetLevel + 1} as a new entry point — Segment ${island.id} (${TYPE_LABELS[row.type]})`,
              "descend",
            );
            draft.activeLevel = classification.targetLevel;
            draft.selectedSegId = null;
            finishRoomSegment(draft, island, false, rng);
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
            draft.selectedSegId = null;
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

            draft.stats.segments += 1;
            draft.stats.finalRooms += 1;
            draft.stats.doorsRemaining -= 1;

            pushLog(
              draft,
              `Segment ${seg.id} was the last door on Level ${draft.activeLevel + 1} — the Final Room (Segment ${finalId}), no stairs ever found`,
              "descend",
            );
            startCombatIfMonsters(draft, finalSeg, false, rng, true);
            break;
          }

          case "descend-normal": {
            if (action.roll == null) throw new Error("descend-normal requires a roll");
            const row = rollSegment(seg.type, action.roll);
            const newLevel = makeLevel(level.depth + 1);
            const box = boxFromCenter(0, 0, sizeFor(row.type, null));
            const rootSeg = buildSegment(draft, row.type, box, null, row.doors, row.flavor ?? null, rng);
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
            draft.selectedSegId = null;
            finishRoomSegment(draft, rootSeg, false, rng);
            break;
          }

          case "normal": {
            if (action.roll == null) throw new Error("normal requires a roll");
            const row = rollSegment(seg.type, action.roll);
            const box = placeChild(seg, door.dir, row.type, level.segments);
            const childSeg = buildSegment(draft, row.type, box, door.dir, row.doors, row.flavor ?? null, rng);
            level.segments.push(childSeg);
            level.connectors.push(buildConnector(seg, door.dir, box));

            door.opened = true;
            door.childId = childSeg.id;
            level.doorsRemaining += row.doors - 1;
            if (row.type === "staircase") level.hasStaircase = true;

            bumpStatsForNewSegment(draft.stats, row.type, row.doors);
            draft.stats.doorsRemaining -= 1;

            pushLog(draft, `Segment ${seg.id} → ${TYPE_LABELS[row.type]} (Segment ${childSeg.id})`);
            finishRoomSegment(draft, childSeg, action.wasNoisy, rng);
            break;
          }
        }
      });
    }

    case "PLAYER_ATTACK": {
      if (!state.alive || !state.combat || state.combat.outcome !== "ongoing" || state.combat.pendingDamage !== null) {
        return state;
      }
      return produce(state, (draft) => {
        const combat = draft.combat;
        if (!combat) return;

        if (combat.paralyzedTurns > 0) {
          combat.paralyzedTurns -= 1;
          pushLog(draft, "You are paralyzed and cannot act this turn.");
          applyMonsterTurn(draft, combat);
          return;
        }

        const monster = combat.monsters.find((m) => m.id === action.targetId);
        if (!monster) return;

        const useHorn = action.useHorn === true && draft.raceName === "Rinoceroid";
        const weaponBonus = useHorn ? undefined : draft.weapon?.bonusEffect;
        if (weaponBonus?.kind === "instantKillOnRoll" && action.roll === weaponBonus.roll) {
          pushLog(draft, `Your ${draft.weapon!.name} strikes true, killing ${monster.name} instantly!`);
          monster.hp = 0;
          handleMonsterDefeat(draft, combat, monster, rng);
        } else {
          const { modifier } = useHorn
            ? { modifier: 0 }
            : parseWeaponFormula(draft.weapon?.formula ?? draft.weaponFormula);
          const baseTotal = Math.max(0, action.roll + modifier);
          const weaponTotal =
            baseTotal * attackMultiplier(draft, monster, useHorn) + attackBonus(draft, monster, useHorn);
          const result = resolvePlayerAttack(monster, action.roll, weaponTotal, rng, useHorn ? [] : ignoredAbilities(draft));

          if (result.selfDestructDamageToPlayer > 0) {
            pushLog(draft, `${monster.name} explodes, dealing ${result.selfDestructDamageToPlayer} damage to you!`);
            draft.hp = Math.max(0, draft.hp - result.selfDestructDamageToPlayer);
          } else if (result.damageDealt > 0) {
            pushLog(draft, `You hit ${monster.name} for ${result.damageDealt} damage.`);
          } else {
            const blockedBy = result.events.find((e) => e.kind === "stoneskin" || e.kind === "intangible");
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
            draft.alive = false;
            draft.deathCause = "combat";
            pushLog(draft, "The explosion kills you instantly.", "descend");
            leaveRemains(draft, combat.segId);
            return;
          }

          if (result.monsterDefeated) {
            handleMonsterDefeat(draft, combat, monster, rng);
          } else {
            for (const event of result.events) {
              if (event.kind === "firebreath") {
                if (ignoresAbility(draft, "firebreath")) {
                  pushLog(draft, `${monster.name} breathes fire, but your weapon shields you from the flames.`);
                } else {
                  monster.bonusDamage += 10;
                  pushLog(draft, `${monster.name} breathes fire, readying a scorching counterattack!`);
                }
              } else if (event.kind === "sorcery") {
                monster.bonusDamage += event.bonus;
                pushLog(draft, `${monster.name} casts a spell, empowering its next attack by ${event.bonus}!`);
              } else if (event.kind === "deathtouch") {
                if (ignoresAbility(draft, "deathtouch")) {
                  pushLog(draft, `${monster.name}'s touch turns deathly cold, but your ward protects you.`);
                } else {
                  monster.deathtouchPending = true;
                  pushLog(draft, `${monster.name}'s touch turns deathly cold...`);
                }
              } else if (event.kind === "regeneration") {
                monster.hp = Math.min(monster.maxHp, monster.hp + event.amount);
                pushLog(draft, `${monster.name} regenerates ${event.amount} HP.`);
              } else if (event.kind === "paralyze") {
                if (ignoresAbility(draft, "paralyze")) {
                  pushLog(draft, `${monster.name} prepares a paralyzing strike, but your ward protects you.`);
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
          applyMonsterTurn(draft, draft.combat);
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
          applyMonsterTurn(draft, combat);
          return;
        }

        combat.engulfableBodies -= 1;
        draft.hp = draft.maxHp;
        pushLog(draft, "You engulf a fallen enemy's body, regaining all your HP.");

        if (draft.combat && draft.combat.outcome === "ongoing") {
          applyMonsterTurn(draft, draft.combat);
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
          pushLog(
            draft,
            piece.hp <= 0
              ? `Your ${label} absorbs ${absorbed} damage and is destroyed!`
              : `Your ${label} absorbs ${absorbed} damage (${piece.hp}/${piece.maxHp} HP left).`,
          );
        }

        if (draft.hp <= 0) {
          draft.alive = false;
          draft.deathCause = "combat";
          pushLog(draft, "You fall in combat, overwhelmed by your foes.", "descend");
          leaveRemains(draft, combat.segId);
        }
      });
    }

    case "CAST_SPELL": {
      if (!state.alive || state.combat?.pendingDamage != null) return state;
      const spell = SPELL_TABLE[action.spellRoll];
      const remaining = state.spellUses[action.spellRoll] ?? 0;
      if (!spell || remaining <= 0) return state;
      // Cold Ray (4) and Lightning (5) need a target monster; all three combat-damage
      // spells, plus Teleport's flee effect, only mean anything mid-fight.
      const combatOnly = action.spellRoll === 4 || action.spellRoll === 5 || action.spellRoll === 6;
      if ((combatOnly || action.spellRoll === 3) && !state.combat) return state;
      if ((action.spellRoll === 4 || action.spellRoll === 5) && action.targetId == null) return state;

      return produce(state, (draft) => {
        draft.spellUses[action.spellRoll] = remaining - 1;
        const combat = draft.combat;

        if (combat && combat.paralyzedTurns > 0) {
          combat.paralyzedTurns -= 1;
          pushLog(draft, "You are paralyzed and cannot cast a spell this turn.");
          applyMonsterTurn(draft, combat);
          return;
        }

        switch (action.spellRoll) {
          case 1: {
            const healed = Math.min(HEAL_AMOUNT, draft.maxHp - draft.hp);
            draft.hp += healed;
            pushLog(draft, `You cast Heal, recovering ${healed} HP.`);
            break;
          }

          case 2: {
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

          case 3: {
            if (!combat) break;
            pushLog(draft, "You cast Teleport and vanish from the fight, reappearing in an empty room.", "descend");
            draft.combat = null;
            return; // fled -- no monster counter-turn
          }

          case 4: {
            if (!combat) break;
            const monster = combat.monsters.find((m) => m.id === action.targetId);
            if (!monster) break;
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

          case 5: {
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

          case 6: {
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
        }

        if (draft.combat) {
          finishIfVictorious(draft, draft.combat, rng);
          if (draft.combat && draft.combat.outcome === "ongoing") {
            applyMonsterTurn(draft, draft.combat);
          }
        }
      });
    }

    case "OPEN_TREASURE": {
      if (!state.alive || state.treasures <= 0 || !state.dungeonTypeKey || state.combat?.pendingDamage != null) {
        return state;
      }
      const outcome = DUNGEON_TABLES[state.dungeonTypeKey].treasure[action.roll];
      if (!outcome) return state;

      return produce(state, (draft) => {
        const combat = draft.combat;

        if (combat && combat.paralyzedTurns > 0) {
          combat.paralyzedTurns -= 1;
          pushLog(draft, "You are paralyzed and cannot examine the treasure this turn.");
          applyMonsterTurn(draft, combat);
          return;
        }

        draft.treasures -= 1;

        switch (outcome.effect.kind) {
          case "heldValue": {
            draft.heldItems.push({ name: outcome.effect.name, worth: outcome.effect.amount });
            pushLog(draft, `Treasure: ${outcome.text}`);
            break;
          }
          case "heldValueRoll": {
            let sum = 0;
            for (let i = 0; i < outcome.effect.dice; i++) sum += rollDie(rng);
            const worth = sum * outcome.effect.multiplier;
            draft.heldItems.push({ name: outcome.effect.name, worth });
            pushLog(draft, `Treasure: ${outcome.text} (worth ${worth} coins)`);
            break;
          }
          case "healAll": {
            const healed = draft.maxHp - draft.hp;
            draft.hp = draft.maxHp;
            pushLog(draft, `Treasure: ${outcome.text}${healed > 0 ? ` (+${healed} HP)` : ""}`);
            break;
          }
          case "restoreAllSpells": {
            draft.spellUses = { ...action.maxSpellUses };
            pushLog(draft, `Treasure: ${outcome.text}`);
            break;
          }
          case "randomSpell": {
            const spellRoll = rollDie(rng);
            draft.spellUses[spellRoll] = (draft.spellUses[spellRoll] ?? 0) + 1;
            const spellName = SPELL_TABLE[spellRoll]?.name ?? "a spell";
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
              draft.weapon = { name: base.name, formula: base.formula, twoHanded: base.twoHanded };
              pushLog(draft, `Treasure: You find a ${base.name} (${base.formula} damage).`);
            }
            break;
          }
        }

        if (draft.combat) {
          applyMonsterTurn(draft, draft.combat);
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
        ),
        (draft) => {
          restoreMapFromPersisted(draft, persisted, rng, "A new adventurer takes up the fallen's path.", true);
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
        ),
        (draft) => {
          restoreMapFromPersisted(draft, persisted, rng, "You return to the dungeon.", false);
        },
      );
    }

    case "RESET":
      return createInitialDungeonState();

    default:
      return state;
  }
}
