import type { CreatedCharacter } from "../data/types.ts";
import type { PendingDungeon } from "./dungeonState.ts";
import type { AdventurerResources } from "./town.ts";
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
      resources: p.resources ?? null,
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
