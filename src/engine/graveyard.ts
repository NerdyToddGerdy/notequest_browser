/** One row of the Graveyard play-sheet: "Write down the characters that died... Name, Dungeon, Cause of Death." */
export interface GraveyardEntry {
  name: string;
  dungeon: string;
  causeOfDeath: "darkness" | "combat";
}

const STORAGE_KEY = "notequest:graveyard";

/**
 * `storage` is injectable (mirroring this codebase's RNG-injection pattern) so engine tests
 * can run in Vitest's default Node environment, which has no `localStorage`.
 */
export function loadGraveyard(storage: Storage = globalThis.localStorage): GraveyardEntry[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GraveyardEntry[]) : [];
  } catch {
    return [];
  }
}

/** Appends one entry and persists the updated Graveyard, returning it. */
export function addGraveyardEntry(
  entry: GraveyardEntry,
  storage: Storage = globalThis.localStorage,
): GraveyardEntry[] {
  const next = [...loadGraveyard(storage), entry];
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private browsing, quota, etc.) -- the run continues either way.
  }
  return next;
}
