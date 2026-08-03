import { describe, expect, it } from "vitest";

import { terrainBelongsToClimate, type Terrain } from "../../data/hexTables.ts";
import { mulberry32, sequenceDie } from "../../test/mulberry32.ts";
import {
  climateAt,
  COLD_LATITUDE,
  createInitialWorldState,
  hexKey,
  revealNeighborsInPlace,
  worldClimateAt,
  type HexCoord,
  type HexTile,
} from "../hexState.ts";

/**
 * Climate transitions (issue #107) -- one world containing both warm and cold regions, so the 3
 * dungeon types, 4 Animals, 2 locations and 4 Event rows that were gated behind #101's one-time
 * world-wide choice are reachable from a single save.
 */

const HOME: HexCoord = { q: 0, r: 0 };

describe("climateAt", () => {
  it("keeps a hot world's home in the temperate band", () => {
    expect(climateAt(HOME, HOME, "hot")).toBe("hot");
  });

  it("turns cold in both directions once past the latitude, not just one", () => {
    // q=0 has no wobble, so the boundary sits exactly at COLD_LATITUDE here.
    expect(climateAt({ q: 0, r: COLD_LATITUDE - 1 }, HOME, "hot")).toBe("hot");
    expect(climateAt({ q: 0, r: COLD_LATITUDE }, HOME, "hot")).toBe("cold");
    expect(climateAt({ q: 0, r: -COLD_LATITUDE }, HOME, "hot")).toBe("cold");
  });

  it("puts a cold world's home deep in its own band, not on the edge of it", () => {
    expect(climateAt(HOME, HOME, "cold")).toBe("cold");
    // As far from the nearest boundary as a hot-world home is, rather than balanced on it.
    expect(climateAt({ q: 0, r: COLD_LATITUDE - 1 }, HOME, "cold")).toBe("cold");
    expect(climateAt({ q: 0, r: COLD_LATITUDE + 1 }, HOME, "cold")).toBe("hot");
  });

  it("reaches the temperate band from a cold home in about COLD_LATITUDE hexes", () => {
    const firstHot = Array.from({ length: 40 }, (_, r) => r).find(
      (r) => climateAt({ q: 0, r }, HOME, "cold") === "hot",
    );
    expect(firstHot).toBeGreaterThan(COLD_LATITUDE - 3);
    expect(firstHot).toBeLessThan(COLD_LATITUDE + 3);
  });

  it("is a pure function of position -- same coord, same answer, no reveal order to depend on", () => {
    const coord = { q: 3, r: 9 };
    expect(climateAt(coord, HOME, "hot")).toBe(climateAt(coord, HOME, "hot"));
  });

  it("wobbles the boundary across q rather than drawing a straight row", () => {
    // The whole point of the perturbation: the first cold row must not be identical for every q.
    const firstColdRow = (q: number) =>
      Array.from({ length: 30 }, (_, r) => r).find(
        (r) => climateAt({ q, r }, HOME, "hot") === "cold",
      );
    const rows = new Set(Array.from({ length: 24 }, (_, q) => firstColdRow(q - 12)));
    expect(rows.size).toBeGreaterThan(1);
  });
});

describe("nextTerrain totality (the hazard #107 identified)", () => {
  /** Reveals `of`'s neighbours against a fixed climate, whatever the parent's terrain is. */
  function revealFrom(parentTerrain: Terrain, climate: "hot" | "cold"): HexTile[] {
    const tiles: Record<string, HexTile> = {
      [hexKey(HOME)]: { terrain: parentTerrain, location: null },
    };
    revealNeighborsInPlace(
      tiles,
      HOME,
      () => climate,
      sequenceDie([1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6]),
    );
    return Object.entries(tiles)
      .filter(([key]) => key !== hexKey(HOME))
      .map(([, tile]) => tile);
  }

  it("never yields undefined terrain for a hot-only parent read against the cold band", () => {
    // `swamp` has no column in COLD_TERRAIN_TABLE at all -- before this was made total, the `!`
    // guarded the roll index and not the terrain key, so this produced `undefined` terrain that
    // flowed on into DUNGEON_TYPE_BY_TERRAIN / EVENT_TABLE lookups.
    for (const tile of revealFrom("swamp", "cold")) {
      expect(tile.terrain).toBeDefined();
      expect(typeof tile.terrain).toBe("string");
    }
    for (const tile of revealFrom("desert", "cold")) {
      expect(tile.terrain).toBeDefined();
    }
  });

  it("never yields undefined terrain for a cold-only parent read against the hot band", () => {
    for (const tile of revealFrom("glacier", "hot")) {
      expect(tile.terrain).toBeDefined();
    }
    for (const tile of revealFrom("tundra", "hot")) {
      expect(tile.terrain).toBeDefined();
    }
  });

  it("falls back to the parent's own band, so an exclusive parent yields its own band's terrain", () => {
    // A swamp resolved "as cold" still reads the hot table, because that's the table that knows what
    // a swamp leads to -- one extra hex of the old climate rather than an invalid tile.
    for (const tile of revealFrom("swamp", "cold")) {
      expect(terrainBelongsToClimate(tile.terrain, "hot")).toBe(true);
    }
  });

  it("uses the requested band for a shared parent, which is what makes a transition possible", () => {
    // plain/mountain/forest/water are legal in both tables -- the four that let the map change over.
    for (const tile of revealFrom("plain", "cold")) {
      expect(terrainBelongsToClimate(tile.terrain, "cold")).toBe(true);
    }
    for (const tile of revealFrom("plain", "hot")) {
      expect(terrainBelongsToClimate(tile.terrain, "hot")).toBe(true);
    }
  });
});

describe("a single world holds both bands", () => {
  /** Sweeps outward from every known tile `passes` times, the same primitive
   * `findOrRevealCompatibleHome()` uses to grow the map. */
  function revealOutward(passes: number) {
    const rng = mulberry32(42);
    const world = createInitialWorldState(rng, "hot");
    const tiles = { ...world.tiles };
    for (let i = 0; i < passes; i++) {
      for (const key of Object.keys(tiles)) {
        const [q, r] = key.split(",").map(Number);
        revealNeighborsInPlace(tiles, { q: q!, r: r! }, (c) => worldClimateAt(world, c), rng);
      }
    }
    return tiles;
  }

  it("generates cold-only and hot-only terrain in the same map", () => {
    const terrains = new Set(Object.values(revealOutward(14)).map((t) => t.terrain));

    // Hot-only: the Pyramid/Necropolis/Camel/Raptor/Oasis half.
    expect(terrains.has("desert") || terrains.has("swamp")).toBe(true);
    // Cold-only: the Ziggurat/Polar Bear/Mammoth/Thin Ice half, dead in a hot world before #107.
    expect(terrains.has("glacier") || terrains.has("tundra")).toBe(true);
  });

  it("keeps the cold terrain out at latitude rather than scattering it through the middle", () => {
    const tiles = revealOutward(14);
    const nearHome = Object.entries(tiles).filter(([key]) => {
      const r = Number(key.split(",")[1]);
      return Math.abs(r) <= 3;
    });
    // The temperate middle stays temperate -- no glacier islands in the tropics.
    for (const [, tile] of nearHome) {
      expect(tile.terrain === "glacier" || tile.terrain === "tundra").toBe(false);
    }
  });
});

describe("existing saves", () => {
  it("gain cold territory without migration -- climate is positional, not stored", () => {
    // A world object built the old way (one climate, no per-tile field) answers per-coordinate now.
    const world = createInitialWorldState(mulberry32(7), "hot");
    expect(world.climate).toBe("hot"); // the field survives, meaning "which band is home in"
    expect(worldClimateAt(world, HOME)).toBe("hot");
    expect(worldClimateAt(world, { q: 0, r: COLD_LATITUDE + 4 })).toBe("cold");
  });
});
