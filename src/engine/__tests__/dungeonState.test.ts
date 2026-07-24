import { describe, expect, it } from "vitest";
import {
  createInitialDungeonState,
  isDungeonBeaten,
  makeLevel,
  sortDungeonsForDisplay,
  type PendingDungeon,
  type SegmentState,
} from "../dungeonState.ts";

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

describe("sortDungeonsForDisplay (issue #80)", () => {
  function unbeaten(id: string): PendingDungeon {
    return { id, dungeon: createInitialDungeonState(), lastCharacterName: "Pip" };
  }

  function beaten(id: string): PendingDungeon {
    const finalSeg = makeSegment({ id: 1, type: "final", doors: [], monstersDefeated: true });
    const level = { ...makeLevel(3), isFinalRoomLevel: true, segments: [finalSeg] };
    return { id, dungeon: { ...createInitialDungeonState(), levels: [level] }, lastCharacterName: "Pip" };
  }

  it("puts every unfinished dungeon before every cleared one", () => {
    const input = [beaten("b1"), unbeaten("u1"), beaten("b2"), unbeaten("u2")];
    const sorted = sortDungeonsForDisplay(input).map((pd) => pd.id);
    expect(sorted).toEqual(["u1", "u2", "b1", "b2"]);
  });

  it("is a stable sort -- preserves the caller's own secondary order within each group", () => {
    // Callers (WorldScreen's distance sort, CharacterCreationScreen's recency reversal) are
    // responsible for the order handed in; this only ever layers the beaten/unfinished split on
    // top without disturbing it.
    const input = [unbeaten("far"), unbeaten("near"), beaten("old"), beaten("recent")];
    const sorted = sortDungeonsForDisplay(input).map((pd) => pd.id);
    expect(sorted).toEqual(["far", "near", "old", "recent"]);
  });

  it("does not mutate the input array", () => {
    const input = [beaten("b1"), unbeaten("u1")];
    const copy = [...input];
    sortDungeonsForDisplay(input);
    expect(input).toEqual(copy);
  });
});
