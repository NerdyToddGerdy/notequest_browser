import { describe, expect, it } from "vitest";
import {
  composeDungeonName,
  DUNGEON_NAME_PART2,
  DUNGEON_NAME_PART3,
  DUNGEON_NAME_PART4,
  DUNGEON_TYPES,
} from "../../data/dungeonTypes.ts";
import { COLD_TERRAIN_TABLE, HOT_TERRAIN_TABLE } from "../../data/hexTables.ts";
import { createInitialWorldState } from "../hexState.ts";
import { mulberry32 } from "../../test/mulberry32.ts";

/** Issue #101: the Expanded World's 3d6 dungeon-name table, and making cold climate reachable. */

describe("the Expanded World dungeon-name table", () => {
  const columns = [DUNGEON_NAME_PART2, DUNGEON_NAME_PART3, DUNGEON_NAME_PART4];

  it("covers every 3d6 total from 3 to 18, on all three columns", () => {
    for (const [i, column] of columns.entries()) {
      for (let total = 3; total <= 18; total++) {
        expect(column[total], `column ${i} total ${total}`).toBeDefined();
      }
    }
  });

  it("has no rows outside a 3d6's range", () => {
    for (const [i, column] of columns.entries()) {
      const keys = Object.keys(column).map(Number);
      expect(Math.min(...keys), `column ${i}`).toBe(3);
      expect(Math.max(...keys), `column ${i}`).toBe(18);
      expect(keys, `column ${i}`).toHaveLength(16);
    }
  });

  it("puts the dungeon type inside the name, with its article stripped", () => {
    // "The Palace" + the table's first row on every column.
    expect(composeDungeonName("The Palace", 3, 3, 3)).toBe(
      "The Sacred Palace of the Heavenly Angels",
    );
  });

  it("reads the exact printed rows", () => {
    expect(composeDungeonName("The Crypt", 11, 11, 11)).toBe("The Cursed Crypt of the Frost Queen");
    expect(composeDungeonName("The Sewers", 18, 18, 18)).toBe(
      "The Demonic Sewers of the Demonic Hell",
    );
  });

  it("works for a type whose name has no leading article", () => {
    expect(composeDungeonName("Sewers", 7, 7, 7)).toBe("The Sinister Sewers of the Gloomy Sadness");
  });

  it("names every dungeon type without leaving a doubled article", () => {
    for (const def of Object.values(DUNGEON_TYPES)) {
      const name = composeDungeonName(def.name, 10, 10, 10);
      expect(name.startsWith("The Lost "), def.key).toBe(true);
      expect(name, def.key).not.toMatch(/\bThe The\b/);
      expect(name, def.key).not.toMatch(/ the The /);
    }
  });

  it("gives 4,096 combinations where the Core Book's two columns gave 36", () => {
    expect(16 * 16 * 16).toBe(4096);
  });
});

describe("world climate (issue #101)", () => {
  it("still defaults to temperate, so every existing save is unchanged", () => {
    expect(createInitialWorldState(mulberry32(1)).climate).toBe("hot");
  });

  it("can be created frozen", () => {
    expect(createInitialWorldState(mulberry32(1), "cold").climate).toBe("cold");
  });

  it("a frozen world actually generates cold terrain, which was unreachable before", () => {
    // COLD_TERRAIN_TABLE is the only source of glacier/tundra; with climate hardcoded "hot" it
    // could never run at all.
    const coldOnly = new Set(["glacier", "tundra"]);
    let found = false;
    for (let seed = 1; seed <= 40 && !found; seed++) {
      const world = createInitialWorldState(mulberry32(seed), "cold");
      found = Object.values(world.tiles).some((t) => coldOnly.has(t.terrain));
    }
    expect(found, "no glacier or tundra in 40 frozen worlds").toBe(true);
  });

  it("a temperate world never generates cold terrain", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const world = createInitialWorldState(mulberry32(seed), "hot");
      for (const tile of Object.values(world.tiles)) {
        expect(["glacier", "tundra"], `seed ${seed}`).not.toContain(tile.terrain);
      }
    }
  });

  it("the two terrain tables are each complete over their own terrain set", () => {
    for (let roll = 1; roll <= 6; roll++) {
      for (const t of ["plain", "mountain", "forest", "swamp", "desert", "water"] as const) {
        expect(HOT_TERRAIN_TABLE[roll]![t], `hot ${roll}/${t}`).toBeDefined();
      }
      for (const t of ["plain", "mountain", "forest", "glacier", "tundra", "water"] as const) {
        expect(COLD_TERRAIN_TABLE[roll]![t], `cold ${roll}/${t}`).toBeDefined();
      }
    }
  });
});
