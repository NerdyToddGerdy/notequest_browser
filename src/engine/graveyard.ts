/** One row of the Graveyard play-sheet: "Write down the characters that died... Name, Dungeon, Cause of Death."
 * `race`/`cls`/`monsterKills`/`bossKills` are later additions -- optional so entries already sitting in a
 * player's `localStorage` from before these fields existed still parse and render without them.
 * `causeOfDeath`'s "gamble"/"thug-life"/"arena" values (issue #58's Getting Money mini-games) are the first
 * deaths that don't happen inside a dungeon run at all -- `dungeon` doubles as "where" for these, holding
 * the city/fortress's location label instead of a dungeon name. */
export interface GraveyardEntry {
  name: string;
  dungeon: string;
  causeOfDeath: "darkness" | "combat" | "gamble" | "thug-life" | "arena";
  race?: string;
  cls?: string;
  monsterKills?: number;
  bossKills?: number;
}

/** The subset of `causeOfDeath` that can strike outside a dungeon -- Town/World's own equivalent of
 * `DungeonState.deathCause`, which only ever needs "darkness"/"combat". Exported so App.tsx (the only
 * place with both a `character` and the authority to clear the session) can type its own town-death
 * handler without every caller needing to know the full union. */
export type TownDeathCause = Exclude<GraveyardEntry["causeOfDeath"], "darkness" | "combat">;

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

/** Wipes every recorded death -- part of the app-wide hard reset (see App.tsx's handleHardReset
 * and issue #50), irreversible like the rest of it. */
export function clearGraveyard(storage: Storage = globalThis.localStorage): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable -- nothing was there to clear either way.
  }
}
