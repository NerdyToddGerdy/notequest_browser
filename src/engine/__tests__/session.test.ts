import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSession,
  getLatestSession,
  getSaveHealth,
  loadSession,
  resetSaveHealthForTests,
  saveSession,
  SESSION_SCHEMA_VERSION,
  subscribeSaveHealth,
  watchForOtherTabs,
  type LiveRun,
  type SessionState,
} from "../session.ts";
import { createInitialDungeonState } from "../dungeonState.ts";
import { createInitialWorldState, type WorldState } from "../hexState.ts";
import type { CreatedCharacter } from "../../data/types.ts";
import {
  createInitialMilestones,
  createInitialTravelStats,
  type AdventurerResources,
} from "../town.ts";
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
  consumables: [],
  armor: [],
  weapon: null,
  spareWeapons: [],
  spareArmor: [],
  spellUses: {},
  maxSpellUses: {},
  monsterKills: 2,
  bossKills: 0,
  killsByName: {},
  killsByAbility: {},
  provisions: 17,
  advancedClasses: [],
  hireling: null,
  hirelingHp: null,
  curiosities: {},
  animals: [],
  milestones: createInitialMilestones(),
  buildings: [],
  troops: 0,
  troopSources: [],
  travelStats: createInitialTravelStats(),
  survivedRunIds: [],
  flyActive: false,
  catatonic: false,
  mutations: [],
  zombieRevivals: 0,
  nextDungeonDamageBonus: 0,
  armLost: false,
};

const WORLD: WorldState = createInitialWorldState(fixedDie(3));

const FULL_SESSION: SessionState = {
  character: CHARACTER,
  resources: RESOURCES,
  dungeonHistory: [{ id: "run-1", dungeon: createInitialDungeonState(), lastCharacterName: "Pip" }],
  activeRunId: "run-1",
  world: WORLD,
  liveRun: null,
};

beforeEach(resetSaveHealthForTests);

describe("loadSession", () => {
  it("is a fully-empty session when nothing has been stored yet", () => {
    expect(loadSession(makeFakeStorage())).toEqual({
      character: null,
      resources: null,
      dungeonHistory: [],
      activeRunId: null,
      world: null,
      liveRun: null,
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
      liveRun: null,
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
      liveRun: null,
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
      liveRun: null,
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

  it("back-fills resources.milestones (issue #70) for a session persisted before it existed", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { milestones, ...oldResources } = RESOURCES;
    const storage = makeFakeStorage({
      "notequest:session": JSON.stringify({ ...FULL_SESSION, resources: oldResources }),
    });
    expect(loadSession(storage).resources).toEqual({
      ...oldResources,
      milestones: createInitialMilestones(),
    });
  });

  it("back-fills resources.buildings (issue #27) for a session persisted before it existed", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { buildings, ...oldResources } = RESOURCES;
    const storage = makeFakeStorage({
      "notequest:session": JSON.stringify({ ...FULL_SESSION, resources: oldResources }),
    });
    expect(loadSession(storage).resources).toEqual({ ...oldResources, buildings: [] });
  });

  it("merges resources.milestones field-by-field, back-filling talkedToKing/vassalCount (issue #27) onto an existing milestones object rather than replacing it wholesale", () => {
    // A save from after issue #70 but before #27: milestones exists, but without the two new
    // fields -- a whole-object `?? createInitialMilestones()` fallback wouldn't have caught this,
    // since the object itself is already present.
    const oldMilestones = {
      hasCastSpell: true,
      hasCastColdRay: false,
      hasSoldItem: true,
      hasHadArmorDestroyed: false,
      hasFoughtInArena: false,
      locksOpened: 4,
    };
    const storage = makeFakeStorage({
      "notequest:session": JSON.stringify({
        ...FULL_SESSION,
        resources: { ...RESOURCES, milestones: oldMilestones },
      }),
    });
    expect(loadSession(storage).resources?.milestones).toEqual({
      ...oldMilestones,
      talkedToKing: false,
      vassalCount: 0,
      clearedASewer: false,
    });
  });

  it("back-fills resources.travelStats (issue #72) for a session persisted before it existed", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { travelStats, ...oldResources } = RESOURCES;
    const storage = makeFakeStorage({
      "notequest:session": JSON.stringify({ ...FULL_SESSION, resources: oldResources }),
    });
    expect(loadSession(storage).resources).toEqual({
      ...oldResources,
      travelStats: createInitialTravelStats(),
    });
  });

  it("back-fills resources.survivedRunIds (issue #62) for a session persisted before it existed", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { survivedRunIds, ...oldResources } = RESOURCES;
    const storage = makeFakeStorage({
      "notequest:session": JSON.stringify({ ...FULL_SESSION, resources: oldResources }),
    });
    expect(loadSession(storage).resources).toEqual({ ...oldResources, survivedRunIds: [] });
  });

  it("back-fills resources.flyActive (issue #61) for a session persisted before it existed", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { flyActive, ...oldResources } = RESOURCES;
    const storage = makeFakeStorage({
      "notequest:session": JSON.stringify({ ...FULL_SESSION, resources: oldResources }),
    });
    expect(loadSession(storage).resources).toEqual({ ...oldResources, flyActive: false });
  });

  it("back-fills resources.mutations/zombieRevivals (issue #30) for a session persisted before they existed", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { mutations, zombieRevivals, ...oldResources } = RESOURCES;
    const storage = makeFakeStorage({
      "notequest:session": JSON.stringify({ ...FULL_SESSION, resources: oldResources }),
    });
    expect(loadSession(storage).resources).toEqual({
      ...oldResources,
      mutations: [],
      zombieRevivals: 0,
    });
  });

  it("back-fills resources.maxSpellUses (issue #75) from character.spells/fixedGrants for a session persisted before it existed", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { maxSpellUses, ...oldResources } = RESOURCES;
    const storage = makeFakeStorage({
      "notequest:session": JSON.stringify({ ...FULL_SESSION, resources: oldResources }),
    });
    // CHARACTER has no starting spells at all, so the back-fill computes an empty ceiling.
    expect(loadSession(storage).resources).toEqual({ ...oldResources, maxSpellUses: {} });
  });

  it("maxSpellUses back-fill takes the higher of the creation-time grant or whatever spellUses already holds -- a save from before this fix isn't regressed any further than it already was", () => {
    const characterWithHeal: CreatedCharacter = {
      ...CHARACTER,
      fixedGrants: [{ table: "basic", spellRoll: 1, uses: 1 }],
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { maxSpellUses, ...oldResources } = RESOURCES;
    const storage = makeFakeStorage({
      "notequest:session": JSON.stringify({
        ...FULL_SESSION,
        character: characterWithHeal,
        // basic:1 exceeds its creation-time grant of 1 (an Advanced Class grant this old save
        // can't otherwise account for); basic:2 has no creation-time grant at all.
        resources: { ...oldResources, spellUses: { "basic:1": 3, "basic:2": 2 } },
      }),
    });
    expect(loadSession(storage).resources?.maxSpellUses).toEqual({ "basic:1": 3, "basic:2": 2 });
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
      liveRun: null,
    };
    saveSession(cleared, storage);
    expect(loadSession(storage)).toEqual(cleared);
  });
});

describe("liveRun (issue #141)", () => {
  const LIVE_RUN: LiveRun = {
    runId: "run-2",
    dungeon: { ...createInitialDungeonState(), hp: 3, alive: false },
    forcedTypeRoll: 4,
    noExit: true,
    enteredFromTown: true,
  };

  it("round-trips the in-progress run so a reload resumes it exactly", () => {
    const storage = makeFakeStorage();
    saveSession({ ...FULL_SESSION, liveRun: LIVE_RUN }, storage);
    expect(loadSession(storage).liveRun).toEqual(LIVE_RUN);
  });

  it("defaults to null for a save from before the field existed", () => {
    const { liveRun: _omit, ...old } = FULL_SESSION; // eslint-disable-line @typescript-eslint/no-unused-vars
    const storage = makeFakeStorage({ "notequest:session": JSON.stringify(old) });
    expect(loadSession(storage).liveRun).toBeNull();
  });

  it("drops a snapshot with no character left to resume it", () => {
    const storage = makeFakeStorage({
      "notequest:session": JSON.stringify({ ...FULL_SESSION, character: null, liveRun: LIVE_RUN }),
    });
    expect(loadSession(storage).liveRun).toBeNull();
  });
});

describe("save health (issue #142)", () => {
  beforeEach(resetSaveHealthForTests);

  /** A storage that refuses every write, like a full quota or locked-down private mode. */
  function makeRefusingStorage(): Storage {
    return {
      ...makeFakeStorage(),
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
  }

  /** Stands in for `window`, capturing the `storage` listener so a test can fire it. */
  function makeFakeWindow() {
    let listener: ((e: StorageEvent) => void) | null = null;
    return {
      target: {
        addEventListener: (_type: string, fn: (e: StorageEvent) => void) => {
          listener = fn;
        },
        removeEventListener: () => {
          listener = null;
        },
      } as unknown as Pick<Window, "addEventListener" | "removeEventListener">,
      fire: (key: string | null) => listener?.({ key } as StorageEvent),
      isListening: () => listener !== null,
    };
  }

  it("stamps the schema version onto every saved blob", () => {
    const storage = makeFakeStorage();
    saveSession(FULL_SESSION, storage);
    expect(JSON.parse(storage.getItem("notequest:session")!).schemaVersion).toBe(
      SESSION_SCHEMA_VERSION,
    );
  });

  it("reports 'failing' when storage refuses the write, and recovers once it accepts again", () => {
    const seen: string[] = [];
    subscribeSaveHealth(() => seen.push(getSaveHealth()));
    saveSession(FULL_SESSION, makeRefusingStorage());
    expect(getSaveHealth()).toBe("failing");
    saveSession(FULL_SESSION, makeFakeStorage());
    expect(getSaveHealth()).toBe("ok");
    expect(seen).toEqual(["failing", "ok"]);
  });

  it("remembers the latest session even when it couldn't be written, so an export still has it", () => {
    saveSession(FULL_SESSION, makeRefusingStorage());
    expect(getLatestSession()).toBe(FULL_SESSION);
  });

  it("stops saving once another tab writes the save, so it can't clobber the newer game", () => {
    const win = makeFakeWindow();
    const storage = makeFakeStorage();
    watchForOtherTabs(win.target);
    win.fire("notequest:session");
    expect(getSaveHealth()).toBe("superseded");
    saveSession(FULL_SESSION, storage);
    expect(storage.getItem("notequest:session")).toBeNull();
  });

  it("treats another tab clearing all storage as a takeover too", () => {
    const win = makeFakeWindow();
    watchForOtherTabs(win.target);
    win.fire(null);
    expect(getSaveHealth()).toBe("superseded");
  });

  it("ignores another tab writing only the Graveyard", () => {
    const win = makeFakeWindow();
    watchForOtherTabs(win.target);
    win.fire("notequest:graveyard");
    expect(getSaveHealth()).toBe("ok");
  });

  it("unsubscribes cleanly", () => {
    const win = makeFakeWindow();
    const stop = watchForOtherTabs(win.target);
    stop();
    expect(win.isListening()).toBe(false);
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
      liveRun: null,
    });
  });

  it("is a no-op when nothing was stored", () => {
    const storage = makeFakeStorage();
    expect(() => clearSession(storage)).not.toThrow();
  });
});
