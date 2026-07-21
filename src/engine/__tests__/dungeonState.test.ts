import { describe, expect, it } from "vitest";
import { createInitialDungeonState, isDungeonBeaten, makeLevel, type SegmentState } from "../dungeonState.ts";

function makeSegment(overrides: Partial<SegmentState> & Pick<SegmentState, "id" | "type" | "doors">): SegmentState {
  return {
    x: 0,
    y: 0,
    w: 80,
    h: 80,
    cx: 0,
    cy: 0,
    cameFromDir: null,
    flavor: null,
    isEntrance: false,
    ...overrides,
  };
}

describe("isDungeonBeaten", () => {
  it("is false for a dungeon with no Final Room level at all", () => {
    const room = makeSegment({ id: 1, type: "room-small", doors: [] });
    const state = { ...createInitialDungeonState(), levels: [{ ...makeLevel(1), segments: [room] }] };
    expect(isDungeonBeaten(state)).toBe(false);
  });

  it("is true for a descend-final level, where the Final Room is segments[0]", () => {
    const finalSeg = makeSegment({ id: 1, type: "final", doors: [], monstersDefeated: true });
    const level = { ...makeLevel(3), isFinalRoomLevel: true, segments: [finalSeg] };
    const state = { ...createInitialDungeonState(), levels: [level] };
    expect(isDungeonBeaten(state)).toBe(true);
  });

  it("is false for a descend-final level whose Boss isn't defeated yet", () => {
    const finalSeg = makeSegment({ id: 1, type: "final", doors: [] });
    const level = { ...makeLevel(3), isFinalRoomLevel: true, segments: [finalSeg] };
    const state = { ...createInitialDungeonState(), levels: [level] };
    expect(isDungeonBeaten(state)).toBe(false);
  });

  it("is true for a dead-end-final level, where the Final Room sits at a non-zero index (bug regression)", () => {
    const room = makeSegment({ id: 1, type: "room-small", doors: [] });
    const finalSeg = makeSegment({ id: 2, type: "final", doors: [], monstersDefeated: true });
    const level = { ...makeLevel(1), isFinalRoomLevel: true, segments: [room, finalSeg] };
    const state = { ...createInitialDungeonState(), levels: [level] };
    expect(isDungeonBeaten(state)).toBe(true);
  });

  it("is false for a dead-end-final level whose Boss isn't defeated yet", () => {
    const room = makeSegment({ id: 1, type: "room-small", doors: [] });
    const finalSeg = makeSegment({ id: 2, type: "final", doors: [] });
    const level = { ...makeLevel(1), isFinalRoomLevel: true, segments: [room, finalSeg] };
    const state = { ...createInitialDungeonState(), levels: [level] };
    expect(isDungeonBeaten(state)).toBe(false);
  });

  it("is true even with isFinalRoomLevel left false -- a saved dungeon from before this fix must retroactively read as beaten", () => {
    const room = makeSegment({ id: 1, type: "room-small", doors: [] });
    const finalSeg = makeSegment({ id: 2, type: "final", doors: [], monstersDefeated: true });
    const level = { ...makeLevel(1), isFinalRoomLevel: false, segments: [room, finalSeg] };
    const state = { ...createInitialDungeonState(), levels: [level] };
    expect(isDungeonBeaten(state)).toBe(true);
  });
});
