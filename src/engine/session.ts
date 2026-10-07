import type { CreatedCharacter } from "../data/types.ts";
import type { DungeonState, PendingDungeon } from "./dungeonState.ts";
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
  /** Issue #141: the dungeon run on screen right now, if any, snapshotted on every dispatch. Without
   * it a run lived only in `DungeonScreen`'s reducer, so a reload rewound the whole trip -- death
   * included, since the character is only cleared when "New Adventurer" is clicked. On load, a
   * non-null `liveRun` resumes straight back into the dungeon at exactly this state. Optional for
   * back-compat; `loadSession()` defaults it to null. */
  liveRun?: LiveRun | null;
}

/** Everything `App.tsx` needs to remount `DungeonScreen` mid-run after a reload. `forcedTypeRoll`
 * matters only before the dungeon is rolled; `noExit`/`enteredFromTown` decide where the exit leads. */
export interface LiveRun {
  runId: string;
  dungeon: DungeonState;
  forcedTypeRoll: number | null;
  noExit: boolean;
  enteredFromTown: boolean;
}

/** Keeps the historical `notequest:` prefix deliberately (issue #113). This key holds every
 * player's entire save -- character, resources, world map, dungeon history -- so renaming it without
 * a read-old-write-new migration would silently wipe everyone, experienced as the game deleting
 * their character. The prefix is invisible to players, so the migration would be pure risk for zero
 * user-visible benefit. Same reasoning applies to `graveyard.ts`'s own key. */
const STORAGE_KEY = "notequest:session";

/**
 * Issue #142: stamped onto every saved blob so a future shape change can migrate deliberately
 * instead of growing `loadSession()`'s back-fill list forever. A blob without it is version 0 --
 * everything saved before this existed, which the field-by-field back-fills below still cover.
 * Bump it alongside a migration step in `loadSession()`; never for a plain optional field.
 */
export const SESSION_SCHEMA_VERSION = 1;

/**
 * Issue #142: whether this tab's saves are actually landing.
 * - `"failing"`: storage threw (private browsing, quota) -- the player is playing unsaved.
 * - `"superseded"`: another tab wrote the save after this one loaded it. From then on this tab
 *   refuses to save, since its next write would silently clobber the newer game.
 *
 * Kept here rather than in React state so `saveSession()` itself can be the authority on the
 * superseded rule; the UI subscribes through `subscribeSaveHealth()`/`getSaveHealth()`.
 */
export type SaveHealth = "ok" | "failing" | "superseded";

let saveHealth: SaveHealth = "ok";
const saveHealthListeners = new Set<() => void>();

function setSaveHealth(next: SaveHealth): void {
  if (next === saveHealth) return;
  saveHealth = next;
  for (const listener of saveHealthListeners) listener();
}

export function getSaveHealth(): SaveHealth {
  return saveHealth;
}

/** `useSyncExternalStore`-shaped: returns its own unsubscribe. */
export function subscribeSaveHealth(listener: () => void): () => void {
  saveHealthListeners.add(listener);
  return () => saveHealthListeners.delete(listener);
}

/**
 * Issue #142: flips this tab to `"superseded"` the moment another tab writes (or clears) the save.
 * The browser only fires `storage` events in *other* tabs, so this tab's own saves never trip it --
 * and only when the stored value actually changes, so a second tab that just opens (re-saving an
 * identical blob) doesn't trip it either. That's the right line: two tabs holding the same game
 * can't clobber each other, and whichever one changes it first is the one that keeps saving.
 * Returns the unsubscribe; `target` is injectable for tests.
 */
export function watchForOtherTabs(
  target: Pick<Window, "addEventListener" | "removeEventListener"> = window,
): () => void {
  const onStorage = (e: StorageEvent) => {
    // `key === null` is another tab calling `localStorage.clear()`.
    if (e.key === STORAGE_KEY || e.key === null) setSaveHealth("superseded");
  };
  target.addEventListener("storage", onStorage);
  return () => target.removeEventListener("storage", onStorage);
}

/** The session most recently handed to `saveSession()`, whether or not it reached storage -- so an
 * export taken while saves are failing still captures the game being played, not the last one that
 * happened to fit (issue #142). */
let latestSession: SessionState | null = null;

export function getLatestSession(): SessionState | null {
  return latestSession;
}

/** Test-only: module state outlives a single test otherwise. */
export function resetSaveHealthForTests(): void {
  saveHealth = "ok";
  latestSession = null;
  saveHealthListeners.clear();
}

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
  liveRun: null,
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
    // `schemaVersion` (issue #142) is read here when the first real migration needs it. Today every
    // version is handled by the field-by-field back-fills below, so it's deliberately unused.
    const p = parsed as Partial<SessionState>;
    return {
      character: p.character ?? null,
      // advancedClasses (issue #23), hireling (issue #25), animals (issue #26), milestones
      // (issue #70), travelStats (issue #72), maxSpellUses (issue #75), buildings (issue #27),
      // troops/troopSources (issue #28), spareArmor (issue #82), survivedRunIds (issue #62),
      // flyActive (issue #61), and nextDungeonDamageBonus (issue #30) all postdate this field --
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
            survivedRunIds: p.resources.survivedRunIds ?? [],
            flyActive: p.resources.flyActive ?? false,
            nextDungeonDamageBonus: p.resources.nextDungeonDamageBonus ?? 0,
            catatonic: p.resources.catatonic ?? false,
            hirelingHp: p.resources.hirelingHp ?? null,
            curiosities: p.resources.curiosities ?? {},
            consumables: p.resources.consumables ?? [],
            mutations: p.resources.mutations ?? [],
            zombieRevivals: p.resources.zombieRevivals ?? 0,
            // "Your Hands" (issue #100) -- a save from before the hand economy existed has two arms.
            armLost: p.resources.armLost ?? false,
          }
        : null,
      dungeonHistory: Array.isArray(p.dungeonHistory) ? p.dungeonHistory : [],
      activeRunId: p.activeRunId ?? null,
      world: p.world ?? null,
      // A snapshot without a character to own it can't be resumed into anything.
      liveRun: p.character && p.liveRun?.dungeon ? p.liveRun : null,
    };
  } catch {
    return EMPTY_SESSION;
  }
}

/** Overwrites the persisted session wholesale -- App.tsx calls this from a single effect
 * watching all four pieces, rather than each individual setter persisting itself. A no-op once
 * another tab has taken over the save (issue #142). */
export function saveSession(
  session: SessionState,
  storage: Storage = globalThis.localStorage,
): void {
  latestSession = session;
  if (saveHealth === "superseded") return;
  // Storage unavailable (private browsing, quota, etc.) -- the run continues either way, but the
  // player is told, since they're now playing a game that won't survive the tab (issue #142).
  setSaveHealth(writeSession(session, storage) ? "ok" : "failing");
}

/** The raw write, with no superseded check -- importing a save file (issue #142) is an explicit
 * "make *this* the save" and must land even from a tab another one has overtaken. Returns false if
 * storage refused it. */
export function writeSession(
  session: SessionState,
  storage: Storage = globalThis.localStorage,
): boolean {
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...session, schemaVersion: SESSION_SCHEMA_VERSION }),
    );
    return true;
  } catch {
    return false;
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
