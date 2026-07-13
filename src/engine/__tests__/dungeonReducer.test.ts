import { describe, expect, it } from "vitest";
import { dungeonReducer } from "../dungeonReducer.ts";
import { DUNGEON_TABLES } from "../../data/dungeonTables.ts";
import { createInitialDungeonState, makeLevel, type DungeonState, type SegmentState } from "../dungeonState.ts";
import { mulberry32, sequenceDie } from "../../test/mulberry32.ts";

function makeSegment(overrides: Partial<SegmentState> & Pick<SegmentState, "id" | "type" | "doors">): SegmentState {
  return { x: 0, y: 0, w: 80, h: 80, cx: 0, cy: 0, cameFromDir: null, flavor: null, isEntrance: false, ...overrides };
}

function stateWithLevel(level: ReturnType<typeof makeLevel>, activeLevel = 0): DungeonState {
  return { ...createInitialDungeonState(), dungeonTypeKey: "palace", levels: [level], activeLevel, nextSegmentId: 100 };
}

describe("ROLL_DUNGEON", () => {
  it("builds a staircase entrance level for the Crypt (type roll 2)", () => {
    const rng = mulberry32(1);
    const state = dungeonReducer(
      createInitialDungeonState(),
      { type: "ROLL_DUNGEON", typeRoll: 2, secondRoll: 1, thirdRoll: 1 },
      rng,
    );
    expect(state.dungeonTypeKey).toBe("crypt");
    expect(state.dungeonName).toBe("The Crypt of the Secret Horrors");
    expect(state.levels).toHaveLength(1);
    const entrance = state.levels[0]!.segments[0]!;
    expect(entrance.type).toBe("staircase");
    expect(entrance.isEntrance).toBe(true);
    expect(entrance.doors).toHaveLength(1);
    expect(state.levels[0]!.doorsRemaining).toBe(1);
    // The entrance is a staircase down INTO level 1, not a way further down from it --
    // hasStaircase only becomes true once a real staircase is found while exploring.
    expect(state.levels[0]!.hasStaircase).toBe(false);
    expect(state.stats.staircases).toBe(1);
    expect(state.stats.doorsRemaining).toBe(1);
    expect(state.torches).toBe(9); // started at 10, entering the dungeon costs 1
    expect(state.alive).toBe(true);
  });

  it("opening a staircase entrance's door continues level 1 instead of descending to level 2", () => {
    const rng = sequenceDie([3]); // staircase column, roll 3 -> "Corridor with two other doors."
    const rolled = dungeonReducer(
      createInitialDungeonState(),
      { type: "ROLL_DUNGEON", typeRoll: 2, secondRoll: 1, thirdRoll: 1 },
      rng,
    );
    const entrance = rolled.levels[0]!.segments[0]!;
    expect(entrance.doors).toHaveLength(1);

    const next = dungeonReducer(rolled, { type: "OPEN_DOOR", segId: entrance.id, doorIdx: 0, roll: 3, wasNoisy: false }, rng);

    expect(next.levels).toHaveLength(1); // still on level 1, no second level created
    expect(next.activeLevel).toBe(0);
    expect(next.levels[0]!.segments).toHaveLength(2);
    const child = next.levels[0]!.segments[1]!;
    expect(child.type).toBe("corridor"); // the staircase column's result, per the Segments table
    expect(child.isEntrance).toBe(false);
  });

  it("rolls Room Content/Monsters for a room-type entrance (Palace)", () => {
    // content sum 4, monster sum 6
    const rng = sequenceDie([2, 2, 3, 3]);
    const state = dungeonReducer(
      createInitialDungeonState(),
      { type: "ROLL_DUNGEON", typeRoll: 1, secondRoll: 1, thirdRoll: 1 },
      rng,
    );
    const entrance = state.levels[0]!.segments[0]!;
    expect(entrance.type).toBe("room-large");
    expect(entrance.roomContent).toBeDefined();
    expect(entrance.monsters).toBeDefined();
  });
});

describe("OPEN_DOOR: normal room resolution", () => {
  it("adds a connected child segment and updates per-level and global stats", () => {
    // Two doors, so opening one of them isn't "the last door on the level"
    // (which would instead trigger the dead-end-final Boss rule -- covered separately below).
    const entrance = makeSegment({
      id: 1,
      type: "corridor",
      w: 60,
      h: 140,
      doors: [
        { dir: "E", opened: false, childId: null, leadsToLevel: null },
        { dir: "N", opened: false, childId: null, leadsToLevel: null },
      ],
    });
    const level = { ...makeLevel(1), segments: [entrance], doorsRemaining: 2 };
    const state = { ...stateWithLevel(level), stats: { ...createInitialDungeonState().stats, doorsRemaining: 2 } };

    const next = dungeonReducer(state, { type: "OPEN_DOOR", segId: 1, doorIdx: 0, roll: 1, wasNoisy: false });

    expect(next.levels[0]!.segments).toHaveLength(2);
    const child = next.levels[0]!.segments[1]!;
    expect(child.type).toBe("room-small"); // corridor column, roll 1
    expect(next.levels[0]!.connectors).toHaveLength(1);
    expect(next.levels[0]!.segments[0]!.doors[0]!.opened).toBe(true);
    expect(next.levels[0]!.segments[0]!.doors[0]!.childId).toBe(child.id);
    // consumed 1 door, gained 1 -> net 0 change
    expect(next.levels[0]!.doorsRemaining).toBe(2);
    expect(next.stats.segments).toBe(1);
    expect(next.stats.rooms).toBe(1);
    expect(next.stats.doorsRemaining).toBe(2);
    expect(next.log[0]!.message).toContain("Segment 1");
  });
});

describe("OPEN_DOOR: staircases", () => {
  it("descend-normal creates a fresh level and switches to it", () => {
    const stair = makeSegment({
      id: 1,
      type: "staircase",
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
    });
    const level = { ...makeLevel(1), segments: [stair], doorsRemaining: 1, hasStaircase: true };
    const state = stateWithLevel(level);

    const next = dungeonReducer(state, { type: "OPEN_DOOR", segId: 1, doorIdx: 0, roll: 3, wasNoisy: false });

    expect(next.levels).toHaveLength(2);
    expect(next.activeLevel).toBe(1);
    expect(next.levels[1]!.depth).toBe(2);
    expect(next.levels[1]!.segments[0]!.type).toBe("corridor"); // staircase column always resolves to corridor
    expect(next.levels[0]!.stairwayTarget).toBe(1);
    expect(next.levels[0]!.doorsRemaining).toBe(0);
  });

  it("descend-final drops straight into an automatic, doorless Final Room at depth 3", () => {
    const stair = makeSegment({
      id: 1,
      type: "staircase",
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
    });
    const level = { ...makeLevel(2), segments: [stair], doorsRemaining: 1, hasStaircase: true };
    const state = stateWithLevel(level);

    const next = dungeonReducer(state, { type: "OPEN_DOOR", segId: 1, doorIdx: 0, roll: null, wasNoisy: false });

    expect(next.levels).toHaveLength(2);
    const finalLevel = next.levels[1]!;
    expect(finalLevel.isFinalRoomLevel).toBe(true);
    expect(finalLevel.segments).toHaveLength(1);
    expect(finalLevel.segments[0]!.type).toBe("final");
    expect(finalLevel.segments[0]!.doors).toHaveLength(0);
    expect(next.stats.finalRooms).toBe(1);
    expect(next.activeLevel).toBe(1);
  });

  it("descend-final rolls a Dungeon Boss for the Final Room and starts combat automatically", () => {
    const stair = makeSegment({
      id: 1,
      type: "staircase",
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
    });
    const level = { ...makeLevel(2), segments: [stair], doorsRemaining: 1, hasStaircase: true };
    const state = stateWithLevel(level);
    const rng = sequenceDie([6]); // Boss roll -> Orc King (Palace)

    const next = dungeonReducer(state, { type: "OPEN_DOOR", segId: 1, doorIdx: 0, roll: null, wasNoisy: false }, rng);

    const finalSeg = next.levels[1]!.segments[0]!;
    expect(finalSeg.monsters).toEqual(DUNGEON_TABLES.palace.boss[6]);
    expect(next.combat).not.toBeNull();
    expect(next.combat!.isBoss).toBe(true);
    expect(next.combat!.monsters[0]).toMatchObject({ name: "Orc King", hp: 24, damage: 5 });
  });

  it("dead-end-final places the Final Room in place when the last door has no stairs behind it", () => {
    const room = makeSegment({
      id: 1,
      type: "room-small",
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
    });
    const level = { ...makeLevel(1), segments: [room], doorsRemaining: 1, hasStaircase: false };
    const state = stateWithLevel(level);

    const next = dungeonReducer(state, { type: "OPEN_DOOR", segId: 1, doorIdx: 0, roll: null, wasNoisy: false });

    expect(next.activeLevel).toBe(0); // stays on the same level/tab
    expect(next.levels).toHaveLength(1);
    expect(next.levels[0]!.segments).toHaveLength(2);
    expect(next.levels[0]!.segments[1]!.type).toBe("final");
    expect(next.levels[0]!.connectors).toHaveLength(1);
    expect(next.levels[0]!.finalRoomPlaced).toBe(true);
    expect(next.stats.finalRooms).toBe(1);
  });

  it("dead-end-final also rolls a Dungeon Boss and starts combat automatically", () => {
    const room = makeSegment({
      id: 1,
      type: "room-small",
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
    });
    const level = { ...makeLevel(1), segments: [room], doorsRemaining: 1, hasStaircase: false };
    const state = stateWithLevel(level);
    const rng = sequenceDie([1]); // Boss roll -> Zombie Baron (Palace)

    const next = dungeonReducer(state, { type: "OPEN_DOOR", segId: 1, doorIdx: 0, roll: null, wasNoisy: false }, rng);

    const finalSeg = next.levels[0]!.segments[1]!;
    expect(finalSeg.monsters).toEqual(DUNGEON_TABLES.palace.boss[1]);
    expect(next.combat).not.toBeNull();
    expect(next.combat!.isBoss).toBe(true);
  });

  it("reuse-normal sends a second staircase to the same already-discovered level as a new entry point", () => {
    const secondStair = makeSegment({
      id: 2,
      type: "staircase",
      doors: [{ dir: "W", opened: false, childId: null, leadsToLevel: null }],
    });
    const originLevel = {
      ...makeLevel(1),
      segments: [secondStair],
      doorsRemaining: 1,
      hasStaircase: true,
      stairwayTarget: 1,
    };
    const existingRoom = makeSegment({ id: 50, type: "corridor", w: 140, h: 60, doors: [] });
    const targetLevel = { ...makeLevel(2), segments: [existingRoom] };
    const state: DungeonState = {
      ...createInitialDungeonState(),
      dungeonTypeKey: "palace",
      levels: [originLevel, targetLevel],
      activeLevel: 0,
      nextSegmentId: 100,
    };

    const next = dungeonReducer(state, { type: "OPEN_DOOR", segId: 2, doorIdx: 0, roll: 1, wasNoisy: false });

    expect(next.activeLevel).toBe(1);
    expect(next.levels[1]!.segments).toHaveLength(2); // existing room + new island
    expect(next.levels[0]!.doorsRemaining).toBe(0);
    expect(next.levels[1]!.segments[1]!.cameFromDir).toBeNull(); // unconnected island root
  });

  it("reuse-final links a second staircase straight to the already-found Final Room, no new level", () => {
    const secondStair = makeSegment({
      id: 2,
      type: "staircase",
      doors: [{ dir: "W", opened: false, childId: null, leadsToLevel: null }],
    });
    const originLevel = {
      ...makeLevel(2),
      segments: [secondStair],
      doorsRemaining: 1,
      hasStaircase: true,
      stairwayTarget: 1,
    };
    const finalSeg = makeSegment({ id: 99, type: "final", doors: [] });
    const finalLevel = { ...makeLevel(3), segments: [finalSeg], isFinalRoomLevel: true, finalRoomPlaced: true };
    const state: DungeonState = {
      ...createInitialDungeonState(),
      dungeonTypeKey: "palace",
      levels: [originLevel, finalLevel],
      activeLevel: 0,
      nextSegmentId: 100,
    };

    const next = dungeonReducer(state, { type: "OPEN_DOOR", segId: 2, doorIdx: 0, roll: null, wasNoisy: false });

    expect(next.levels).toHaveLength(2); // no new level created
    expect(next.levels[1]!.segments).toHaveLength(1); // still just the one Final Room segment
    expect(next.activeLevel).toBe(1);
    expect(next.levels[0]!.segments[0]!.doors[0]!.childId).toBe(99);
  });
});

describe("ROLL_SECRET_PASSAGE", () => {
  it("records the result, and follows through to the Trap table on a roll of 1", () => {
    const room = makeSegment({
      id: 1,
      type: "room-small",
      doors: [],
      roomContent: { text: "Dust-filled library.", secretPassage: true },
      secretPassageSearched: false,
    });
    const level = { ...makeLevel(1), segments: [room] };
    const state = stateWithLevel(level);

    const next = dungeonReducer(state, {
      type: "ROLL_SECRET_PASSAGE",
      segId: 1,
      roll: 1,
      trapRoll: 2,
    });

    const seg = next.levels[0]!.segments[0]!;
    expect(seg.secretPassageSearched).toBe(true);
    expect(seg.secretPassageResult).toBe("You have activated a Trap!");
    expect(seg.trapResult).toBe("Acid Spout (5 Damage).");
  });

  it("leaves trapResult null when the roll doesn't trigger a trap", () => {
    const room = makeSegment({ id: 1, type: "room-small", doors: [] });
    const level = { ...makeLevel(1), segments: [room] };
    const state = stateWithLevel(level);

    const next = dungeonReducer(state, { type: "ROLL_SECRET_PASSAGE", segId: 1, roll: 4, trapRoll: null });

    const seg = next.levels[0]!.segments[0]!;
    expect(seg.secretPassageResult).toBe("You have found a hidden Chest!");
    expect(seg.trapResult).toBeUndefined();
  });

  it("spends 1 torch for the search itself, on top of any trap's own cost", () => {
    const room = makeSegment({ id: 1, type: "room-small", doors: [] });
    const level = { ...makeLevel(1), segments: [room] };
    const state = { ...stateWithLevel(level), torches: 5 };

    const next = dungeonReducer(state, { type: "ROLL_SECRET_PASSAGE", segId: 1, roll: 4, trapRoll: null });
    expect(next.torches).toBe(4);
  });

  it("the Darkness kills the character if there's no torch left to search with, and the search never happens", () => {
    const room = makeSegment({ id: 1, type: "room-small", doors: [] });
    const level = { ...makeLevel(1), segments: [room] };
    const state = { ...stateWithLevel(level), torches: 0 };

    const next = dungeonReducer(state, { type: "ROLL_SECRET_PASSAGE", segId: 1, roll: 4, trapRoll: null });
    expect(next.alive).toBe(false);
    expect(next.torches).toBe(0);
    expect(next.levels[0]!.segments[0]!.secretPassageSearched).toBeUndefined();
    expect(next.log[0]!.message).toContain("darkness");
  });

  it("a torch-costing trap found via secret passage can also trigger the Darkness", () => {
    // palace trap roll 3 is the ditch trap (torchCost: 1); only 1 torch available for BOTH
    // the search itself and the ditch, so the ditch tips it over.
    const room = makeSegment({ id: 1, type: "room-small", doors: [] });
    const level = { ...makeLevel(1), segments: [room] };
    const state = { ...stateWithLevel(level), torches: 1 };

    const next = dungeonReducer(state, { type: "ROLL_SECRET_PASSAGE", segId: 1, roll: 1, trapRoll: 3 });
    const seg = next.levels[0]!.segments[0]!;
    expect(seg.secretPassageSearched).toBe(true); // the search itself succeeded
    expect(seg.trapResult).toContain("ditch");
    expect(next.alive).toBe(false); // but the ditch trap's torch cost couldn't be paid
    expect(next.torches).toBe(0);
  });
});

describe("RESOLVE_DOOR_LOCK", () => {
  function doorState(torches = 10) {
    const seg = makeSegment({
      id: 1,
      type: "room-small",
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
    });
    const level = { ...makeLevel(1), segments: [seg], doorsRemaining: 1 };
    return { ...stateWithLevel(level), torches };
  }

  it("unlocked (roll 4-6): no torch cost, no log noise", () => {
    const state = doorState(10);
    const next = dungeonReducer(state, {
      type: "RESOLVE_DOOR_LOCK",
      segId: 1,
      doorIdx: 0,
      doorRoll: 5,
      trapRoll: null,
      lockChoice: null,
    });
    expect(next.torches).toBe(10);
    expect(next.levels[0]!.segments[0]!.doors[0]!.opened).toBe(false); // still just the lock check, not the open
  });

  it("locked + pick lock: spends 1 torch", () => {
    const state = doorState(3);
    const next = dungeonReducer(state, {
      type: "RESOLVE_DOOR_LOCK",
      segId: 1,
      doorIdx: 0,
      doorRoll: 2,
      trapRoll: null,
      lockChoice: "pickLock",
    });
    expect(next.torches).toBe(2);
    expect(next.alive).toBe(true);
    expect(next.log[0]!.message).toContain("pick the lock");
  });

  it("locked + pick lock with no torches left: the Darkness kills the character", () => {
    const state = doorState(0);
    const next = dungeonReducer(state, {
      type: "RESOLVE_DOOR_LOCK",
      segId: 1,
      doorIdx: 0,
      doorRoll: 3,
      trapRoll: null,
      lockChoice: "pickLock",
    });
    expect(next.alive).toBe(false);
    expect(next.log[0]!.message).toContain("darkness");
  });

  it("locked + break door: free, but no darkness risk regardless of torches", () => {
    const state = doorState(0);
    const next = dungeonReducer(state, {
      type: "RESOLVE_DOOR_LOCK",
      segId: 1,
      doorIdx: 0,
      doorRoll: 2,
      trapRoll: null,
      lockChoice: "breakDoor",
    });
    expect(next.torches).toBe(0);
    expect(next.alive).toBe(true);
    expect(next.log[0]!.message).toContain("broke the door open");
  });

  it("trap (roll 1) without a torch cost just logs the flavor text", () => {
    const state = doorState(5);
    const next = dungeonReducer(state, {
      type: "RESOLVE_DOOR_LOCK",
      segId: 1,
      doorIdx: 0,
      doorRoll: 1,
      trapRoll: 4, // palace trap 4: dart hits you, no torch cost
      lockChoice: null,
    });
    expect(next.torches).toBe(5);
    expect(next.alive).toBe(true);
    expect(next.log[0]!.message).toContain("dart");
  });

  it("trap (roll 1) with a torch cost (the ditch trap) spends a torch", () => {
    const state = doorState(2);
    const next = dungeonReducer(state, {
      type: "RESOLVE_DOOR_LOCK",
      segId: 1,
      doorIdx: 0,
      doorRoll: 1,
      trapRoll: 3, // palace trap 3: ditch, torchCost 1
      lockChoice: null,
    });
    expect(next.torches).toBe(1);
    expect(next.alive).toBe(true);
  });

  it("trap (roll 1) with a torch cost and no torches left kills the character", () => {
    const state = doorState(0);
    const next = dungeonReducer(state, {
      type: "RESOLVE_DOOR_LOCK",
      segId: 1,
      doorIdx: 0,
      doorRoll: 1,
      trapRoll: 3,
      lockChoice: null,
    });
    expect(next.alive).toBe(false);
    expect(next.log.some((entry) => entry.message.includes("darkness"))).toBe(true);
  });

  it("is a no-op once the character is already dead", () => {
    const state = { ...doorState(5), alive: false };
    const next = dungeonReducer(state, {
      type: "RESOLVE_DOOR_LOCK",
      segId: 1,
      doorIdx: 0,
      doorRoll: 2,
      trapRoll: null,
      lockChoice: "pickLock",
    });
    expect(next).toBe(state);
  });
});

describe("OPEN_DOOR guards against a dead character", () => {
  it("is a no-op once the character is already dead", () => {
    const seg = makeSegment({
      id: 1,
      type: "room-small",
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
    });
    const level = { ...makeLevel(1), segments: [seg], doorsRemaining: 2 };
    const state = { ...stateWithLevel(level), alive: false };

    const next = dungeonReducer(state, { type: "OPEN_DOOR", segId: 1, doorIdx: 0, roll: 1, wasNoisy: false });
    expect(next).toBe(state);
  });
});

describe("SWITCH_LEVEL / SELECT_SEGMENT", () => {
  it("is a no-op (same reference) when switching to the already-active level", () => {
    const state = stateWithLevel(makeLevel(1));
    const next = dungeonReducer(state, { type: "SWITCH_LEVEL", levelIndex: 0 });
    expect(next).toBe(state);
  });

  it("updates activeLevel and clears the selection", () => {
    const state: DungeonState = {
      ...stateWithLevel(makeLevel(1)),
      levels: [makeLevel(1), makeLevel(2)],
      selectedSegId: 5,
    };
    const next = dungeonReducer(state, { type: "SWITCH_LEVEL", levelIndex: 1 });
    expect(next.activeLevel).toBe(1);
    expect(next.selectedSegId).toBeNull();
  });

  it("selects a segment by id", () => {
    const state = stateWithLevel(makeLevel(1));
    const next = dungeonReducer(state, { type: "SELECT_SEGMENT", segId: 7 });
    expect(next.selectedSegId).toBe(7);
  });
});

describe("CAST_SPELL: Heal and Light outside combat", () => {
  it("Heal recovers 5 HP, capped at maxHp, and consumes a use", () => {
    const state: DungeonState = { ...stateWithLevel(makeLevel(1)), hp: 12, maxHp: 20, spellUses: { 1: 2 } };
    const next = dungeonReducer(state, { type: "CAST_SPELL", spellRoll: 1 });
    expect(next.hp).toBe(17);
    expect(next.spellUses[1]).toBe(1);
  });

  it("Heal never overheals past maxHp", () => {
    const state: DungeonState = { ...stateWithLevel(makeLevel(1)), hp: 18, maxHp: 20, spellUses: { 1: 1 } };
    const next = dungeonReducer(state, { type: "CAST_SPELL", spellRoll: 1 });
    expect(next.hp).toBe(20);
  });

  it("Light adds a torch, capped at 10, and consumes a use", () => {
    const state: DungeonState = { ...stateWithLevel(makeLevel(1)), torches: 6, spellUses: { 2: 1 } };
    const next = dungeonReducer(state, { type: "CAST_SPELL", spellRoll: 2 });
    expect(next.torches).toBe(7);
    expect(next.spellUses[2]).toBe(0);
  });

  it("Light still consumes a use even when torches are already at the 10 cap", () => {
    const state: DungeonState = { ...stateWithLevel(makeLevel(1)), torches: 10, spellUses: { 2: 1 } };
    const next = dungeonReducer(state, { type: "CAST_SPELL", spellRoll: 2 });
    expect(next.torches).toBe(10);
    expect(next.spellUses[2]).toBe(0);
  });
});

describe("CAST_SPELL guards", () => {
  it("is a no-op with no uses remaining", () => {
    const state = stateWithLevel(makeLevel(1));
    const next = dungeonReducer(state, { type: "CAST_SPELL", spellRoll: 1 });
    expect(next).toBe(state);
  });

  it("is a no-op once the character is dead", () => {
    const state: DungeonState = { ...stateWithLevel(makeLevel(1)), alive: false, spellUses: { 1: 1 } };
    const next = dungeonReducer(state, { type: "CAST_SPELL", spellRoll: 1 });
    expect(next).toBe(state);
  });

  it("rejects Teleport outside combat -- there's nowhere for it to send you in this implementation", () => {
    const state: DungeonState = { ...stateWithLevel(makeLevel(1)), spellUses: { 3: 1 } };
    const next = dungeonReducer(state, { type: "CAST_SPELL", spellRoll: 3 });
    expect(next).toBe(state);
  });

  it("rejects Cold Ray / Lightning / Fireball outside combat", () => {
    const state: DungeonState = { ...stateWithLevel(makeLevel(1)), spellUses: { 4: 1, 5: 1, 6: 1 } };
    expect(dungeonReducer(state, { type: "CAST_SPELL", spellRoll: 4, targetId: 1 })).toBe(state);
    expect(dungeonReducer(state, { type: "CAST_SPELL", spellRoll: 5, targetId: 1 })).toBe(state);
    expect(dungeonReducer(state, { type: "CAST_SPELL", spellRoll: 6 })).toBe(state);
  });
});

describe("RESET", () => {
  it("returns to a completely fresh state", () => {
    const state: DungeonState = { ...stateWithLevel(makeLevel(1)), selectedSegId: 3, dungeonName: "The Prison" };
    const next = dungeonReducer(state, { type: "RESET" });
    expect(next).toEqual(createInitialDungeonState());
  });
});
