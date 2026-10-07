/**
 * Bringing a saved run back to life: rebuilding the map from a persisted run, and re-rolling
 * monsters into rooms left empty or cleared.
 *
 * Split out of `dungeonReducer.ts` (issue #144), which still owns every action -- these are the
 * helpers its cases share. Behavior is unchanged; only where the code lives moved.
 */
import type { Draft } from "immer";
import { DUNGEON_TABLES } from "../../data/dungeonTables.ts";
import { rollDie } from "../dice.ts";
import type { DungeonState, SegmentState } from "../dungeonState.ts";
import type { RNG } from "../rng.ts";
import { pushLog } from "./core.ts";
import { startCombat } from "./combat.ts";

/** Copies a persisted run's map/exploration state onto a fresh draft, shared by RESUME_DUNGEON
 * (a new character taking over a dead one's map) and RETURN_TO_DUNGEON (the same character
 * coming back from Town) -- the two differ in what happens to the character's resources (which
 * the caller has already seeded via `createInitialDungeonState()` before calling this) and in
 * `resetToEntrance`, see below. */
export function restoreMapFromPersisted(
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
export function rerollMonstersIfNeeded(
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
