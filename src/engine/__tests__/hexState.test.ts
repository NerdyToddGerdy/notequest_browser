import { describe, expect, it } from "vitest";
import { createInitialWorldState, revealNeighborsInPlace, type HexTile } from "../hexState.ts";
import { sequenceDie } from "../../test/mulberry32.ts";

// HOT_TERRAIN_TABLE's "plain" column: 1->water, 2->mountain, 3->forest, 4/5/6->plain.
// LOCATION_TABLE's "plain" column: 1..6 -> orcCity, goblinCity, ruins, humanCity, humanCity, humanFortress.
// Neighbor order (HEX_DIRECTIONS) from {0,0}: {1,0} {1,-1} {0,-1} {-1,0} {-1,1} {0,1}.
const HOME_REVEAL_ROLLS = [
  2, 3, // {1,0}: terrain mountain, no location
  6, 6, 4, // {1,-1}: terrain plain, location check succeeds, LOCATION_TABLE[4].plain -> humanCity
  1, 2, // {0,-1}: terrain water, no location
  4, 3, // {-1,0}: terrain plain, no location
  4, 3, // {-1,1}: terrain plain, no location
  4, 3, // {0,1}: terrain plain, no location
];

describe("createInitialWorldState", () => {
  it("starts on a human city on a plain, with all 6 neighbors already revealed", () => {
    const world = createInitialWorldState(sequenceDie(HOME_REVEAL_ROLLS));

    expect(world.climate).toBe("hot");
    expect(world.home).toEqual({ q: 0, r: 0 });
    expect(world.player).toEqual({ q: 0, r: 0 });
    expect(Object.keys(world.tiles)).toHaveLength(7);

    expect(world.tiles["0,0"]).toEqual({ terrain: "plain", location: "humanCity" });
    expect(world.tiles["1,0"]).toEqual({ terrain: "mountain", location: null });
    expect(world.tiles["1,-1"]).toEqual({ terrain: "plain", location: "humanCity" });
    expect(world.tiles["0,-1"]).toEqual({ terrain: "water", location: null });
  });
});

describe("revealNeighborsInPlace", () => {
  it("rolls a Location only when the check die lands on 6", () => {
    const tiles: Record<string, HexTile> = { "0,0": { terrain: "plain", location: null } };
    revealNeighborsInPlace(tiles, { q: 0, r: 0 }, "hot", sequenceDie([4, 6, 5]));
    // {1,0}: terrain roll 4 -> plain, location check 6 -> location roll 5 -> LOCATION_TABLE[5].plain
    expect(tiles["1,0"]).toEqual({ terrain: "plain", location: "humanCity" });
  });

  it("doesn't roll a Location when the check die isn't a 6", () => {
    const tiles: Record<string, HexTile> = { "0,0": { terrain: "plain", location: null } };
    revealNeighborsInPlace(tiles, { q: 0, r: 0 }, "hot", sequenceDie([2, 3]));
    expect(tiles["1,0"]).toEqual({ terrain: "mountain", location: null });
  });

  it("never overwrites an already-revealed tile, even one shared by two expansions", () => {
    const existing: HexTile = { terrain: "mountain", location: "ruins" };
    const tiles: Record<string, HexTile> = {
      "0,0": { terrain: "plain", location: null },
      "1,0": existing, // a neighbor of {0,0}
    };
    // If "1,0" were re-rolled, this sequence's first two rolls (1, 2) would produce
    // { terrain: "water", location: null } -- a different value than what's already there.
    revealNeighborsInPlace(tiles, { q: 0, r: 0 }, "hot", sequenceDie([1, 2, 1, 2, 1, 2, 1, 2, 1, 2]));
    expect(tiles["1,0"]).toBe(existing);
  });
});
