import { beforeEach, describe, expect, it } from "vitest";
import { buildSaveFile, importSaveFile, SAVE_FILE_FORMAT, saveFileName } from "../saveFile.ts";
import {
  getSaveHealth,
  loadSession,
  resetSaveHealthForTests,
  saveSession,
  SESSION_SCHEMA_VERSION,
  watchForOtherTabs,
  type SessionState,
} from "../session.ts";
import { loadGraveyard, type GraveyardEntry } from "../graveyard.ts";
import { createInitialWorldState } from "../hexState.ts";
import { fixedDie } from "../../test/mulberry32.ts";

function makeFakeStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
    clear: () => data.clear(),
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  };
}

const SESSION: SessionState = {
  character: null,
  resources: null,
  dungeonHistory: [],
  activeRunId: null,
  world: createInitialWorldState(fixedDie(3)),
  liveRun: null,
};

const DEAD: GraveyardEntry = {
  name: "Pip",
  dungeon: "The Palace of the Secret Horrors",
  causeOfDeath: "combat",
  race: "Human",
  cls: "Fighter",
  monsterKills: 3,
  bossKills: 0,
};

const NOW = new Date("2026-10-07T12:00:00Z");

beforeEach(resetSaveHealthForTests);

describe("buildSaveFile", () => {
  it("captures both the session and the Graveyard", () => {
    const storage = makeFakeStorage({ "notequest:graveyard": JSON.stringify([DEAD]) });
    saveSession(SESSION, storage);
    const file = buildSaveFile("4.4.0", NOW, storage);
    expect(file).toEqual({
      format: SAVE_FILE_FORMAT,
      schemaVersion: SESSION_SCHEMA_VERSION,
      appVersion: "4.4.0",
      exportedAt: "2026-10-07T12:00:00.000Z",
      session: SESSION,
      graveyard: [DEAD],
    });
  });

  it("falls back to what's stored when nothing has been saved in this tab yet", () => {
    const storage = makeFakeStorage({ "notequest:session": JSON.stringify(SESSION) });
    expect(buildSaveFile("4.4.0", NOW, storage).session).toEqual(SESSION);
  });
});

describe("saveFileName", () => {
  it("is named for the character and the date", () => {
    const file = buildSaveFile("4.4.0", NOW, makeFakeStorage());
    expect(
      saveFileName({
        ...file,
        session: { ...SESSION, character: { name: "Sir Pip O'Dell" } as never },
      }),
    ).toBe("gerdquest-sir-pip-o-dell-2026-10-07.json");
    expect(saveFileName(file)).toBe("gerdquest-save-2026-10-07.json");
  });
});

describe("importSaveFile", () => {
  it("round-trips an export into a fresh browser", () => {
    const source = makeFakeStorage({ "notequest:graveyard": JSON.stringify([DEAD]) });
    saveSession(SESSION, source);
    const text = JSON.stringify(buildSaveFile("4.4.0", NOW, source));

    const target = makeFakeStorage();
    expect(importSaveFile(text, target)).toEqual({ ok: true, characterName: null });
    expect(loadSession(target)).toEqual(SESSION);
    expect(loadGraveyard(target)).toEqual([DEAD]);
  });

  it("back-fills an older file's session exactly as a page load would", () => {
    const old = { format: SAVE_FILE_FORMAT, session: { ...SESSION, resources: { hp: 5 } } };
    const target = makeFakeStorage();
    expect(importSaveFile(JSON.stringify(old), target).ok).toBe(true);
    expect(loadSession(target).resources?.animals).toEqual([]);
    expect(loadGraveyard(target)).toEqual([]);
  });

  it("lands even from a tab another one has taken over -- importing is an explicit choice", () => {
    const target = makeFakeStorage();
    const text = JSON.stringify(buildSaveFile("4.4.0", NOW, makeFakeStorage()));
    let fire: ((e: StorageEvent) => void) | null = null;
    watchForOtherTabs({
      addEventListener: (_type: string, fn: (e: StorageEvent) => void) => {
        fire = fn;
      },
      removeEventListener: () => {},
    } as unknown as Pick<Window, "addEventListener" | "removeEventListener">);
    fire!({ key: "notequest:session" } as StorageEvent);
    expect(getSaveHealth()).toBe("superseded");
    expect(importSaveFile(text, target).ok).toBe(true);
    expect(target.getItem("notequest:session")).not.toBeNull();
  });

  it.each([
    ["isn't JSON", "not json at all", /isn't valid JSON/],
    ["is some other JSON", JSON.stringify({ hello: "world" }), /isn't a GerdQuest save/],
    ["has no game data", JSON.stringify({ format: SAVE_FILE_FORMAT }), /missing its game data/],
    [
      "came from a newer build",
      JSON.stringify({
        format: SAVE_FILE_FORMAT,
        schemaVersion: SESSION_SCHEMA_VERSION + 1,
        session: SESSION,
      }),
      /newer version/,
    ],
  ])("refuses a file that %s, and leaves the current save untouched", (_label, text, message) => {
    const target = makeFakeStorage({ "notequest:session": JSON.stringify(SESSION) });
    const before = target.getItem("notequest:session");
    const result = importSaveFile(text, target);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(message);
    expect(target.getItem("notequest:session")).toBe(before);
  });

  it("reports a browser that refuses the write", () => {
    const text = JSON.stringify(buildSaveFile("4.4.0", NOW, makeFakeStorage()));
    const refusing = {
      ...makeFakeStorage(),
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(importSaveFile(text, refusing)).toEqual({
      ok: false,
      error: "This browser refused to store the save.",
    });
  });
});
