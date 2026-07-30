/** One row of the Graveyard play-sheet: "Write down the characters that died... Name, Dungeon, Cause of Death."
 * `race`/`cls`/`monsterKills`/`bossKills` are later additions -- optional so entries already sitting in a
 * player's `localStorage` from before these fields existed still parse and render without them.
 * `causeOfDeath`'s "gamble"/"thug-life"/"arena" values (issue #58's Getting Money mini-games) are the first
 * deaths that don't happen inside a dungeon run at all -- `dungeon` doubles as "where" for these, holding
 * the city/fortress's location label instead of a dungeon name. "warfare" (issue #28) is the same shape:
 * a character who joined their troops in an Attack and rolled a 1 on a lost battle. "event" (issue #91,
 * Events on Travel) is the same shape again, and the only one that happens out in the wilderness rather
 * than at a City/Fortress -- either losing an Event fight or Glacier's Cracked Ice. "portal" (issue
 * #21) is the 3d6 roll of 3, "your character has disappeared from existence" -- no body and no
 * dungeon, so `dungeon` holds wherever the portal stood. "realm" (issue #105) is dying in one of
 * the four Other Worlds -- to its terrain (Magma's 6d6 is the only HP cost in the game with no
 * survival floor) or to one of its Events; `dungeon` holds the world's name. */
export interface GraveyardEntry {
  name: string;
  dungeon: string;
  causeOfDeath:
    | "darkness"
    | "combat"
    | "gamble"
    | "thug-life"
    | "arena"
    | "warfare"
    | "event"
    | "portal"
    | "realm"
    | "thin-ice";
  race?: string;
  cls?: string;
  monsterKills?: number;
  bossKills?: number;
  /** Advanced Classes (issue #23) the fallen character had acquired at time of death -- optional,
   * same back-compat shape as every other field here, added specifically to answer Lich's (issue
   * #73) "Be Necromaster and having died" requirement: a genuinely cross-character check (did any
   * past character die while holding Necromancer?), the only Advanced Class currently checked this
   * way, but reusable for any future "died while holding X" requirement. */
  advancedClasses?: string[];
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
