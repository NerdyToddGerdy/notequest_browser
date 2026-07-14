import type { CreatedCharacter } from "../data/types.ts";
import type { PendingDungeon } from "./dungeonState.ts";
import type { AdventurerResources } from "./town.ts";

/** Everything App.tsx needs to resume exactly where the player left off after a reload --
 * `screen`/`selectedRunId` deliberately aren't included, since they're transient navigation
 * state, not something worth remembering (a reload always lands back on Town, or Character
 * Creation if there's no character, same as today). */
export interface SessionState {
  character: CreatedCharacter | null;
  resources: AdventurerResources | null;
  dungeonHistory: PendingDungeon[];
  /** Which entry in `dungeonHistory` (if any) is the current character's own paused run. */
  activeRunId: string | null;
}

const STORAGE_KEY = "notequest:session";

const EMPTY_SESSION: SessionState = {
  character: null,
  resources: null,
  dungeonHistory: [],
  activeRunId: null,
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
