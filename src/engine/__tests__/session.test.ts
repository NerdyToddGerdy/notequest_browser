import { describe, expect, it } from "vitest";
import { clearSession, loadSession, saveSession, type SessionState } from "../session.ts";
import { createInitialDungeonState } from "../dungeonState.ts";
import { createInitialWorldState, type WorldState } from "../hexState.ts";
import type { CreatedCharacter } from "../../data/types.ts";
import type { AdventurerResources } from "../town.ts";
import { fixedDie } from "../../test/mulberry32.ts";

/** A minimal in-memory Storage so these tests don't need a DOM environment. */
function makeFakeStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
    clear: () => data.clear(),
    key: (index) => Array.from(data.keys())[index] ?? null,
    get length() {
      return data.size;
    },
  };
}

const CHARACTER: CreatedCharacter = {
  name: "Pip",
  race: { roll: 7, name: "Human", hp: 12, ability: "None." },
  cls: {
    roll: 7,
    name: "Fighter",
    hpBonus: 4,
    ability: "None.",
    weapon: "Sword",
    weaponDamage: "1d6+1",
  },
  totalHp: 16,
  spells: [],
  fixedGrants: [],
  torches: 10,
  coins: 3,
};

const RESOURCES: AdventurerResources = {
  torches: 8,
  hp: 14,
  maxHp: 16,
  coins: 5,
  treasures: 1,
  keys: 0,
  heldItems: [],
  armor: [],
  weapon: null,
  spareWeapons: [],
  spellUses: {},
  monsterKills: 2,
  bossKills: 0,
  killsByName: {},
  killsByAbility: {},
  provisions: 17,
  advancedClasses: [],
  hireling: null,
  animals: [],
};

const WORLD: WorldState = createInitialWorldState(fixedDie(3));

const FULL_SESSION: SessionState = {
  character: CHARACTER,
  resources: RESOURCES,
  dungeonHistory: [{ id: "run-1", dungeon: createInitialDungeonState(), lastCharacterName: "Pip" }],
  activeRunId: "run-1",
  world: WORLD,
};

describe("loadSession", () => {
  it("is a fully-empty session when nothing has been stored yet", () => {
    expect(loadSession(makeFakeStorage())).toEqual({
      character: null,
      resources: null,
      dungeonHistory: [],
      activeRunId: null,
      world: null,
    });
  });

  it("reads back a previously stored session exactly", () => {
    const storage = makeFakeStorage({ "notequest:session": JSON.stringify(FULL_SESSION) });
    expect(loadSession(storage)).toEqual(FULL_SESSION);
  });

  it("falls back to an empty session on corrupt JSON instead of throwing", () => {
    const storage = makeFakeStorage({ "notequest:session": "{not valid json" });
    expect(loadSession(storage)).toEqual({
      character: null,
      resources: null,
      dungeonHistory: [],
      activeRunId: null,
      world: null,
    });
  });

  it("falls back to an empty session if the stored value isn't an object", () => {
    const storage = makeFakeStorage({ "notequest:session": JSON.stringify("oops") });
    expect(loadSession(storage)).toEqual({
      character: null,
      resources: null,
      dungeonHistory: [],
      activeRunId: null,
      world: null,
    });
  });

  it("tolerates a partial/older blob missing fields added later", () => {
    const storage = makeFakeStorage({
      "notequest:session": JSON.stringify({ character: CHARACTER }),
    });
    expect(loadSession(storage)).toEqual({
      character: CHARACTER,
      resources: null,
      dungeonHistory: [],
      activeRunId: null,
      world: null,
    });
  });

  it("back-fills resources.advancedClasses (issue #23) for a session persisted before it existed", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { advancedClasses, ...oldResources } = RESOURCES;
    const storage = makeFakeStorage({
      "notequest:session": JSON.stringify({ ...FULL_SESSION, resources: oldResources }),
    });
    expect(loadSession(storage).resources).toEqual({ ...oldResources, advancedClasses: [] });
  });

  it("back-fills resources.hireling (issue #25) for a session persisted before it existed", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { hireling, ...oldResources } = RESOURCES;
    const storage = makeFakeStorage({
      "notequest:session": JSON.stringify({ ...FULL_SESSION, resources: oldResources }),
    });
    expect(loadSession(storage).resources).toEqual({ ...oldResources, hireling: null });
  });

  it("back-fills resources.animals (issue #26) for a session persisted before it existed", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { animals, ...oldResources } = RESOURCES;
    const storage = makeFakeStorage({
      "notequest:session": JSON.stringify({ ...FULL_SESSION, resources: oldResources }),
    });
    expect(loadSession(storage).resources).toEqual({ ...oldResources, animals: [] });
  });
});

describe("saveSession", () => {
  it("persists a full session that round-trips through loadSession", () => {
    const storage = makeFakeStorage();
    saveSession(FULL_SESSION, storage);
    expect(loadSession(storage)).toEqual(FULL_SESSION);
  });

  it("overwrites whatever was there before, not merges", () => {
    const storage = makeFakeStorage({ "notequest:session": JSON.stringify(FULL_SESSION) });
    const cleared: SessionState = {
      character: null,
      resources: null,
      dungeonHistory: FULL_SESSION.dungeonHistory,
      activeRunId: null,
      world: null,
    };
    saveSession(cleared, storage);
    expect(loadSession(storage)).toEqual(cleared);
  });
});

describe("clearSession", () => {
  it("wipes a previously stored session", () => {
    const storage = makeFakeStorage({ "notequest:session": JSON.stringify(FULL_SESSION) });
    clearSession(storage);
    expect(loadSession(storage)).toEqual({
      character: null,
      resources: null,
      dungeonHistory: [],
      activeRunId: null,
      world: null,
    });
  });

  it("is a no-op when nothing was stored", () => {
    const storage = makeFakeStorage();
    expect(() => clearSession(storage)).not.toThrow();
  });
});
