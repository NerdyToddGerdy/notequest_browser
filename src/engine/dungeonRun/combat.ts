/**
 * Starting fights, the monsters' turn, defeats, loot, and the room-entry gate that blocks other
 * actions until it's resolved.
 *
 * Split out of `dungeonReducer.ts` (issue #144), which still owns every action -- these are the
 * helpers its cases share. Behavior is unchanged; only where the code lives moved.
 */
import type { Draft } from "immer";
import {
  DUNGEON_TABLES,
  type BonusLootEntry,
  type MonsterAbility,
  type MonsterTemplate,
} from "../../data/dungeonTables.ts";
import { buildingTaxTotal } from "../../data/buildings.ts";
import { HIRELING_BY_NAME } from "../../data/hirelings.ts";
import { rollDie } from "../dice.ts";
import {
  applyMonsterTurn as fightApplyMonsterTurn,
  attackBonus as fightAttackBonus,
  attackMultiplier as fightAttackMultiplier,
  ignoredAbilities as fightIgnoredAbilities,
  ignoresAbility as fightIgnoresAbility,
} from "../fight.ts";
import { checkUndeadRevival, rollLoot, spawnMonsters } from "../combat.ts";
import {
  type CombatMonsterState,
  type CombatState,
  type DungeonState,
  type SegmentState,
  guardianOf,
} from "../dungeonState.ts";
import { MAX_TORCHES } from "../town.ts";
import type { RNG } from "../rng.ts";
import { pushLog, leaveRemains, dungeonLog } from "./core.ts";
import { addArmorPiece } from "./inventory.ts";

/** Spawns a CombatState for `template` in `segId`; if `wasNoisy`, the monsters get a free first attack. */
export function startCombat(
  draft: Draft<DungeonState>,
  segId: number,
  template: MonsterTemplate,
  wasNoisy: boolean,
  rng: RNG,
  isBoss = false,
): void {
  // Issue #96: monsters alerted from a distance (noise carried through a broken door while the
  // player was elsewhere) get the first strike whenever the player finally walks in, exactly as if
  // the arrival itself had been noisy. Folded in here rather than at each call site, since this is
  // the single chokepoint every fight starts from. The flag is consumed either way -- they only get
  // one free ambush out of it.
  const alertedSeg = draft.levels[draft.activeLevel]?.segments.find((sg) => sg.id === segId);
  if (alertedSeg?.alerted) {
    wasNoisy = true;
    alertedSeg.alerted = false;
  }

  // Underwater/Volcanic Cave (issue #138): recorded when the fight *starts*, because by the time
  // `finishIfVictorious()` runs `combat.monsters` is empty and there is nothing left to match on.
  const guardianChest = guardianOf(draft.dungeonTypeKey) === template.name;

  const monsters: CombatMonsterState[] = spawnMonsters(
    template,
    () => {
      const id = draft.nextMonsterId;
      draft.nextMonsterId += 1;
      return id;
    },
    rng,
  );
  // Issue #84: a copy of the employed Hireling's own hp, not a reference. Its *current* HP lives on
  // `draft.hirelingHp` between fights (issue #114) -- seeding from the data table every time is what
  // made one hire an unlimited meat shield. `?? def.hp` covers a Hireling hired before that field
  // existed, and `maxHp` still comes from the table, since that never changes.
  const hirelingDef = draft.hireling ? HIRELING_BY_NAME[draft.hireling] : undefined;
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
    hireling: hirelingDef
      ? {
          name: hirelingDef.name,
          hp: Math.min(draft.hirelingHp ?? hirelingDef.hp, hirelingDef.hp),
          maxHp: hirelingDef.hp,
        }
      : null,
    hirelingAttackedThisRound: false,
    animalAttackedThisRound: false,
    guardianChest,
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
export function startCombatIfMonsters(
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
export function hasPendingRoomEntry(state: DungeonState): boolean {
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
export function isActionBlocked(state: DungeonState): boolean {
  return hasPendingRoomEntry(state) || state.pendingPackItem != null;
}

/** If a room the player previously moved silently through hears a noisy action (a door breaking,
 * a trap firing) while they're still there, its monsters wake up and attack first -- "If while
 * hiding you set off a trap or make a noise, monsters attack."
 *
 * Also carries the alarm one hop outward through any *broken* door (issue #96): "whenever you have a
 * broken door in a segment, there is communication between the segments. If monsters in one segment
 * are alerted, monsters in the other segment are also alerted and will attack you." */
export function wakeSneakedPastMonsters(
  draft: Draft<DungeonState>,
  seg: Draft<SegmentState>,
  rng: RNG,
): void {
  alertThroughBrokenDoors(draft, seg);
  const monsters = seg.monsters;
  if (!seg.sneakedPast || !monsters) return;
  seg.sneakedPast = false;
  pushLog(draft, `Segment ${seg.id}: the noise gives you away -- the monsters attack!`);
  startCombat(draft, seg.id, monsters, true, rng);
}

/** Issue #96's propagation half. Deliberately **one hop**, not a transitive flood-fill: the rulebook
 * says "communication between the segments" (the two a broken door joins), not "throughout the
 * dungeon" -- confirmed with the user.
 *
 * Only one `CombatState` slot exists at a time, so an alerted group the player isn't standing in
 * can't start a fight now. Instead it's marked `alerted`, which `startCombat` reads as `wasNoisy`
 * whenever the player does walk in -- closest to "will attack you," and it reuses machinery that
 * already exists rather than inventing a second combat slot. Doors live only on the *parent*
 * segment (`childId` points at the child), so neighbors are collected in both directions, the same
 * bidirectional walk `reachableSegIds()` does. */
export function alertThroughBrokenDoors(
  draft: Draft<DungeonState>,
  from: Draft<SegmentState>,
): void {
  const level = draft.levels[draft.activeLevel];
  if (!level) return;

  const neighborIds = new Set<number>();
  for (const door of from.doors) {
    if (door.broken && door.childId != null) neighborIds.add(door.childId);
  }
  for (const other of level.segments) {
    if (other.id === from.id) continue;
    if (other.doors.some((d) => d.broken && d.childId === from.id)) neighborIds.add(other.id);
  }

  for (const id of neighborIds) {
    const neighbor = level.segments.find((sg) => sg.id === id);
    if (!neighbor?.monsters || neighbor.monstersDefeated || neighbor.alerted) continue;
    neighbor.alerted = true;
    // A sneaked-past neighbor loses its "they never noticed you" status outright -- the whole point
    // of the rule is that a broken door gives away a room you took care to slip through.
    neighbor.sneakedPast = false;
    pushLog(
      draft,
      `Segment ${neighbor.id}: the noise carries through the broken door -- something in there heard you.`,
    );
  }
}

export function attackBonus(
  draft: Draft<DungeonState>,
  monster: Draft<CombatMonsterState>,
  isHorn = false,
): number {
  return fightAttackBonus(draft, draft.combat ?? null, monster, isHorn);
}

export function attackMultiplier(
  draft: Draft<DungeonState>,
  monster: Draft<CombatMonsterState>,
  isHorn = false,
  isFirstAttack = false,
): number {
  return fightAttackMultiplier(draft, monster, isHorn, isFirstAttack);
}

export function ignoresAbility(draft: Draft<DungeonState>, ability: MonsterAbility): boolean {
  return fightIgnoresAbility(draft, ability);
}

export function ignoredAbilities(draft: Draft<DungeonState>): MonsterAbility[] {
  return fightIgnoredAbilities(draft);
}

/** One monster round, plus the bookkeeping only a dungeon can do: a death here flips `alive`, leaves
 * remains in the segment the fight happened in, and clears the fight. */
export function applyMonsterTurn(
  draft: Draft<DungeonState>,
  combat: Draft<CombatState>,
  rng: RNG,
): void {
  const result = fightApplyMonsterTurn(draft, combat, rng, dungeonLog(draft));
  if (result.died) {
    draft.alive = false;
    draft.deathCause = "combat";
    leaveRemains(draft, combat.segId);
    draft.combat = null;
  }
}

/** Removes a monster reduced to 0 HP, resolving Undead revival and queuing a Loot roll first. */
export function handleMonsterDefeat(
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
  const revived =
    !bypassRevival && !ignoresAbility(draft, "undead") && checkUndeadRevival(monster, rng);
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

/** Citadel's Dwarf Hallows / Necropolis's Forgotten Hallows (issue #30) -- a post-Boss bonus item,
 * always concrete/named, granted directly rather than through the Wonders/Magic Item tables' own
 * roll-then-layer-a-bonus shape. */
export function grantBonusLoot(draft: Draft<DungeonState>, entry: BonusLootEntry): void {
  if (entry.kind === "weapon") {
    draft.spareWeapons.push({
      name: entry.name,
      formula: entry.formula,
      twoHanded: entry.twoHanded,
      bonusEffect: entry.bonusEffect,
    });
    pushLog(draft, `The fallen Boss guarded a Hallow: ${entry.name} (${entry.formula} damage).`);
  } else if (entry.kind === "armor") {
    addArmorPiece(draft, {
      piece: entry.piece,
      hp: entry.maxHp,
      maxHp: entry.maxHp,
      itemName: entry.name,
      effect: entry.effect,
    });
    pushLog(draft, `The fallen Boss guarded a Hallow: ${entry.name} (${entry.maxHp} HP).`);
  } else {
    addArmorPiece(draft, {
      piece: "wonderItem",
      hp: entry.grantsHp ?? 0,
      maxHp: entry.grantsHp ?? 0,
      itemName: entry.name,
      effect: entry.effect,
    });
    pushLog(draft, `The fallen Boss guarded a Hallow: ${entry.name}.`);
  }
}

/** If every monster is gone, resolves Loot (or the Boss's flat 2d6 Treasures), marks the room cleared, and closes out combat. */
export function finishIfVictorious(
  draft: Draft<DungeonState>,
  combat: Draft<CombatState>,
  rng: RNG,
): void {
  if (combat.monsters.length > 0) return;
  const level = draft.levels[draft.activeLevel];
  const seg = level?.segments.find((s) => s.id === combat.segId);
  if (seg) seg.monstersDefeated = true;

  // Underwater/Volcanic Cave (issue #138): "If you defeat him you find a Chest." Flagged on the
  // segment rather than credited directly, because the reward is a *chest* -- the player still has
  // to open it, and it rolls on the same two-dice coins/Treasures split every other chest does.
  if (seg && combat.guardianChest) seg.guardianChest = true;

  // Absorb Soul/Fire of the Dead (New Spells, issue #61): deferred-to-victory triggers, off the
  // same "monsters actually killed this fight" count Slimemen's engulfableBodies already tracks --
  // applies to a Boss victory too, since neither spell's text carves out an exception for one.
  if (combat.absorbSoulActive && combat.engulfableBodies > 0) {
    const healed = Math.min(5 * combat.engulfableBodies, draft.maxHp - draft.hp);
    draft.hp += healed;
    pushLog(draft, `Absorb Soul restores ${healed} HP from the fallen.`);
  }
  if (combat.fireOfTheDeadActive && combat.engulfableBodies > 0) {
    const gained = Math.min(2 * combat.engulfableBodies, MAX_TORCHES - draft.torches);
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
    // Citadel's Dwarf Hallows / Necropolis's Forgotten Hallows (issue #30): "in addition to the 2d6
    // Treasures, you've found one of the Hallows" -- only these two types define bossBonusLoot.
    const bonusLoot = DUNGEON_TABLES[draft.dungeonTypeKey!].bossBonusLoot;
    if (bonusLoot) {
      const entry = bonusLoot[rollDie(rng)]!;
      grantBonusLoot(draft, entry);
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
