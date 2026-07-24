import type { CreatedCharacter } from "../data/types.ts";
import type { PendingDungeon } from "./dungeonState.ts";
import {
  createInitialMilestones,
  createInitialTravelStats,
  type AdventurerResources,
} from "./town.ts";
import { computeSpellUses } from "./character.ts";
import type { WorldState } from "./hexState.ts";

/** Everything App.tsx needs to resume exactly where the player left off after a reload --
 * `screen`/`selectedRunId`/`returnScreen` deliberately aren't included, since they're transient
 * navigation state, not something worth remembering (a reload always lands back on Town, or
 * Character Creation if there's no character, same as today -- re-entering World shows the same
 * map/position, just requires clicking "Venture into the World" again). */
export interface SessionState {
  character: CreatedCharacter | null;
  resources: AdventurerResources | null;
  dungeonHistory: PendingDungeon[];
  /** Which entry in `dungeonHistory` (if any) is the current character's own paused run. */
  activeRunId: string | null;
  /** The World map -- shared across every character, same as `dungeonHistory`, not reset by a
   * new adventurer. Null until "Venture into the World" is pressed for the first time. */
  world: WorldState | null;
}

const STORAGE_KEY = "notequest:session";

/** Back-fills `resources.maxSpellUses` (issue #75) for a session persisted before that field
 * existed. Can't just default to `computeSpellUses(character)` alone -- if the player had already
 * been granted a spell beyond their creation-time allotment (an Advanced Class/Hireling ability,
 * Gnome's Culture Action) before this fix shipped, that grant is only visible in `spellUses` itself
 * (the bug this field fixes). Taking the higher of the two per key means an old save is never
 * regressed any further than it already was -- it can't recover a history of exactly how high the
 * ceiling used to be, but it stops it from being wiped down any lower than what's currently held. */
function backfillMaxSpellUses(
  character: CreatedCharacter | null | undefined,
  spellUses: Record<string, number>,
): Record<string, number> {
  const creationMax = character ? computeSpellUses(character.spells, character.fixedGrants) : {};
  const merged = { ...creationMax };
  for (const [key, count] of Object.entries(spellUses)) {
    if (count > (merged[key] ?? 0)) merged[key] = count;
  }
  return merged;
}

const EMPTY_SESSION: SessionState = {
  character: null,
  resources: null,
  dungeonHistory: [],
  activeRunId: null,
  world: null,
};

/**
 * `storage` is injectable (mirroring `graveyard.ts`'s pattern) so engine tests can run in
 * Vitest's default Node environment, which has no `localStorage`.
 */
export function loadSession(storage: Storage = globalThis.localStorage): SessionState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_SESSION;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return EMPTY_SESSION;
    const p = parsed as Partial<SessionState>;
    return {
      character: p.character ?? null,
      // advancedClasses (issue #23), hireling (issue #25), animals (issue #26), milestones
      // (issue #70), travelStats (issue #72), maxSpellUses (issue #75), buildings (issue #27),
      // troops/troopSources (issue #28), and spareArmor (issue #82) all postdate this field --
      // back-fill them for a session persisted before any of them existed, same "optional for
      // back-compat" precedent as WorldState.bannedHexes.
      resources: p.resources
        ? {
            ...p.resources,
            advancedClasses: p.resources.advancedClasses ?? [],
            hireling: p.resources.hireling ?? null,
            animals: p.resources.animals ?? [],
            // Field-level merge, not just `?? createInitialMilestones()` -- a save from after
            // issue #70 but before #27 already has a `milestones` object, just missing
            // `talkedToKing`/`vassalCount`, which a whole-object fallback wouldn't back-fill.
            milestones: { ...createInitialMilestones(), ...(p.resources.milestones ?? {}) },
            travelStats: p.resources.travelStats ?? createInitialTravelStats(),
            maxSpellUses:
              p.resources.maxSpellUses ??
              backfillMaxSpellUses(p.character, p.resources.spellUses ?? {}),
            buildings: p.resources.buildings ?? [],
            troops: p.resources.troops ?? 0,
            troopSources: p.resources.troopSources ?? [],
            spareArmor: p.resources.spareArmor ?? [],
          }
        : null,
      dungeonHistory: Array.isArray(p.dungeonHistory) ? p.dungeonHistory : [],
      activeRunId: p.activeRunId ?? null,
      world: p.world ?? null,
    };
  } catch {
    return EMPTY_SESSION;
  }
}

/** Overwrites the persisted session wholesale -- App.tsx calls this from a single effect
 * watching all four pieces, rather than each individual setter persisting itself. */
export function saveSession(session: SessionState, storage: Storage = globalThis.localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage unavailable (private browsing, quota, etc.) -- the run continues either way.
  }
}

/** Wipes the persisted session -- part of the app-wide hard reset (see App.tsx's handleHardReset
 * and issue #50). Callers still need to reset their own in-memory state to EMPTY_SESSION's
 * shape themselves; this only clears what's on disk. */
export function clearSession(storage: Storage = globalThis.localStorage): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable -- nothing was there to clear either way.
  }
}
