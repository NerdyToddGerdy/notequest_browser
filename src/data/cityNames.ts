import type { CityCulture } from "./affinity.ts";

/** City/Fortress name generator (issue #49) -- not from the rulebook, a v1-scoped extra mirroring
 * `dungeonTypes.ts`'s own `DUNGEON_NAME_SECOND`/`DUNGEON_NAME_THIRD` "prefix + suffix" flavor-
 * combination pattern, and `names.ts`'s per-race character name tables (issue #40) -- same "a lot
 * of small flavor tables, keyed by race/culture" shape of work, just for settlements instead of
 * people. Two 1d6 rolls (prefix, suffix) combine into one compound word per culture (e.g.
 * "Ironhold"), giving 36 distinct names per culture without needing a huge unique-name pool. */
export const CITY_NAME_PREFIX: Record<CityCulture, Record<number, string>> = {
  human: { 1: "Iron", 2: "Silver", 3: "White", 4: "Green", 5: "Stone", 6: "Long" },
  dwarven: { 1: "Deep", 2: "Iron", 3: "Grim", 4: "Stone", 5: "Gold", 6: "Under" },
  elven: { 1: "Silver", 2: "Moon", 3: "Wind", 4: "Star", 5: "Willow", 6: "Dawn" },
  gnome: { 1: "Tinker", 2: "Puzzle", 3: "Copper", 4: "Bramble", 5: "Fizzle", 6: "Spark" },
  goblin: { 1: "Mud", 2: "Snag", 3: "Grot", 4: "Fang", 5: "Skitter", 6: "Bog" },
  orc: { 1: "Blood", 2: "Skull", 3: "Iron", 4: "War", 5: "Bone", 6: "Black" },
};

export const CITY_NAME_SUFFIX: Record<CityCulture, Record<number, string>> = {
  human: { 1: "hold", 2: "brook", 3: "haven", 4: "ford", 5: "gate", 6: "wood" },
  dwarven: { 1: "forge", 2: "hammer", 3: "delve", 4: "hold", 5: "vein", 6: "mount" },
  elven: { 1: "leaf", 2: "glade", 3: "spire", 4: "wood", 5: "song", 6: "mere" },
  gnome: { 1: "gear", 2: "burrow", 3: "cog", 4: "hollow", 5: "wick", 6: "ville" },
  goblin: { 1: "hole", 2: "pit", 3: "gully", 4: "warren", 5: "nest", 6: "muck" },
  orc: { 1: "fang", 2: "crush", 3: "maw", 4: "camp", 5: "spike", 6: "ridge" },
};
