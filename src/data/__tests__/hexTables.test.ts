import { describe, expect, it } from "vitest";
import { DUNGEON_TYPES } from "../dungeonTypes.ts";
import { DUNGEON_TYPE_BY_TERRAIN, hasWaterWalk, isFortressLocation, travelCostMultiplier } from "../hexTables.ts";
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

describe("hasWaterWalk (New Races, issue #22)", () => {
  it("is true for Patovsky and Sharkin", () => {
    expect(hasWaterWalk("Patovsky")).toBe(true);
    expect(hasWaterWalk("Sharkin")).toBe(true);
  });

  it("is false for any other race", () => {
    expect(hasWaterWalk("Human")).toBe(false);
    expect(hasWaterWalk("Rinoceroid")).toBe(false);
  });
});

describe("travelCostMultiplier (New Races, issue #22)", () => {
  it("is 2 for Pandakhan, 0.5 for Centaur, 1 for everyone else", () => {
    expect(travelCostMultiplier("Pandakhan")).toBe(2);
    expect(travelCostMultiplier("Centaur")).toBe(0.5);
    expect(travelCostMultiplier("Human")).toBe(1);
  });
});
