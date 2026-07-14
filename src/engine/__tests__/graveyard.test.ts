import { describe, expect, it } from "vitest";
import { addGraveyardEntry, loadGraveyard, type GraveyardEntry } from "../graveyard.ts";

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

const DEAD_ADVENTURER: GraveyardEntry = { name: "Bram", dungeon: "The Crypt of the Broken Curse", causeOfDeath: "combat" };
const FULL_ADVENTURER: GraveyardEntry = {
  name: "Cordelia",
  dungeon: "The Palace of the Secret Horrors",
  causeOfDeath: "combat",
  race: "Dwarf",
  cls: "Cook",
  monsterKills: 7,
  bossKills: 1,
};

describe("loadGraveyard", () => {
  it("is empty when nothing has been stored yet", () => {
    expect(loadGraveyard(makeFakeStorage())).toEqual([]);
  });

  it("reads back a previously stored list", () => {
    const storage = makeFakeStorage({ "notequest:graveyard": JSON.stringify([DEAD_ADVENTURER]) });
    expect(loadGraveyard(storage)).toEqual([DEAD_ADVENTURER]);
  });

  it("falls back to an empty list on corrupt JSON instead of throwing", () => {
    const storage = makeFakeStorage({ "notequest:graveyard": "{not valid json" });
    expect(loadGraveyard(storage)).toEqual([]);
  });

  it("falls back to an empty list if the stored value isn't an array", () => {
    const storage = makeFakeStorage({ "notequest:graveyard": JSON.stringify({ oops: true }) });
    expect(loadGraveyard(storage)).toEqual([]);
  });
});

describe("addGraveyardEntry", () => {
  it("appends to an empty graveyard and persists it", () => {
    const storage = makeFakeStorage();
    const next = addGraveyardEntry(DEAD_ADVENTURER, storage);
    expect(next).toEqual([DEAD_ADVENTURER]);
    expect(loadGraveyard(storage)).toEqual([DEAD_ADVENTURER]);
  });

  it("appends to an existing graveyard without dropping earlier entries", () => {
    const storage = makeFakeStorage({ "notequest:graveyard": JSON.stringify([DEAD_ADVENTURER]) });
    const second: GraveyardEntry = { name: "Yorick", dungeon: "The Palace of the Secret Horrors", causeOfDeath: "darkness" };
    const next = addGraveyardEntry(second, storage);
    expect(next).toEqual([DEAD_ADVENTURER, second]);
  });

  it("persists race/cls/monsterKills/bossKills alongside an entry with no earlier entries missing them", () => {
    const storage = makeFakeStorage();
    const next = addGraveyardEntry(FULL_ADVENTURER, storage);
    expect(next).toEqual([FULL_ADVENTURER]);
    expect(loadGraveyard(storage)).toEqual([FULL_ADVENTURER]);
  });

  it("tolerates an older entry (from before race/cls/kills existed) mixed in with a newer one", () => {
    const storage = makeFakeStorage({ "notequest:graveyard": JSON.stringify([DEAD_ADVENTURER]) });
    const next = addGraveyardEntry(FULL_ADVENTURER, storage);
    expect(next).toEqual([DEAD_ADVENTURER, FULL_ADVENTURER]);
    expect(next[0]!.race).toBeUndefined();
    expect(next[1]!.race).toBe("Dwarf");
  });
});
