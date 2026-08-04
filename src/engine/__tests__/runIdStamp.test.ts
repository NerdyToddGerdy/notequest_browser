import { describe, expect, it } from "vitest";

import { hexKey, withoutRunIdStamp, type HexCoord, type WorldState } from "../hexState.ts";

/**
 * Issue #123: a hex's `dungeonRunId`/`sewerRunId` is stamped the instant "Enter Dungeon" is clicked,
 * before the run has rolled anything. Backing out of the pre-roll gate drops the never-rolled run,
 * and the stamp has to go with it -- otherwise the hex points at an id that exists nowhere and every
 * later visit silently rolls a fresh dungeon under a self-minted id.
 */

const A: HexCoord = { q: 0, r: 0 };
const B: HexCoord = { q: 1, r: 0 };

function worldWith(tiles: WorldState["tiles"]): WorldState {
  return {
    climate: "hot",
    home: A,
    player: A,
    hasBoat: false,
    bannedHexes: [],
    tiles,
  };
}

describe("withoutRunIdStamp", () => {
  it("clears a dungeon stamp from whichever hex holds it", () => {
    const world = worldWith({
      [hexKey(A)]: { terrain: "plain", location: null },
      [hexKey(B)]: { terrain: "plain", location: "ruins", dungeonRunId: "run-a" },
    });

    const next = withoutRunIdStamp(world, "run-a");

    expect(next.tiles[hexKey(B)]!.dungeonRunId).toBeUndefined();
    // The rest of the tile is untouched -- this removes a pointer, not the hex's identity.
    expect(next.tiles[hexKey(B)]!.location).toBe("ruins");
  });

  it("clears a sewer stamp too, which had the identical hole", () => {
    const world = worldWith({
      [hexKey(A)]: { terrain: "plain", location: "humanFortress", sewerRunId: "run-s" },
    });

    const next = withoutRunIdStamp(world, "run-s");

    expect(next.tiles[hexKey(A)]!.sewerRunId).toBeUndefined();
  });

  it("leaves the Fortress's own dungeon alone when only its sewers are dropped", () => {
    // The one hex that carries both stamps at once (issue #99) -- they're independent runs.
    const world = worldWith({
      [hexKey(A)]: {
        terrain: "plain",
        location: "humanFortress",
        dungeonRunId: "run-d",
        sewerRunId: "run-s",
      },
    });

    const next = withoutRunIdStamp(world, "run-s");

    expect(next.tiles[hexKey(A)]!.sewerRunId).toBeUndefined();
    expect(next.tiles[hexKey(A)]!.dungeonRunId).toBe("run-d");
  });

  it("is a no-op for an id nothing holds", () => {
    const world = worldWith({
      [hexKey(A)]: { terrain: "plain", location: null, dungeonRunId: "run-a" },
    });

    expect(withoutRunIdStamp(world, "run-nope")).toBe(world);
  });
});
