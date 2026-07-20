import { describe, expect, it } from "vitest";
import { DUNGEON_TYPES } from "../dungeonTypes.ts";
import { DUNGEON_TYPE_BY_TERRAIN, isFortressLocation } from "../hexTables.ts";
import type { Terrain } from "../hexTables.ts";

const ALL_TERRAINS: Terrain[] = ["plain", "mountain", "forest", "swamp", "desert", "tundra", "water", "glacier"];

describe("DUNGEON_TYPE_BY_TERRAIN completeness", () => {
  it("has a full 1-6 row for every terrain", () => {
    for (const terrain of ALL_TERRAINS) {
      const row = DUNGEON_TYPE_BY_TERRAIN[terrain];
      expect(row, `missing row for ${terrain}`).toBeDefined();
      for (let roll = 1; roll <= 6; roll++) {
        expect(row[roll], `${terrain} roll ${roll}`).toBeDefined();
      }
    }
  });

  it("every value resolves to an existing DUNGEON_TYPES entry", () => {
    for (const terrain of ALL_TERRAINS) {
      for (let roll = 1; roll <= 6; roll++) {
        const typeRoll = DUNGEON_TYPE_BY_TERRAIN[terrain]![roll]!;
        expect(DUNGEON_TYPES[typeRoll], `${terrain} roll ${roll} -> typeRoll ${typeRoll}`).toBeDefined();
      }
    }
  });
});

describe("isFortressLocation", () => {
  it("is true for every playable Fortress location", () => {
    expect(isFortressLocation("orcFortress")).toBe(true);
    expect(isFortressLocation("humanFortress")).toBe(true);
    expect(isFortressLocation("dwarvenFortress")).toBe(true);
    expect(isFortressLocation("elvenFortress")).toBe(true);
  });

  it("is false for a City, null, or any other location", () => {
    expect(isFortressLocation("humanCity")).toBe(false);
    expect(isFortressLocation("goblinCity")).toBe(false);
    expect(isFortressLocation("ruins")).toBe(false);
    expect(isFortressLocation(null)).toBe(false);
  });
});
