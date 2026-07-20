import { describe, expect, it } from "vitest";
import { createInitialWorldState } from "../hexState.ts";
import { hexReducer } from "../hexReducer.ts";
import { sequenceDie } from "../../test/mulberry32.ts";

const HOME_REVEAL_ROLLS = [
  2, 3, // {1,0}: mountain, no location
  6, 6, 4, // {1,-1}: plain, humanCity
  1, 1, // {1,-1}'s name: "Iron" + "hold" -> "Ironhold"
  1, 2, // {0,-1}: water, no location
  4, 3, // {-1,0}: plain, no location
  4, 3, // {-1,1}: plain, no location
  4, 3, // {0,1}: plain, no location
];

function homeWorld() {
  return createInitialWorldState(sequenceDie(HOME_REVEAL_ROLLS));
}

describe("hexReducer MOVE", () => {
  it("moves the player onto a revealed, passable neighbor and reveals its own neighbors", () => {
    const world = homeWorld();
    const next = hexReducer(world, { type: "MOVE", to: { q: 1, r: 0 }, raceName: "Human" }, sequenceDie([3, 4]));
    expect(next.player).toEqual({ q: 1, r: 0 });
    expect(Object.keys(next.tiles).length).toBeGreaterThan(Object.keys(world.tiles).length);
    expect(next.tiles["0,0"]).toEqual(world.tiles["0,0"]); // untouched
  });

  it("is a no-op for a non-neighboring hex", () => {
    const world = homeWorld();
    const next = hexReducer(world, { type: "MOVE", to: { q: 5, r: 5 }, raceName: "Human" });
    expect(next).toBe(world);
  });

  it("is a no-op onto water without a boat", () => {
    const world = homeWorld();
    // {0,-1} was revealed as water by the fixture above.
    const next = hexReducer(world, { type: "MOVE", to: { q: 0, r: -1 }, raceName: "Human" });
    expect(next).toBe(world);
  });

  it("lets a water-walking race (Patovsky/Sharkin) cross water with no boat at all", () => {
    const world = homeWorld();
    const next = hexReducer(world, { type: "MOVE", to: { q: 0, r: -1 }, raceName: "Sharkin" }, sequenceDie([3, 4]));
    expect(next.player).toEqual({ q: 0, r: -1 });
    expect(next.hasBoat).toBe(false); // never needed one in the first place
  });

  it("is a no-op onto a City/Fortress hex the race has no Affinity for", () => {
    const world = homeWorld();
    // {1,-1} was revealed as a humanCity by the fixture above -- Orc has no Affinity there.
    const next = hexReducer(world, { type: "MOVE", to: { q: 1, r: -1 }, raceName: "Orc" });
    expect(next).toBe(world);
  });

  it("allows a race with Affinity onto the same City hex", () => {
    const world = homeWorld();
    const next = hexReducer(world, { type: "MOVE", to: { q: 1, r: -1 }, raceName: "Human" }, sequenceDie([3, 4]));
    expect(next.player).toEqual({ q: 1, r: -1 });
  });
});

describe("hexReducer HIRE_BOAT / boat-assisted MOVE", () => {
  it("is a no-op when not standing in a City/Fortress", () => {
    const world = homeWorld();
    const awayFromHome = hexReducer(world, { type: "MOVE", to: { q: 1, r: 0 }, raceName: "Human" }, sequenceDie([3, 4]));
    const next = hexReducer(awayFromHome, { type: "HIRE_BOAT" });
    expect(next).toBe(awayFromHome);
  });

  it("is a no-op when the current City/Fortress isn't beside water", () => {
    const world = homeWorld();
    // Standing at home ({0,0}, humanCity) -- fixture's revealed neighbors have no water tile
    // adjacent to home itself (only {0,-1} is water, and home's own neighbors are what's checked).
    // {0,-1} *is* one of home's neighbors, so hire boat should actually succeed here -- use a
    // fixture-free minimal world instead to exercise the "no water adjacent" branch cleanly.
    const noWaterWorld = {
      ...world,
      tiles: { ...world.tiles, "0,-1": { terrain: "plain" as const, location: null } },
    };
    const next = hexReducer(noWaterWorld, { type: "HIRE_BOAT" });
    expect(next).toBe(noWaterWorld);
  });

  it("sets hasBoat when standing in a City/Fortress beside water", () => {
    const world = homeWorld();
    const next = hexReducer(world, { type: "HIRE_BOAT" });
    expect(next.hasBoat).toBe(true);
  });

  it("lets a MOVE onto water succeed once hired, then auto-clears hasBoat on landing", () => {
    const world = homeWorld();
    const withBoat = hexReducer(world, { type: "HIRE_BOAT" });
    const onWater = hexReducer(
      withBoat,
      { type: "MOVE", to: { q: 0, r: -1 }, raceName: "Human" },
      sequenceDie([3, 4]),
    );
    expect(onWater.player).toEqual({ q: 0, r: -1 });
    expect(onWater.hasBoat).toBe(true); // still on water -- boat not left yet

    // Reveal a non-water neighbor to land on next, then confirm hasBoat clears.
    const withLandNeighbor = {
      ...onWater,
      tiles: { ...onWater.tiles, "1,-1": { terrain: "plain" as const, location: null } },
    };
    const backOnLand = hexReducer(
      withLandNeighbor,
      { type: "MOVE", to: { q: 1, r: -1 }, raceName: "Human" },
      sequenceDie([3, 4]),
    );
    expect(backOnLand.hasBoat).toBe(false);
  });
});

describe("hexReducer ASK_FOR_DUNGEON", () => {
  it("is a no-op when not standing in a City/Fortress", () => {
    const world = homeWorld();
    const awayFromHome = hexReducer(world, { type: "MOVE", to: { q: 1, r: 0 }, raceName: "Human" }, sequenceDie([3, 4]));
    const next = hexReducer(awayFromHome, { type: "ASK_FOR_DUNGEON" }, sequenceDie([1]));
    expect(next).toBe(awayFromHome);
  });

  it("marks the first qualifying neighbor at the rolled side", () => {
    const world = homeWorld();
    // Roll 1 -> {1,0} (mountain, no location) qualifies directly.
    const next = hexReducer(world, { type: "ASK_FOR_DUNGEON" }, sequenceDie([1]));
    expect(next.tiles["1,0"]).toMatchObject({ dungeonMarked: true });
  });

  it("is a no-op once a neighbor already has a dungeon marked", () => {
    const world = homeWorld();
    const asked = hexReducer(world, { type: "ASK_FOR_DUNGEON" }, sequenceDie([1]));
    const next = hexReducer(asked, { type: "ASK_FOR_DUNGEON" }, sequenceDie([2]));
    expect(next).toBe(asked);
  });

  it("is a no-op once a neighbor already has a dungeonRunId", () => {
    const world = {
      ...homeWorld(),
      tiles: {
        ...homeWorld().tiles,
        "1,0": { terrain: "mountain" as const, location: null, dungeonRunId: "run-1" },
      },
    };
    const next = hexReducer(world, { type: "ASK_FOR_DUNGEON" }, sequenceDie([2]));
    expect(next).toBe(world);
  });
});

describe("hexReducer MOVE onto a Thug-Life-banned hex", () => {
  it("is a no-op even onto an otherwise passable, in-Affinity neighbor", () => {
    const world = { ...homeWorld(), bannedHexes: ["1,0"] };
    const next = hexReducer(world, { type: "MOVE", to: { q: 1, r: 0 }, raceName: "Human" }, sequenceDie([3, 4]));
    expect(next).toBe(world);
  });
});
