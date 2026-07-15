import { describe, expect, it } from "vitest";
import { createInitialWorldState } from "../hexState.ts";
import { hexReducer } from "../hexReducer.ts";
import { sequenceDie } from "../../test/mulberry32.ts";

const HOME_REVEAL_ROLLS = [
  2, 3, // {1,0}: mountain, no location
  6, 6, 4, // {1,-1}: plain, humanCity
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
    const next = hexReducer(world, { type: "MOVE", to: { q: 1, r: 0 } }, sequenceDie([3, 4]));
    expect(next.player).toEqual({ q: 1, r: 0 });
    expect(Object.keys(next.tiles).length).toBeGreaterThan(Object.keys(world.tiles).length);
    expect(next.tiles["0,0"]).toEqual(world.tiles["0,0"]); // untouched
  });

  it("is a no-op for a non-neighboring hex", () => {
    const world = homeWorld();
    const next = hexReducer(world, { type: "MOVE", to: { q: 5, r: 5 } });
    expect(next).toBe(world);
  });

  it("is a no-op onto water", () => {
    const world = homeWorld();
    // {0,-1} was revealed as water by the fixture above.
    const next = hexReducer(world, { type: "MOVE", to: { q: 0, r: -1 } });
    expect(next).toBe(world);
  });
});
