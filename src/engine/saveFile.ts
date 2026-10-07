import { loadGraveyard, replaceGraveyard, type GraveyardEntry } from "./graveyard.ts";
import {
  getLatestSession,
  loadSession,
  SESSION_SCHEMA_VERSION,
  writeSession,
  type SessionState,
} from "./session.ts";

/**
 * Issue #142: a save file the player can download and load back in. The whole game otherwise lives
 * in two localStorage keys, gone the moment site data is cleared -- and with no way to carry it to
 * another browser.
 *
 * The file holds both keys: the session and the Graveyard. Leaving the Graveyard out would make a
 * restored save quietly forget every character that died before it.
 */
export interface SaveFile {
  format: typeof SAVE_FILE_FORMAT;
  /** The session's own schema version at export time -- see `SESSION_SCHEMA_VERSION`. */
  schemaVersion: number;
  /** Informational only: which build wrote the file. */
  appVersion: string;
  exportedAt: string;
  session: SessionState;
  graveyard: GraveyardEntry[];
}

export const SAVE_FILE_FORMAT = "gerdquest-save";

export function buildSaveFile(
  appVersion: string,
  now: Date = new Date(),
  storage: Storage = globalThis.localStorage,
): SaveFile {
  return {
    format: SAVE_FILE_FORMAT,
    schemaVersion: SESSION_SCHEMA_VERSION,
    appVersion,
    exportedAt: now.toISOString(),
    // What's being played, even if the last save didn't fit -- that's exactly when an export matters.
    session: getLatestSession() ?? loadSession(storage),
    graveyard: loadGraveyard(storage),
  };
}

/** `gerdquest-<name>-2026-10-07.json`, or `gerdquest-save-…` with no character. */
export function saveFileName(file: SaveFile): string {
  const who = file.session.character?.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  return `gerdquest-${who ? who.toLowerCase() : "save"}-${file.exportedAt.slice(0, 10)}.json`;
}

export type ImportResult =
  { ok: true; characterName: string | null } | { ok: false; error: string };

/**
 * Validates `text` as a save file and, only if it's valid, writes it over the current save. The
 * session goes through `loadSession()`'s own back-fills first, so a file exported by an older build
 * loads exactly the way that build's localStorage would have.
 *
 * The caller reloads the page afterwards: App seeds every piece of its state from storage once, on
 * mount, and re-seeding it all in place would duplicate that path for no gain.
 */
export function importSaveFile(
  text: string,
  storage: Storage = globalThis.localStorage,
): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't a GerdQuest save -- it isn't valid JSON." };
  }
  if (!parsed || typeof parsed !== "object" || (parsed as SaveFile).format !== SAVE_FILE_FORMAT) {
    return { ok: false, error: "That file isn't a GerdQuest save." };
  }
  const file = parsed as Partial<SaveFile>;
  if ((file.schemaVersion ?? 0) > SESSION_SCHEMA_VERSION) {
    return {
      ok: false,
      error:
        "That save is from a newer version of the game. Reload the page to update, then try again.",
    };
  }
  if (!file.session || typeof file.session !== "object") {
    return { ok: false, error: "That save file is missing its game data." };
  }

  // Run the raw session through the same normalization a page load would.
  const session = loadSession(memoryStorage({ "notequest:session": JSON.stringify(file.session) }));
  const graveyard = Array.isArray(file.graveyard) ? file.graveyard : [];

  if (!writeSession(session, storage) || !replaceGraveyard(graveyard, storage)) {
    return { ok: false, error: "This browser refused to store the save." };
  }
  return { ok: true, characterName: session.character?.name ?? null };
}

/** Just enough of `Storage` to run `loadSession()` against a value that isn't in localStorage. */
function memoryStorage(initial: Record<string, string>): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}
