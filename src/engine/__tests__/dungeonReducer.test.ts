import { describe, expect, it } from "vitest";
import { dungeonReducer } from "../dungeonReducer.ts";
import { DUNGEON_TABLES, type MonsterTemplate } from "../../data/dungeonTables.ts";
import {
  countUnlootedRemains,
  createInitialDungeonState,
  hasUnlootedRemains,
  isDungeonBeaten,
  makeLevel,
  type CombatState,
  type DungeonState,
  type SegmentState,
} from "../dungeonState.ts";
import { fixedDie, mulberry32, sequenceDie } from "../../test/mulberry32.ts";

function makeSegment(overrides: Partial<SegmentState> & Pick<SegmentState, "id" | "type" | "doors">): SegmentState {
  return { x: 0, y: 0, w: 80, h: 80, cx: 0, cy: 0, cameFromDir: null, flavor: null, isEntrance: false, ...overrides };
}

function stateWithLevel(level: ReturnType<typeof makeLevel>, activeLevel = 0): DungeonState {
  return {
    ...createInitialDungeonState(),
    dungeonTypeKey: "palace",
    levels: [level],
    activeLevel,
    nextSegmentId: 100,
    currentSegId: level.segments[0]?.id ?? null,
  };
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
    // Stepping into the dungeon is standing in the entrance -- both position and the
    // RoomInspector's selection should already point there, not require an extra click.
    expect(state.currentSegId).toBe(entrance.id);
    expect(state.selectedSegId).toBe(entrance.id);
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

  it("rolls Room Content for a room-type entrance (Palace), but never Monsters", () => {
    // content sum 4, monster sum 6 -- row 6 would normally spawn a monster (see the equivalent
    // OPEN_DOOR test for a non-entrance room using this exact roll), but the entrance is exempt.
    const rng = sequenceDie([2, 2, 3, 3]);
    const state = dungeonReducer(
      createInitialDungeonState(),
      { type: "ROLL_DUNGEON", typeRoll: 1, secondRoll: 1, thirdRoll: 1 },
      rng,
    );
    const entrance = state.levels[0]!.segments[0]!;
    expect(entrance.type).toBe("room-large");
    expect(entrance.roomContent).toBeDefined();
    expect(entrance.monsters).toBeUndefined();
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

    // content sum 2 (Palace row 2: no reward), monster sum 7 (null) -- keeps the log to just the
    // "Segment 1 -> ..." line below, instead of leaving it to chance which row a real roll lands on.
    const rng = sequenceDie([1, 1, 3, 4]);
    const next = dungeonReducer(state, { type: "OPEN_DOOR", segId: 1, doorIdx: 0, roll: 1, wasNoisy: false }, rng);

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

describe("Positional movement", () => {
  it("currentSegId and selectedSegId both auto-advance to a newly-built segment when a door opens", () => {
    const entrance = makeSegment({
      id: 1,
      type: "corridor",
      w: 60,
      h: 140,
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
    });
    const level = { ...makeLevel(1), segments: [entrance], doorsRemaining: 1 };
    const state = { ...stateWithLevel(level), stats: { ...createInitialDungeonState().stats, doorsRemaining: 1 } };

    const rng = sequenceDie([1, 1, 3, 4]); // content row 2 (no reward), monster sum 7 (null)
    const next = dungeonReducer(state, { type: "OPEN_DOOR", segId: 1, doorIdx: 0, roll: 1, wasNoisy: false }, rng);

    // Opening the door is moving through it -- the RoomInspector should already be showing the
    // new room (selectedSegId), not still prompting "click a room to inspect it".
    const child = next.levels[0]!.segments[1]!;
    expect(next.currentSegId).toBe(child.id);
    expect(next.selectedSegId).toBe(child.id);
  });

  it("OPEN_DOOR is a no-op on a segment the player isn't currently standing in", () => {
    const seg1 = makeSegment({
      id: 1,
      type: "room-small",
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
    });
    const seg2 = makeSegment({
      id: 2,
      type: "room-small",
      doors: [{ dir: "W", opened: false, childId: null, leadsToLevel: null }],
    });
    const level = { ...makeLevel(1), segments: [seg1, seg2], doorsRemaining: 2 };
    // currentSegId (seg1) via stateWithLevel's default -- seg2's door is out of reach.
    const state = stateWithLevel(level);

    const next = dungeonReducer(state, { type: "OPEN_DOOR", segId: 2, doorIdx: 0, roll: 1, wasNoisy: false });
    expect(next).toBe(state);
  });

  it("RESOLVE_DOOR_LOCK is a no-op on a segment the player isn't currently standing in", () => {
    const seg1 = makeSegment({
      id: 1,
      type: "room-small",
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
    });
    const seg2 = makeSegment({
      id: 2,
      type: "room-small",
      doors: [{ dir: "W", opened: false, childId: null, leadsToLevel: null }],
    });
    const level = { ...makeLevel(1), segments: [seg1, seg2], doorsRemaining: 2 };
    const state = stateWithLevel(level);

    const next = dungeonReducer(state, {
      type: "RESOLVE_DOOR_LOCK",
      segId: 2,
      doorIdx: 0,
      doorRoll: 2,
      trapRoll: null,
      lockChoice: "pickLock",
    });
    expect(next).toBe(state);
  });

  it("SWITCH_LEVEL with a segId moves the player, only when it's reachable from the current segment", () => {
    const stair = makeSegment({
      id: 1,
      type: "staircase",
      doors: [{ dir: "E", opened: true, childId: 10, leadsToLevel: 1 }],
    });
    const level0 = { ...makeLevel(1), segments: [stair] };
    const entry = makeSegment({ id: 10, type: "corridor", doors: [] });
    const level1 = { ...makeLevel(2), segments: [entry] };
    const state: DungeonState = {
      ...createInitialDungeonState(),
      dungeonTypeKey: "palace",
      levels: [level0, level1],
      activeLevel: 0,
      currentSegId: 1,
    };

    const next = dungeonReducer(state, { type: "SWITCH_LEVEL", levelIndex: 1, segId: 10 });
    expect(next.activeLevel).toBe(1);
    expect(next.currentSegId).toBe(10);
    expect(next.selectedSegId).toBe(10);
  });

  it("SWITCH_LEVEL with a segId is a no-op if that staircase isn't the segment the player is standing in", () => {
    const stair = makeSegment({
      id: 1,
      type: "staircase",
      doors: [{ dir: "E", opened: true, childId: 10, leadsToLevel: 1 }],
    });
    const otherRoom = makeSegment({ id: 2, type: "room-small", doors: [] });
    const level0 = { ...makeLevel(1), segments: [stair, otherRoom] };
    const entry = makeSegment({ id: 10, type: "corridor", doors: [] });
    const level1 = { ...makeLevel(2), segments: [entry] };
    const state: DungeonState = {
      ...createInitialDungeonState(),
      dungeonTypeKey: "palace",
      levels: [level0, level1],
      activeLevel: 0,
      currentSegId: 2, // standing in otherRoom, not the staircase
    };

    const next = dungeonReducer(state, { type: "SWITCH_LEVEL", levelIndex: 1, segId: 10 });
    expect(next).toBe(state);
  });

  it("SWITCH_LEVEL without a segId (a plain LevelTabs click) never moves the player", () => {
    const room = makeSegment({ id: 1, type: "room-small", doors: [] });
    const level0 = { ...makeLevel(1), segments: [room] };
    const level1 = makeLevel(2);
    const state: DungeonState = {
      ...createInitialDungeonState(),
      dungeonTypeKey: "palace",
      levels: [level0, level1],
      activeLevel: 0,
      currentSegId: 1,
    };

    const next = dungeonReducer(state, { type: "SWITCH_LEVEL", levelIndex: 1 });
    expect(next.activeLevel).toBe(1);
    expect(next.currentSegId).toBe(1); // unchanged -- just viewing, not standing there
  });
});

describe("Room Content rewards", () => {
  it("credits coins the moment a room with a coins reward is built (Palace entrance, roll 3)", () => {
    // content sum 3 (Palace row 3: "1d6 coins on the floor"), monster sum 7 (null), reward roll 5
    const rng = sequenceDie([1, 2, 3, 4, 5]);
    const state = dungeonReducer(
      createInitialDungeonState(),
      { type: "ROLL_DUNGEON", typeRoll: 1, secondRoll: 1, thirdRoll: 1 },
      rng,
    );
    expect(state.dungeonTypeKey).toBe("palace");
    expect(state.coins).toBe(5);
    expect(state.log.some((entry) => entry.message === "You find 5 coins.")).toBe(true);
  });

  it("grants random Basic Spell uses for a magicScrolls reward (Palace entrance, roll 5)", () => {
    // content sum 5 (Palace row 5: "1d6 Magic Scrolls"), monster sum 9, reward roll count 3 -> 3 scrolls
    const rng = sequenceDie([2, 3, 4, 5, 3, 3, 3, 3]);
    const state = dungeonReducer(
      createInitialDungeonState(),
      { type: "ROLL_DUNGEON", typeRoll: 1, secondRoll: 1, thirdRoll: 1 },
      rng,
    );
    expect(state.spellUses).toEqual({ 3: 3 }); // three scrolls, all rolling spell 3 (Teleport)
    expect(state.log.some((entry) => entry.message.includes("3 Magic Scrolls"))).toBe(true);
  });

  it("rolls Magic Items for a magicItems reward (Palace entrance, roll 12)", () => {
    // content sum 12 (Palace row 12: "2d6 Magic Items"), monster sum 12 (padded identically),
    // reward count roll 1+1=2 -> 2 items, each needing an item-table roll + a base-armor-table roll
    const rng = sequenceDie([6, 6, 6, 6, 1, 1, 1, 1, 1, 1]);
    const state = dungeonReducer(
      createInitialDungeonState(),
      { type: "ROLL_DUNGEON", typeRoll: 1, secondRoll: 1, thirdRoll: 1 },
      rng,
    );
    // Magic Item roll 1 -> [Armor] of Royalty (grants: armor); roll 1 again for the base Armor
    // table -> Ring (0 HP). Two magic items rolled (2d6 count 1+1=2), both identical here.
    expect(state.armor).toHaveLength(2);
    expect(state.armor[0]!.itemName).toBe("[Armor] of Royalty");
  });

  it("does nothing extra for a row with no reward field", () => {
    // content sum 2 (Palace row 2: "Dust-filled library", no reward), monster sum 7 (null)
    const rng = sequenceDie([1, 1, 3, 4]);
    const state = dungeonReducer(
      createInitialDungeonState(),
      { type: "ROLL_DUNGEON", typeRoll: 1, secondRoll: 1, thirdRoll: 1 },
      rng,
    );
    expect(state.coins).toBe(0);
    expect(state.treasures).toBe(0);
  });

  it("credits treasures for a treasures reward found behind a door", () => {
    const entrance = makeSegment({
      id: 1,
      type: "corridor",
      w: 60,
      h: 140,
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
    });
    const level = { ...makeLevel(1), segments: [entrance], doorsRemaining: 1, hasStaircase: true };
    const state = {
      ...stateWithLevel(level),
      dungeonTypeKey: "sanctuary" as const,
      stats: { ...createInitialDungeonState().stats, doorsRemaining: 1 },
    };
    // content sum 4 (Sanctuary row 4: "1d6 Treasures"), monster sum 2, reward roll 4
    const rng = sequenceDie([1, 3, 1, 1, 4]);
    const next = dungeonReducer(state, { type: "OPEN_DOOR", segId: 1, doorIdx: 0, roll: 1, wasNoisy: false }, rng);

    expect(next.treasures).toBe(4);
    expect(next.log.some((entry) => entry.message === "You find 4 Treasures.")).toBe(true);
  });

  it("applies a coins reward's multiplier (2d6 paintings, 2 coins each)", () => {
    const entrance = makeSegment({
      id: 1,
      type: "corridor",
      w: 60,
      h: 140,
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
    });
    const level = { ...makeLevel(1), segments: [entrance], doorsRemaining: 1, hasStaircase: true };
    const state = {
      ...stateWithLevel(level),
      dungeonTypeKey: "sanctuary" as const,
      stats: { ...createInitialDungeonState().stats, doorsRemaining: 1 },
    };
    // content sum 9 (Sanctuary row 9: "2d6 paintings of gods, 2 coins each"), monster sum 2,
    // reward count roll 3+4=7 paintings -> 14 coins
    const rng = sequenceDie([4, 5, 1, 1, 3, 4]);
    const next = dungeonReducer(state, { type: "OPEN_DOOR", segId: 1, doorIdx: 0, roll: 1, wasNoisy: false }, rng);

    expect(next.coins).toBe(14);
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
      currentSegId: 2,
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
      currentSegId: 2,
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
    const state = {
      ...stateWithLevel(level),
      torches: 0,
      coins: 5,
      treasures: 2,
      keys: 1,
      characterName: "Doomed Dara",
    };

    const next = dungeonReducer(state, { type: "ROLL_SECRET_PASSAGE", segId: 1, roll: 4, trapRoll: null });
    expect(next.alive).toBe(false);
    expect(next.torches).toBe(0);
    expect(next.levels[0]!.segments[0]!.secretPassageSearched).toBeUndefined();
    expect(next.log[0]!.message).toContain("darkness");
    // "he will find his backpack and clothes on the floor" -- left in the room she died in
    expect(next.levels[0]!.segments[0]!.remains).toEqual({
      names: ["Doomed Dara"],
      coins: 5,
      treasures: 2,
      keys: 1,
      heldItems: [],
    armor: [],
    weapon: null,
    });
  });

  it("a second death in the same room adds to the existing remains instead of overwriting them", () => {
    const room = makeSegment({
      id: 1,
      type: "room-small",
      doors: [],
      remains: { names: ["Doomed Dara"], coins: 5, treasures: 2, keys: 1, heldItems: [], armor: [], weapon: null },
    });
    const level = { ...makeLevel(1), segments: [room] };
    const state = {
      ...stateWithLevel(level),
      torches: 0,
      coins: 3,
      treasures: 0,
      keys: 1,
      characterName: "Ill-Fated Finn",
    };

    const next = dungeonReducer(state, { type: "ROLL_SECRET_PASSAGE", segId: 1, roll: 4, trapRoll: null });
    expect(next.levels[0]!.segments[0]!.remains).toEqual({
      names: ["Doomed Dara", "Ill-Fated Finn"],
      coins: 8,
      treasures: 2,
      keys: 2,
      heldItems: [],
    armor: [],
    weapon: null,
    });
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

  it("a damage trap found via secret passage deals its damage", () => {
    const room = makeSegment({ id: 1, type: "room-small", doors: [] });
    const level = { ...makeLevel(1), segments: [room] };
    const state = stateWithLevel(level);

    const next = dungeonReducer(state, { type: "ROLL_SECRET_PASSAGE", segId: 1, roll: 1, trapRoll: 4 }); // dart, 1 dmg
    expect(next.alive).toBe(true);
    expect(next.hp).toBe(next.maxHp - 1);
  });

  it("a roll of 6 builds a real, descendable Staircase segment off the room", () => {
    const room = makeSegment({ id: 1, type: "room-small", doors: [] });
    const level = { ...makeLevel(1), segments: [room] };
    const state = stateWithLevel(level);

    const next = dungeonReducer(state, { type: "ROLL_SECRET_PASSAGE", segId: 1, roll: 6, trapRoll: null });

    const seg = next.levels[0]!.segments.find((s) => s.id === 1)!;
    expect(seg.secretPassageResult).toBe("A secret door to a Staircase.");
    expect(next.levels[0]!.segments).toHaveLength(2);
    expect(next.levels[0]!.hasStaircase).toBe(true);

    const newDoor = seg.doors.find((d) => d.childId != null)!;
    expect(newDoor.opened).toBe(true);
    const stairSeg = next.levels[0]!.segments.find((s) => s.id === newDoor.childId)!;
    expect(stairSeg.type).toBe("staircase");
    expect(stairSeg.doors).toHaveLength(1); // "the door in the end" -- the actual way down
    expect(next.log[0]!.message).toContain("Staircase");
  });

  it("a roll of 6 is a graceful no-op (flavor text only) when all 4 directions are already doored", () => {
    const room = makeSegment({
      id: 1,
      type: "room-small",
      doors: [
        { dir: "N", opened: false, childId: null, leadsToLevel: null },
        { dir: "E", opened: false, childId: null, leadsToLevel: null },
        { dir: "S", opened: false, childId: null, leadsToLevel: null },
        { dir: "W", opened: false, childId: null, leadsToLevel: null },
      ],
    });
    const level = { ...makeLevel(1), segments: [room] };
    const state = stateWithLevel(level);

    const next = dungeonReducer(state, { type: "ROLL_SECRET_PASSAGE", segId: 1, roll: 6, trapRoll: null });

    expect(next.levels[0]!.segments).toHaveLength(1); // no new segment could be placed
    expect(next.levels[0]!.segments[0]!.secretPassageResult).toBe("A secret door to a Staircase.");
  });
});

describe("ROLL_CHEST", () => {
  it("awards coins (the higher die) and Treasures (the lower die), for free -- no torch spent", () => {
    const room = makeSegment({
      id: 1,
      type: "room-small",
      doors: [],
      roomContent: { text: "Desk with a Chest.", secretPassage: false, hasChest: true },
    });
    const level = { ...makeLevel(1), segments: [room] };
    const state = { ...stateWithLevel(level), torches: 5 };

    const next = dungeonReducer(state, { type: "ROLL_CHEST", segId: 1, dice: [5, 2], trapRoll: null });

    const seg = next.levels[0]!.segments[0]!;
    expect(seg.chestOpened).toBe(true);
    expect(seg.chestResult).toBe("Found 5 coins and 2 Treasures.");
    expect(next.coins).toBe(5);
    expect(next.treasures).toBe(2);
    expect(next.torches).toBe(5); // opening a chest doesn't cost a torch
  });

  it("doubles the coins (not the Treasures) when the player has a doubleChestCoins item (e.g. Leprechaun's Armor)", () => {
    const room = makeSegment({
      id: 1,
      type: "room-small",
      doors: [],
      roomContent: { text: "Desk with a Chest.", secretPassage: false, hasChest: true },
    });
    const level = { ...makeLevel(1), segments: [room] };
    const state = {
      ...stateWithLevel(level),
      armor: [{ piece: "boots" as const, hp: 3, maxHp: 3, itemName: "Leprechaun's [Armor]", effect: { kind: "doubleChestCoins" as const } }],
    };

    const next = dungeonReducer(state, { type: "ROLL_CHEST", segId: 1, dice: [5, 2], trapRoll: null });

    expect(next.coins).toBe(10);
    expect(next.treasures).toBe(2);
  });

  it("double 1s means the chest was empty and triggers a trap instead", () => {
    const room = makeSegment({
      id: 1,
      type: "room-small",
      doors: [],
      roomContent: { text: "Desk with a Chest.", secretPassage: false, hasChest: true },
    });
    const level = { ...makeLevel(1), segments: [room] };
    const state = stateWithLevel(level);

    // palace trap roll 3 is the ditch trap (torchCost: 1)
    const next = dungeonReducer(state, { type: "ROLL_CHEST", segId: 1, dice: [1, 1], trapRoll: 3 });

    const seg = next.levels[0]!.segments[0]!;
    expect(seg.chestOpened).toBe(true);
    expect(seg.trapResult).toContain("ditch");
    expect(next.coins).toBe(0);
    expect(next.treasures).toBe(0);
    expect(next.torches).toBe(9); // the ditch trap's own cost, not a chest-opening cost
  });

  it("an empty chest's trap deals damage when it's a damage-dealing trap", () => {
    const room = makeSegment({
      id: 1,
      type: "room-small",
      doors: [],
      roomContent: { text: "Desk with a Chest.", secretPassage: false, hasChest: true },
    });
    const level = { ...makeLevel(1), segments: [room] };
    const state = stateWithLevel(level);

    const next = dungeonReducer(state, { type: "ROLL_CHEST", segId: 1, dice: [1, 1], trapRoll: 4 }); // dart, 1 dmg
    expect(next.alive).toBe(true);
    expect(next.hp).toBe(next.maxHp - 1);
  });

  it("a hidden Chest found via a secret passage is openable the same way", () => {
    const room = makeSegment({
      id: 1,
      type: "room-small",
      doors: [],
      roomContent: { text: "Dust-filled library.", secretPassage: true },
      secretPassageSearched: true,
      secretPassageResult: "You have found a hidden Chest!",
    });
    const level = { ...makeLevel(1), segments: [room] };
    const state = stateWithLevel(level);

    const next = dungeonReducer(state, { type: "ROLL_CHEST", segId: 1, dice: [4, 3], trapRoll: null });
    expect(next.coins).toBe(4);
    expect(next.treasures).toBe(3);
  });

  it("is a no-op when the room has no chest to open", () => {
    const room = makeSegment({
      id: 1,
      type: "room-small",
      doors: [],
      roomContent: { text: "Dirt everywhere.", secretPassage: true },
    });
    const level = { ...makeLevel(1), segments: [room] };
    const state = stateWithLevel(level);

    const next = dungeonReducer(state, { type: "ROLL_CHEST", segId: 1, dice: [5, 2], trapRoll: null });
    expect(next).toBe(state);
  });

  it("is a no-op if the chest was already opened", () => {
    const room = makeSegment({
      id: 1,
      type: "room-small",
      doors: [],
      roomContent: { text: "Desk with a Chest.", secretPassage: false, hasChest: true },
      chestOpened: true,
    });
    const level = { ...makeLevel(1), segments: [room] };
    const state = stateWithLevel(level);

    const next = dungeonReducer(state, { type: "ROLL_CHEST", segId: 1, dice: [5, 2], trapRoll: null });
    expect(next).toBe(state);
  });
});

describe("COLLECT_REMAINS", () => {
  it("adds the remains' coins/Treasures/Keys/held items to the current character and clears them", () => {
    const room = makeSegment({
      id: 1,
      type: "room-small",
      doors: [],
      remains: {
        names: ["Doomed Dara"],
        coins: 5,
        treasures: 2,
        keys: 1,
        heldItems: [{ name: "Ornament", worth: 5 }],
        armor: [],
        weapon: null,
      },
    });
    const level = { ...makeLevel(1), segments: [room] };
    const state = { ...stateWithLevel(level), coins: 1, treasures: 0, keys: 0, heldItems: [] };

    const next = dungeonReducer(state, { type: "COLLECT_REMAINS", segId: 1 });

    expect(next.coins).toBe(6);
    expect(next.treasures).toBe(2);
    expect(next.keys).toBe(1);
    expect(next.heldItems).toEqual([{ name: "Ornament", worth: 5 }]);
    expect(next.levels[0]!.segments[0]!.remains).toBeNull();
    expect(next.log[0]!.message).toContain("Doomed Dara");
  });

  it("is a no-op when there are no remains in the segment", () => {
    const room = makeSegment({ id: 1, type: "room-small", doors: [] });
    const level = { ...makeLevel(1), segments: [room] };
    const state = stateWithLevel(level);

    const next = dungeonReducer(state, { type: "COLLECT_REMAINS", segId: 1 });
    expect(next).toBe(state);
  });

  it("is a no-op once the character is dead", () => {
    const room = makeSegment({
      id: 1,
      type: "room-small",
      doors: [],
      remains: { names: ["Doomed Dara"], coins: 5, treasures: 0, keys: 0, heldItems: [], armor: [], weapon: null },
    });
    const level = { ...makeLevel(1), segments: [room] };
    const state = { ...stateWithLevel(level), alive: false };

    const next = dungeonReducer(state, { type: "COLLECT_REMAINS", segId: 1 });
    expect(next).toBe(state);
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

  it("Locksmith: pick lock costs no torch", () => {
    const state = { ...doorState(0), className: "Locksmith" };
    const next = dungeonReducer(state, {
      type: "RESOLVE_DOOR_LOCK",
      segId: 1,
      doorIdx: 0,
      doorRoll: 2,
      trapRoll: null,
      lockChoice: "pickLock",
    });
    expect(next.torches).toBe(0);
    expect(next.alive).toBe(true);
    expect(next.log[0]!.message).toContain("needs no torch");
  });

  it("Lumberjack: breaking a door gains 1 torch on a roll of 6", () => {
    const state = { ...doorState(3), className: "Lumberjack" };
    const next = dungeonReducer(
      state,
      { type: "RESOLVE_DOOR_LOCK", segId: 1, doorIdx: 0, doorRoll: 2, trapRoll: null, lockChoice: "breakDoor" },
      fixedDie(6),
    );
    expect(next.torches).toBe(4);
    expect(next.log.some((e) => e.message.includes("gain 1 torch"))).toBe(true);
  });

  it("Lumberjack: no torch gained on anything but a 6, and it's capped at 10", () => {
    const state = { ...doorState(3), className: "Lumberjack" };
    const next = dungeonReducer(
      state,
      { type: "RESOLVE_DOOR_LOCK", segId: 1, doorIdx: 0, doorRoll: 2, trapRoll: null, lockChoice: "breakDoor" },
      fixedDie(5),
    );
    expect(next.torches).toBe(3);

    const capped = { ...doorState(10), className: "Lumberjack" };
    const next2 = dungeonReducer(
      capped,
      { type: "RESOLVE_DOOR_LOCK", segId: 1, doorIdx: 0, doorRoll: 2, trapRoll: null, lockChoice: "breakDoor" },
      fixedDie(6),
    );
    expect(next2.torches).toBe(10);
  });

  it("a non-Lumberjack never gains a torch from breaking a door", () => {
    const state = doorState(3);
    const next = dungeonReducer(
      state,
      { type: "RESOLVE_DOOR_LOCK", segId: 1, doorIdx: 0, doorRoll: 2, trapRoll: null, lockChoice: "breakDoor" },
      fixedDie(6),
    );
    expect(next.torches).toBe(3);
  });

  it("Miner: spared from the Darkness when out of torches, instead of dying", () => {
    const state = { ...doorState(0), className: "Miner" };
    const next = dungeonReducer(state, {
      type: "RESOLVE_DOOR_LOCK",
      segId: 1,
      doorIdx: 0,
      doorRoll: 3,
      trapRoll: null,
      lockChoice: "pickLock",
    });
    expect(next.alive).toBe(true);
    expect(next.torches).toBe(0);
    expect(next.log[0]!.message).toContain("Retreat to Town");
  });

  it("trap (roll 1) with no torch cost deals its flat damage instead", () => {
    const state = doorState(5);
    const next = dungeonReducer(state, {
      type: "RESOLVE_DOOR_LOCK",
      segId: 1,
      doorIdx: 0,
      doorRoll: 1,
      trapRoll: 4, // palace trap 4: dart hits you (1 damage), no torch cost
      lockChoice: null,
    });
    expect(next.torches).toBe(5);
    expect(next.alive).toBe(true);
    expect(next.hp).toBe(next.maxHp - 1);
    expect(next.log[0]!.message).toBe("The trap deals 1 damage.");
    expect(next.log[1]!.message).toContain("dart");
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

  it("the Blade Trap kills outright on the silent roll-of-1, deathCause combat", () => {
    const state = doorState(5);
    const next = dungeonReducer(
      state,
      { type: "RESOLVE_DOOR_LOCK", segId: 1, doorIdx: 0, doorRoll: 1, trapRoll: 1, lockChoice: null },
      fixedDie(1), // the trap's own silent death roll
    );
    expect(next.alive).toBe(false);
    expect(next.hp).toBe(0);
    expect(next.deathCause).toBe("combat");
    expect(next.log.some((entry) => entry.message.includes("blade"))).toBe(true);
  });

  it("the Blade Trap does nothing mechanical on any other roll (losing an arm is flavor only)", () => {
    const state = doorState(5);
    const next = dungeonReducer(
      state,
      { type: "RESOLVE_DOOR_LOCK", segId: 1, doorIdx: 0, doorRoll: 1, trapRoll: 1, lockChoice: null },
      fixedDie(2),
    );
    expect(next.alive).toBe(true);
    expect(next.hp).toBe(next.maxHp);
  });

  it("a fatal flat-damage trap kills the character and leaves remains", () => {
    const state = { ...doorState(5), hp: 3, coins: 4, characterName: "Doomed" };
    const next = dungeonReducer(state, {
      type: "RESOLVE_DOOR_LOCK",
      segId: 1,
      doorIdx: 0,
      doorRoll: 1,
      trapRoll: 2, // palace trap 2: Acid Spout, 5 damage -- lethal against 3 hp
      lockChoice: null,
    });
    expect(next.alive).toBe(false);
    expect(next.hp).toBe(0);
    expect(next.deathCause).toBe("combat");
    expect(next.levels[0]!.segments[0]!.remains?.coins).toBe(4);
  });

  it("a monster-ambush trap (e.g. Crypt's Bats) spawns combat, noisy", () => {
    const state = { ...doorState(5), dungeonTypeKey: "crypt" as const };
    const next = dungeonReducer(state, {
      type: "RESOLVE_DOOR_LOCK",
      segId: 1,
      doorIdx: 0,
      doorRoll: 1,
      trapRoll: 3, // crypt trap 3: Appears 1d6 Bats
      lockChoice: null,
    });
    expect(next.combat).not.toBeNull();
    expect(next.combat!.monsters[0]!.name).toBe("Bats");
    expect(next.log.some((entry) => entry.message.includes("noise gave you away"))).toBe(true);
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

  it("a trapImmunity item blocks a damage trap entirely and is consumed", () => {
    const state = {
      ...doorState(5),
      hp: 3, // would die to Acid Spout's 5 damage if the immunity didn't hold
      armor: [{ piece: "wonderItem" as const, hp: 0, maxHp: 0, itemName: "Potion of Luck", effect: { kind: "trapImmunity" as const } }],
    };
    const next = dungeonReducer(state, {
      type: "RESOLVE_DOOR_LOCK",
      segId: 1,
      doorIdx: 0,
      doorRoll: 1,
      trapRoll: 2, // palace trap 2: Acid Spout, 5 damage
      lockChoice: null,
    });
    expect(next.alive).toBe(true);
    expect(next.hp).toBe(3); // untouched
    expect(next.armor).toHaveLength(0); // consumed, one-shot
    expect(next.log.some((entry) => entry.message.includes("Potion of Luck"))).toBe(true);
  });

  it("a trapImmunity item blocks the ditch trap's torch cost too", () => {
    const state = {
      ...doorState(0), // no torches -- would trigger the Darkness if the ditch trap's cost applied
      armor: [{ piece: "wonderItem" as const, hp: 0, maxHp: 0, itemName: "Potion of Luck", effect: { kind: "trapImmunity" as const } }],
    };
    const next = dungeonReducer(state, {
      type: "RESOLVE_DOOR_LOCK",
      segId: 1,
      doorIdx: 0,
      doorRoll: 1,
      trapRoll: 3, // palace trap 3: ditch, torchCost 1
      lockChoice: null,
    });
    expect(next.alive).toBe(true);
    expect(next.torches).toBe(0);
    expect(next.armor).toHaveLength(0);
  });

  it("a trapImmunity item blocks the Blade Trap's death roll", () => {
    const state = {
      ...doorState(5),
      armor: [{ piece: "wonderItem" as const, hp: 0, maxHp: 0, itemName: "Cultist's [Armor]", effect: { kind: "trapImmunity" as const } }],
    };
    const next = dungeonReducer(
      state,
      { type: "RESOLVE_DOOR_LOCK", segId: 1, doorIdx: 0, doorRoll: 1, trapRoll: 1, lockChoice: null },
      fixedDie(1), // would kill outright if immunity didn't intercept it first
    );
    expect(next.alive).toBe(true);
    expect(next.armor).toHaveLength(0);
  });

  it("only consumes one trapImmunity item, leaving any others equipped", () => {
    const state = {
      ...doorState(5),
      hp: 3,
      armor: [
        { piece: "wonderItem" as const, hp: 0, maxHp: 0, itemName: "Potion of Luck", effect: { kind: "trapImmunity" as const } },
        { piece: "boots" as const, hp: 3, maxHp: 3, itemName: "Boots" },
      ],
    };
    const next = dungeonReducer(state, {
      type: "RESOLVE_DOOR_LOCK",
      segId: 1,
      doorIdx: 0,
      doorRoll: 1,
      trapRoll: 2,
      lockChoice: null,
    });
    expect(next.armor).toEqual([{ piece: "boots", hp: 3, maxHp: 3, itemName: "Boots" }]);
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

  it("moves to a reachable neighboring segment, updating both selectedSegId and currentSegId", () => {
    const seg1 = makeSegment({
      id: 1,
      type: "room-small",
      doors: [{ dir: "E", opened: true, childId: 2, leadsToLevel: null }],
    });
    const seg2 = makeSegment({ id: 2, type: "room-small", doors: [] });
    const level = { ...makeLevel(1), segments: [seg1, seg2] };
    const state = stateWithLevel(level); // currentSegId defaults to seg1's id

    const next = dungeonReducer(state, { type: "SELECT_SEGMENT", segId: 2 });
    expect(next.selectedSegId).toBe(2);
    expect(next.currentSegId).toBe(2);
  });

  it("is a no-op when selecting a segment that isn't reachable from the current one", () => {
    const seg1 = makeSegment({ id: 1, type: "room-small", doors: [] });
    const seg2 = makeSegment({ id: 2, type: "room-small", doors: [] }); // not connected to seg1
    const level = { ...makeLevel(1), segments: [seg1, seg2] };
    const state = stateWithLevel(level);

    const next = dungeonReducer(state, { type: "SELECT_SEGMENT", segId: 2 });
    expect(next).toBe(state);
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

  it("allows Teleport mid-fight after choosing Attack First (regression: hasPendingRoomEntry must not block an already-active fight)", () => {
    const monster: MonsterTemplate = { name: "Orc", hp: 6, damage: 3, abilities: [], count: 1 };
    const room = makeSegment({ id: 1, type: "room-small", doors: [], monsters: monster });
    const dest = makeSegment({ id: 2, type: "room-small", doors: [] });
    const level = { ...makeLevel(1), segments: [room, dest] };
    const combat: CombatState = {
      segId: 1,
      monsters: [
        {
          id: 1,
          name: "Orc",
          hp: 6,
          maxHp: 6,
          damage: 3,
          abilities: [],
          bonusDamage: 0,
          deathtouchPending: false,
          paralyzePending: 0,
          skipNextAttack: false,
        },
      ],
      paralyzedTurns: 0,
      pendingLootRolls: 0,
      isBoss: false,
      outcome: "ongoing",
      pendingDamage: null,
      playerDamageBonus: 0,
      engulfableBodies: 0,
    };
    const state: DungeonState = {
      ...stateWithLevel(level),
      currentSegId: 1,
      combat,
      spellUses: { 3: 1 },
    };

    const next = dungeonReducer(state, { type: "CAST_SPELL", spellRoll: 3, destLevel: 0, destSegId: 2 });
    expect(next.combat).toBeNull();
    expect(next.spellUses[3]).toBe(0);
    expect(next.currentSegId).toBe(2);
  });
});

describe("OPEN_TREASURE", () => {
  it("a flat-value outcome (Palace roll 1: Ornament) adds a held item and consumes the treasure", () => {
    const state: DungeonState = { ...stateWithLevel(makeLevel(1)), treasures: 2 };
    const next = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 1, maxSpellUses: {} });
    expect(next.treasures).toBe(1);
    expect(next.coins).toBe(0);
    expect(next.heldItems).toEqual([{ name: "Ornament", worth: 5 }]);
    expect(next.log[0]!.message).toContain("Ornament");
  });

  it("Health Potion (Palace roll 2) heals to full but never past it", () => {
    const state: DungeonState = { ...stateWithLevel(makeLevel(1)), treasures: 1, hp: 12, maxHp: 20 };
    const next = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 2, maxSpellUses: {} });
    expect(next.hp).toBe(20);
  });

  it("Magic Scroll (Palace roll 3) grants one use of a randomly rolled Basic Spell", () => {
    const state: DungeonState = { ...stateWithLevel(makeLevel(1)), treasures: 1, spellUses: {} };
    const next = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 3, maxSpellUses: {} }, fixedDie(5));
    expect(next.spellUses).toEqual({ 5: 1 });
    expect(next.log[0]!.message).toContain("Lightning");
  });

  it("Valuable jewel (Palace roll 4) adds a held item worth 2d6 x 10 coins", () => {
    const state: DungeonState = { ...stateWithLevel(makeLevel(1)), treasures: 1 };
    const next = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 4, maxSpellUses: {} }, sequenceDie([4, 3]));
    expect(next.coins).toBe(0);
    expect(next.heldItems).toEqual([{ name: "Valuable jewel", worth: 70 }]); // (4 + 3) * 10
  });

  it("Palace roll 5 redirects to the Wonders table and grants an HP-bearing item", () => {
    const state: DungeonState = { ...stateWithLevel(makeLevel(1)), treasures: 1 };
    // Wonders roll 1 -> Jester Hat (2 HP; Can't Move in Silence).
    const next = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 5, maxSpellUses: {} }, fixedDie(1));
    expect(next.treasures).toBe(0);
    expect(next.armor).toEqual([{ piece: "wonderItem", hp: 2, maxHp: 2, itemName: "Jester Hat", effect: { kind: "flavor" } }]);
    expect(next.log[0]!.message).toContain("Jester Hat");
  });

  it("Palace roll 5 redirects to a Wonder with no HP -- a standing-effect-only 0 HP item", () => {
    const state: DungeonState = { ...stateWithLevel(makeLevel(1)), treasures: 1 };
    // Wonders roll 3 -> Amulet of the Dead (Ignores Undead effect).
    const next = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 5, maxSpellUses: {} }, fixedDie(3));
    expect(next.armor).toEqual([
      { piece: "wonderItem", hp: 0, maxHp: 0, itemName: "Amulet of the Dead", effect: { kind: "ignoresMonsterAbility", ability: "undead" } },
    ]);
  });

  it("Palace roll 6 redirects to the Magic Item table and, for an [Armor] grant, rolls the base Armor table and bakes the bonus into its HP", () => {
    const state: DungeonState = { ...stateWithLevel(makeLevel(1)), treasures: 1 };
    // Magic Item roll 3 -> Centurion's [Armor] (+1 HP); base Armor roll 3 (same forced die) -> Boots (3 HP).
    const next = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 6, maxSpellUses: {} }, fixedDie(3));
    expect(next.armor).toEqual([{ piece: "boots", hp: 4, maxHp: 4, itemName: "Centurion's [Armor]", effect: undefined }]);
  });

  it("Palace roll 6 redirects to the Magic Item table and, for a [Weapon] grant, rolls the base Weapon table and attaches the bonus effect", () => {
    const state: DungeonState = { ...stateWithLevel(makeLevel(1)), treasures: 1 };
    // Magic Item roll 4 -> [Weapon] of Destruction (+2 damage); base Weapon roll 4 -> Whip (1d6+1).
    const next = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 6, maxSpellUses: {} }, fixedDie(4));
    expect(next.weapon).toEqual({
      name: "Whip",
      formula: "1d6+1",
      twoHanded: undefined,
      bonusEffect: { kind: "weaponDamageBonus", amount: 2 },
    });
  });

  it("Mana Potion (Tomb roll 1) restores every spell to its max uses", () => {
    const state: DungeonState = {
      ...stateWithLevel(makeLevel(1)),
      dungeonTypeKey: "tomb",
      treasures: 1,
      spellUses: { 1: 0, 6: 1 },
    };
    const next = dungeonReducer(state, {
      type: "OPEN_TREASURE",
      roll: 1,
      maxSpellUses: { 1: 3, 6: 3 },
    });
    expect(next.spellUses).toEqual({ 1: 3, 6: 3 });
  });

  it("Crypt roll 5 redirects to the Wonders table; Potion of Luminescence (wonders roll 6) grants torches, capped at 10", () => {
    const state: DungeonState = { ...stateWithLevel(makeLevel(1)), dungeonTypeKey: "crypt", treasures: 1, torches: 5 };
    const next = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 5, maxSpellUses: {} }, fixedDie(6));
    expect(next.torches).toBe(7);
  });

  it("grantsTorches never pushes the total past the 10-torch cap", () => {
    const state: DungeonState = { ...stateWithLevel(makeLevel(1)), dungeonTypeKey: "crypt", treasures: 1, torches: 9 };
    const next = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 5, maxSpellUses: {} }, fixedDie(6));
    expect(next.torches).toBe(10);
  });

  it("Tomb roll 5 redirects to the Wonders table; Sapphire of Magic (wonders roll 5) grants a random Spell use", () => {
    const state: DungeonState = { ...stateWithLevel(makeLevel(1)), dungeonTypeKey: "tomb", treasures: 1, spellUses: {} };
    const next = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 5, maxSpellUses: {} }, fixedDie(5));
    expect(next.spellUses).toEqual({ 5: 1 });
    expect(next.log[0]!.message).toContain("Lightning");
  });

  it("Crypt roll 6 redirects to the Magic Item table; Vampiric [Weapon] (magicItem roll 5) attaches a lifesteal bonusEffect", () => {
    const state: DungeonState = { ...stateWithLevel(makeLevel(1)), dungeonTypeKey: "crypt", treasures: 1 };
    const next = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 6, maxSpellUses: {} }, fixedDie(5));
    expect(next.weapon).toEqual({
      name: "Sickle",
      formula: "1d6+1",
      twoHanded: undefined,
      bonusEffect: { kind: "lifesteal", amount: 1 },
    });
  });

  it("Boatman's Oar (Crypt magicItem roll 6) uses its own fixed formula instead of rolling the base Weapon table", () => {
    const state: DungeonState = { ...stateWithLevel(makeLevel(1)), dungeonTypeKey: "crypt", treasures: 1 };
    const next = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 6, maxSpellUses: {} }, fixedDie(6));
    expect(next.weapon).toEqual({
      name: "Boatman's Oar",
      formula: "1d6+1",
      bonusEffect: { kind: "ignoresMonsterAbility", ability: "intangible" },
    });
  });

  it("a negative extraHp Magic Item (Bone [Armor]) clamps the piece's HP at 0 instead of going negative", () => {
    const state: DungeonState = { ...stateWithLevel(makeLevel(1)), dungeonTypeKey: "tomb", treasures: 1 };
    // Magic Item roll 1 -> Bone [Armor] (-1 HP); base Armor roll 1 (same forced die) -> Ring (0 HP).
    const next = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 6, maxSpellUses: {} }, fixedDie(1));
    expect(next.armor).toEqual([{ piece: "ring", hp: 0, maxHp: 0, itemName: "Bone [Armor]", effect: undefined }]);
  });

  it("Prison roll 4 redirects straight to the Weapon table, bypassing Wonders/Magic Item entirely", () => {
    const state: DungeonState = { ...stateWithLevel(makeLevel(1)), dungeonTypeKey: "prison", treasures: 1 };
    const next = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 4, maxSpellUses: {} }, fixedDie(3));
    expect(next.weapon).toEqual({ name: "Spear", formula: "1d6+1", twoHanded: undefined });
  });
});

describe("OPEN_TREASURE guards", () => {
  it("is a no-op with no treasures to open", () => {
    const state: DungeonState = { ...stateWithLevel(makeLevel(1)), treasures: 0 };
    const next = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 1, maxSpellUses: {} });
    expect(next).toBe(state);
  });

  it("is a no-op once the character is dead", () => {
    const state: DungeonState = { ...stateWithLevel(makeLevel(1)), treasures: 1, alive: false };
    const next = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 1, maxSpellUses: {} });
    expect(next).toBe(state);
  });
});

describe("RESUME_DUNGEON", () => {
  it("carries over the map/exploration state but resets the new character's own resources", () => {
    const room = makeSegment({
      id: 1,
      type: "room-small",
      doors: [],
      monsters: { name: "Orc", hp: 6, damage: 3, abilities: ["loot"], count: 1 },
      remains: { names: ["An Even Earlier Hero"], coins: 3, treasures: 0, keys: 0, heldItems: [], armor: [], weapon: null },
    });
    const level = { ...makeLevel(1), segments: [room] };
    const persisted: DungeonState = {
      ...createInitialDungeonState(3, 5, "1d6-2"), // the fallen character's near-death leftovers
      dungeonTypeKey: "palace",
      dungeonName: "The Palace of the Secret Horrors",
      levels: [level],
      stats: { segments: 1, corridors: 0, rooms: 1, staircases: 0, doorsRemaining: 0, finalRooms: 0 },
      log: [{ id: 1, message: "Some prior history", variant: "normal" }],
      alive: false,
      deathCause: "darkness",
      hp: 0,
      torches: 0,
      monsterKills: 12, // the fallen character's own kill count -- should NOT carry over
      bossKills: 1,
      killsByName: { orc: 10, goblin: 2 },
      killsByAbility: { loot: 5 },
    };

    const next = dungeonReducer(createInitialDungeonState(), {
      type: "RESUME_DUNGEON",
      dungeon: persisted,
      torches: 10,
      hp: 24,
      maxHp: 24,
      weaponFormula: "1d6+1",
      spellUses: { 1: 2 },
      characterName: "New Hero",
      raceName: "",
      className: "",
    });

    expect(next.dungeonName).toBe("The Palace of the Secret Horrors");
    expect(next.levels).toHaveLength(1);
    expect(next.levels[0]!.segments).toHaveLength(1);
    expect(next.stats.rooms).toBe(1);
    expect(next.log.some((entry) => entry.message === "Some prior history")).toBe(true);
    // the new character's own stats, not the fallen one's leftovers
    expect(next.torches).toBe(10);
    expect(next.hp).toBe(24);
    expect(next.maxHp).toBe(24);
    expect(next.weaponFormula).toBe("1d6+1");
    expect(next.spellUses).toEqual({ 1: 2 });
    expect(next.alive).toBe(true);
    expect(next.deathCause).toBeNull();
    expect(next.characterName).toBe("New Hero");
    // a new adventurer starts back at 0 kills, even taking over the fallen one's own map
    expect(next.monsterKills).toBe(0);
    expect(next.bossKills).toBe(0);
    expect(next.killsByName).toEqual({});
    expect(next.killsByAbility).toEqual({});
    // an even earlier fallen adventurer's remains are still there to recover
    expect(next.levels[0]!.segments[0]!.remains).toEqual({
      names: ["An Even Earlier Hero"],
      coins: 3,
      treasures: 0,
      keys: 0,
      heldItems: [],
    armor: [],
    weapon: null,
    });
  });

  it("does not restart combat when the room's monsters were already defeated", () => {
    const room = makeSegment({
      id: 1,
      type: "room-small",
      doors: [],
      monsters: { name: "Orc", hp: 6, damage: 3, abilities: [], count: 1 },
      monstersDefeated: true,
    });
    const level = { ...makeLevel(1), segments: [room] };
    const persisted: DungeonState = {
      ...createInitialDungeonState(),
      dungeonTypeKey: "palace",
      levels: [level],
      combat: null,
    };

    // this room is also the entrance the new character starts at, so it's immediately rerolled
    // (see "Monster table re-roll on return" below) -- monster sum 1+6 = 7 -> null, no monster.
    const next = dungeonReducer(
      createInitialDungeonState(),
      {
        type: "RESUME_DUNGEON",
        dungeon: persisted,
        torches: 10,
        hp: 20,
        maxHp: 20,
        weaponFormula: "1d6",
        spellUses: {},
        characterName: "New Hero",
        raceName: "",
        className: "",
      },
      sequenceDie([1, 6]),
    );

    expect(next.combat).toBeNull();
  });

  it("respawns the interrupted fight at full HP for the new character, preserving isBoss", () => {
    const room = makeSegment({
      id: 1,
      type: "final",
      doors: [],
      monsters: { name: "Orc King", hp: 24, damage: 5, abilities: ["horde"], count: 1 },
    });
    const level = { ...makeLevel(3), isFinalRoomLevel: true, segments: [room] };
    const combat: CombatState = {
      segId: 1,
      monsters: [
        {
          id: 1,
          name: "Orc King",
          hp: 6,
          maxHp: 24,
          damage: 5,
          abilities: ["horde"],
          bonusDamage: 0,
          deathtouchPending: false,
          paralyzePending: 0,
          skipNextAttack: false,
        },
      ],
      paralyzedTurns: 0,
      pendingLootRolls: 0,
      isBoss: true,
      outcome: "ongoing",
      pendingDamage: null,
      playerDamageBonus: 0,
      engulfableBodies: 0,
    };
    const persisted: DungeonState = {
      ...createInitialDungeonState(),
      dungeonTypeKey: "palace",
      levels: [level],
      combat,
      alive: false,
      deathCause: "combat",
    };

    const next = dungeonReducer(createInitialDungeonState(), {
      type: "RESUME_DUNGEON",
      dungeon: persisted,
      torches: 10,
      hp: 30,
      maxHp: 30,
      weaponFormula: "1d6",
      spellUses: {},
      characterName: "New Hero",
      raceName: "",
      className: "",
    });

    expect(next.combat).not.toBeNull();
    expect(next.combat!.isBoss).toBe(true);
    expect(next.combat!.monsters[0]!.hp).toBe(24); // full HP again, not the 6 it was left at
    expect(next.selectedSegId).toBe(1);
  });

  it("starts the new character at the entrance (segment 1), not wherever the dead one left off", () => {
    const entrance = makeSegment({ id: 1, type: "room-small", doors: [] });
    const entranceLevel = { ...makeLevel(1), segments: [entrance] };
    const deepRoom = makeSegment({ id: 7, type: "room-small", doors: [] });
    const deepLevel = { ...makeLevel(2), segments: [deepRoom] };
    const persisted: DungeonState = {
      ...createInitialDungeonState(),
      dungeonTypeKey: "palace",
      levels: [entranceLevel, deepLevel],
      activeLevel: 1, // the dead character was on level 2 when they died
      selectedSegId: 7,
    };

    const next = dungeonReducer(createInitialDungeonState(), {
      type: "RESUME_DUNGEON",
      dungeon: persisted,
      torches: 10,
      hp: 20,
      maxHp: 20,
      weaponFormula: "1d6",
      spellUses: {},
      characterName: "New Hero",
      raceName: "",
      className: "",
    });

    expect(next.levels).toHaveLength(2); // the full map is still there, just not where you start
    expect(next.activeLevel).toBe(0);
    expect(next.selectedSegId).toBe(1);
  });

  it("does not drop the new character straight into the old character's interrupted Boss fight", () => {
    const entrance = makeSegment({ id: 1, type: "room-small", doors: [] });
    const entranceLevel = { ...makeLevel(1), segments: [entrance] };
    const boss = makeSegment({
      id: 7,
      type: "final",
      doors: [],
      monsters: { name: "Orc King", hp: 24, damage: 5, abilities: ["horde"], count: 1 },
    });
    const bossLevel = { ...makeLevel(3), isFinalRoomLevel: true, segments: [boss] };
    const combat: CombatState = {
      segId: 7,
      monsters: [
        {
          id: 1,
          name: "Orc King",
          hp: 6,
          maxHp: 24,
          damage: 5,
          abilities: ["horde"],
          bonusDamage: 0,
          deathtouchPending: false,
          paralyzePending: 0,
          skipNextAttack: false,
        },
      ],
      paralyzedTurns: 0,
      pendingLootRolls: 0,
      isBoss: true,
      outcome: "ongoing",
      pendingDamage: null,
      playerDamageBonus: 0,
      engulfableBodies: 0,
    };
    const persisted: DungeonState = {
      ...createInitialDungeonState(),
      dungeonTypeKey: "palace",
      levels: [entranceLevel, entranceLevel, bossLevel], // depth-3 Boss level at index 2
      activeLevel: 2,
      selectedSegId: 7,
      combat,
      alive: false,
      deathCause: "combat",
    };

    const next = dungeonReducer(
      createInitialDungeonState(),
      {
        type: "RESUME_DUNGEON",
        dungeon: persisted,
        torches: 10,
        hp: 20,
        maxHp: 20,
        weaponFormula: "1d6",
        spellUses: {},
        characterName: "New Hero",
        raceName: "",
        className: "",
      },
      // the entrance is itself an empty room, so restoring flags it for its own Monster
      // re-roll (see #18) -- monster sum 3+4=7 -> null, keeping this test focused on the
      // Boss-room bug rather than an incidental fresh encounter at the entrance.
      sequenceDie([3, 4]),
    );

    // lands at the entrance, not the Boss room -- and critically, isn't thrown into combat.
    expect(next.activeLevel).toBe(0);
    expect(next.selectedSegId).toBe(1);
    expect(next.combat).toBeNull();

    // the Boss is still there, full HP, waiting -- just not fought until the new character
    // actually walks there (see "Resuming a fight abandoned via Teleport" for that mechanism).
    const bossSeg = next.levels[2]!.segments[0]!;
    expect(bossSeg.monsters).toMatchObject({ name: "Orc King", hp: 24 });
    expect(bossSeg.monstersDefeated).toBeFalsy();
  });
});

describe("RETURN_TO_DUNGEON", () => {
  it("carries over the map/exploration state AND the same character's exact resources", () => {
    const room = makeSegment({ id: 1, type: "room-small", doors: [] });
    const level = { ...makeLevel(1), segments: [room] };
    const persisted: DungeonState = {
      ...createInitialDungeonState(3, 12, "1d6"),
      dungeonTypeKey: "palace",
      dungeonName: "The Palace of the Secret Horrors",
      levels: [level],
      stats: { segments: 1, corridors: 0, rooms: 1, staircases: 0, doorsRemaining: 0, finalRooms: 0 },
      log: [{ id: 1, message: "Some prior history", variant: "normal" }],
    };

    const next = dungeonReducer(createInitialDungeonState(), {
      type: "RETURN_TO_DUNGEON",
      dungeon: persisted,
      torches: 8, // after buying torches in town
      hp: 20, // after resting
      maxHp: 20,
      coins: 4,
      treasures: 1,
      keys: 2,
      heldItems: [{ name: "Ornament", worth: 5 }],
      armor: [],
      weapon: null,
      weaponFormula: "1d6",
      spellUses: { 1: 3 },
      characterName: "Pip",
      raceName: "",
      className: "",
      monsterKills: 5,
      bossKills: 1,
      killsByName: { orc: 4, goblin: 1 },
      killsByAbility: { loot: 2 },
    });

    expect(next.dungeonName).toBe("The Palace of the Secret Horrors");
    expect(next.levels).toHaveLength(1);
    expect(next.log.some((entry) => entry.message === "Some prior history")).toBe(true);
    expect(next.log.some((entry) => entry.message === "You return to the dungeon.")).toBe(true);
    // the same character's own resources carry over exactly, unlike RESUME_DUNGEON
    expect(next.torches).toBe(8);
    expect(next.hp).toBe(20);
    expect(next.maxHp).toBe(20);
    expect(next.coins).toBe(4);
    expect(next.treasures).toBe(1);
    expect(next.keys).toBe(2);
    expect(next.heldItems).toEqual([{ name: "Ornament", worth: 5 }]);
    expect(next.spellUses).toEqual({ 1: 3 });
    expect(next.alive).toBe(true);
    expect(next.characterName).toBe("Pip");
    expect(next.monsterKills).toBe(5);
    expect(next.bossKills).toBe(1);
    expect(next.killsByName).toEqual({ orc: 4, goblin: 1 });
    expect(next.killsByAbility).toEqual({ loot: 2 });
  });

  it("preserves maxHp even when returning without full HP (regression: Rest healing to a shrunken max)", () => {
    const room = makeSegment({ id: 1, type: "room-small", doors: [] });
    const level = { ...makeLevel(1), segments: [room] };
    const persisted: DungeonState = {
      ...createInitialDungeonState(),
      dungeonTypeKey: "palace",
      levels: [level],
    };

    // Retreated without resting first -- hp (12) is well below the true max (20).
    const next = dungeonReducer(createInitialDungeonState(), {
      type: "RETURN_TO_DUNGEON",
      dungeon: persisted,
      torches: 5,
      hp: 12,
      maxHp: 20,
      coins: 0,
      treasures: 0,
      keys: 0,
      heldItems: [],
      armor: [],
      weapon: null,
      weaponFormula: "1d6",
      spellUses: {},
      characterName: "Pip",
      raceName: "",
      className: "",
      monsterKills: 0,
      bossKills: 0,
      killsByName: {},
      killsByAbility: {},
    });

    expect(next.hp).toBe(12);
    expect(next.maxHp).toBe(20); // NOT clamped down to the current, reduced hp
  });

  it("respawns an interrupted fight at full HP, same as RESUME_DUNGEON", () => {
    const room = makeSegment({
      id: 1,
      type: "room-small",
      doors: [],
      monsters: { name: "Orc", hp: 6, damage: 3, abilities: [], count: 1 },
    });
    const level = { ...makeLevel(1), segments: [room] };
    const combat: CombatState = {
      segId: 1,
      monsters: [
        {
          id: 1,
          name: "Orc",
          hp: 2,
          maxHp: 6,
          damage: 3,
          abilities: [],
          bonusDamage: 0,
          deathtouchPending: false,
          paralyzePending: 0,
          skipNextAttack: false,
        },
      ],
      paralyzedTurns: 0,
      pendingLootRolls: 0,
      isBoss: false,
      outcome: "ongoing",
      pendingDamage: null,
      playerDamageBonus: 0,
      engulfableBodies: 0,
    };
    const persisted: DungeonState = {
      ...createInitialDungeonState(),
      dungeonTypeKey: "palace",
      levels: [level],
      combat,
    };

    const next = dungeonReducer(createInitialDungeonState(), {
      type: "RETURN_TO_DUNGEON",
      dungeon: persisted,
      torches: 10,
      hp: 20,
      maxHp: 20,
      coins: 0,
      treasures: 0,
      keys: 0,
      heldItems: [],
      armor: [],
      weapon: null,
      weaponFormula: "1d6",
      spellUses: {},
      characterName: "Pip",
      raceName: "",
      className: "",
      monsterKills: 0,
      bossKills: 0,
      killsByName: {},
      killsByAbility: {},
    });

    expect(next.combat).not.toBeNull();
    expect(next.combat!.monsters[0]!.hp).toBe(6); // full HP again, not the 2 it was left at
    expect(next.selectedSegId).toBe(1);
  });

  it("stays on the same level, unlike RESUME_DUNGEON's reset to Level 1, but still walks back to that level's own entry point", () => {
    const entrance = makeSegment({ id: 1, type: "room-small", doors: [] });
    const entranceLevel = { ...makeLevel(1), segments: [entrance] };
    // Two segments on the deep level -- the player had wandered from the level's own entry
    // point (id 6) to a second room (id 7) before retreating to town.
    const deepEntry = makeSegment({ id: 6, type: "room-small", doors: [] });
    const deepRoom = makeSegment({ id: 7, type: "room-small", doors: [] });
    const deepLevel = { ...makeLevel(2), segments: [deepEntry, deepRoom] };
    const persisted: DungeonState = {
      ...createInitialDungeonState(),
      dungeonTypeKey: "palace",
      levels: [entranceLevel, deepLevel],
      activeLevel: 1,
      selectedSegId: 7,
      currentSegId: 7,
    };

    const next = dungeonReducer(createInitialDungeonState(), {
      type: "RETURN_TO_DUNGEON",
      dungeon: persisted,
      torches: 10,
      hp: 20,
      maxHp: 20,
      coins: 0,
      treasures: 0,
      keys: 0,
      heldItems: [],
      armor: [],
      weapon: null,
      weaponFormula: "1d6",
      spellUses: {},
      characterName: "Pip",
      raceName: "",
      className: "",
      monsterKills: 0,
      bossKills: 0,
      killsByName: {},
      killsByAbility: {},
    });

    // still on Level 2 (unlike RESUME_DUNGEON, which always resets activeLevel to 0)...
    expect(next.activeLevel).toBe(1);
    // ...but back at that level's own entry segment, not the deep room -- closing the loophole
    // where returning would otherwise let the player skip straight past #18's Monster re-roll.
    expect(next.selectedSegId).toBe(6);
    expect(next.currentSegId).toBe(6);
  });
});

describe("Monster table re-roll on return", () => {
  it("flags empty/cleared rooms, rerolling the currently-selected one immediately but leaving others flagged for later", () => {
    const room1 = makeSegment({ id: 1, type: "room-small", doors: [] }); // never had a monster
    const room2 = makeSegment({
      id: 2,
      type: "room-small",
      doors: [],
      monsters: { name: "Orc", hp: 6, damage: 3, abilities: [], count: 1 },
      monstersDefeated: true, // already cleared
    });
    const level = { ...makeLevel(1), segments: [room1, room2] };
    const persisted: DungeonState = {
      ...createInitialDungeonState(),
      dungeonTypeKey: "palace",
      levels: [level],
      selectedSegId: 1,
    };

    // monster sum for room1's immediate reroll: 1+1 = 2 -> Minotaur (Palace row 2)
    const rng = sequenceDie([1, 1]);
    const next = dungeonReducer(
      createInitialDungeonState(),
      {
        type: "RETURN_TO_DUNGEON",
        dungeon: persisted,
        torches: 10,
        hp: 20,
        maxHp: 20,
        coins: 0,
        treasures: 0,
        keys: 0,
        heldItems: [],
        armor: [],
        weapon: null,
        weaponFormula: "1d6",
        spellUses: {},
        characterName: "Pip",
        raceName: "",
        className: "",
        monsterKills: 0,
        bossKills: 0,
        killsByName: {},
        killsByAbility: {},
      },
      rng,
    );

    const seg1 = next.levels[0]!.segments.find((s) => s.id === 1)!;
    expect(seg1.monsters).toEqual(DUNGEON_TABLES.palace.monsters[2]);
    expect(seg1.needsMonsterReroll).toBe(false);
    expect(next.combat).not.toBeNull();
    expect(next.combat!.monsters[0]).toMatchObject({ name: "Minotaur" });

    // room2 wasn't looked at -- still flagged, untouched until the player selects it
    const seg2 = next.levels[0]!.segments.find((s) => s.id === 2)!;
    expect(seg2.needsMonsterReroll).toBe(true);
    expect(seg2.monsters).toEqual({ name: "Orc", hp: 6, damage: 3, abilities: [], count: 1 });
    expect(seg2.monstersDefeated).toBe(true);
  });

  it("does not flag the room whose interrupted fight was just respawned", () => {
    const room = makeSegment({
      id: 1,
      type: "room-small",
      doors: [],
      monsters: { name: "Orc", hp: 6, damage: 3, abilities: [], count: 1 },
    });
    const level = { ...makeLevel(1), segments: [room] };
    const combat: CombatState = {
      segId: 1,
      monsters: [
        { id: 1, name: "Orc", hp: 2, maxHp: 6, damage: 3, abilities: [], bonusDamage: 0, deathtouchPending: false, paralyzePending: 0, skipNextAttack: false },
      ],
      paralyzedTurns: 0,
      pendingLootRolls: 0,
      isBoss: false,
      outcome: "ongoing",
      pendingDamage: null,
      playerDamageBonus: 0,
      engulfableBodies: 0,
    };
    const persisted: DungeonState = { ...createInitialDungeonState(), dungeonTypeKey: "palace", levels: [level], combat };

    const next = dungeonReducer(createInitialDungeonState(), {
      type: "RETURN_TO_DUNGEON",
      dungeon: persisted,
      torches: 10,
      hp: 20,
      maxHp: 20,
      coins: 0,
      treasures: 0,
      keys: 0,
      heldItems: [],
      armor: [],
      weapon: null,
      weaponFormula: "1d6",
      spellUses: {},
      characterName: "Pip",
      raceName: "",
      className: "",
      monsterKills: 0,
      bossKills: 0,
      killsByName: {},
      killsByAbility: {},
    });

    expect(next.levels[0]!.segments[0]!.needsMonsterReroll).toBeFalsy();
    expect(next.combat!.monsters[0]!.hp).toBe(6); // respawned at full HP, not rerolled into a new monster
  });

  it("SELECT_SEGMENT resolves a flagged room's reroll and starts combat when monsters appear", () => {
    const room = makeSegment({ id: 1, type: "room-small", doors: [], needsMonsterReroll: true });
    const level = { ...makeLevel(1), segments: [room] };
    const state = { ...stateWithLevel(level), selectedSegId: 2 }; // start on a different id so the click actually changes selection

    // monster sum 3+3 = 6 -> Goblins (Palace row 6)
    const rng = sequenceDie([3, 3]);
    const next = dungeonReducer(state, { type: "SELECT_SEGMENT", segId: 1 }, rng);

    const seg = next.levels[0]!.segments[0]!;
    expect(seg.needsMonsterReroll).toBe(false);
    expect(seg.monsters).toEqual(DUNGEON_TABLES.palace.monsters[6]);
    expect(next.combat).not.toBeNull();
    expect(next.combat!.monsters[0]).toMatchObject({ name: "Goblins" });
  });

  it("SELECT_SEGMENT leaves an unflagged room untouched", () => {
    const room = makeSegment({ id: 1, type: "room-small", doors: [] });
    const level = { ...makeLevel(1), segments: [room] };
    const state = { ...stateWithLevel(level), selectedSegId: 2 };

    const next = dungeonReducer(state, { type: "SELECT_SEGMENT", segId: 1 }, fixedDie(1));

    expect(next.levels[0]!.segments[0]!.monsters).toBeUndefined();
    expect(next.combat).toBeNull();
  });

  it("a reroll that lands on an empty result clears any stale monstersDefeated flag", () => {
    const room = makeSegment({
      id: 1,
      type: "room-small",
      doors: [],
      needsMonsterReroll: true,
      monsters: { name: "Orc", hp: 6, damage: 3, abilities: [], count: 1 },
      monstersDefeated: true,
    });
    const level = { ...makeLevel(1), segments: [room] };
    const state = { ...stateWithLevel(level), selectedSegId: 2 };

    // monster sum 4+3 = 7 -> null (Palace row 7 has no monster)
    const rng = sequenceDie([4, 3]);
    const next = dungeonReducer(state, { type: "SELECT_SEGMENT", segId: 1 }, rng);

    const seg = next.levels[0]!.segments[0]!;
    expect(seg.needsMonsterReroll).toBe(false);
    expect(seg.monsters).toBeUndefined();
    expect(seg.monstersDefeated).toBeUndefined();
    expect(next.combat).toBeNull();
  });

  it("leaves already-resolved room content (chest, secret passage) untouched by the reroll", () => {
    const room = makeSegment({
      id: 1,
      type: "room-small",
      doors: [],
      needsMonsterReroll: true,
      monstersDefeated: true,
      chestOpened: true,
      chestResult: "5 coins, 2 Treasures.",
      secretPassageSearched: true,
      secretPassageResult: "Nothing here.",
    });
    const level = { ...makeLevel(1), segments: [room] };
    const state = { ...stateWithLevel(level), selectedSegId: 2 };

    const next = dungeonReducer(state, { type: "SELECT_SEGMENT", segId: 1 }, sequenceDie([5, 5]));

    const seg = next.levels[0]!.segments[0]!;
    expect(seg.chestOpened).toBe(true);
    expect(seg.chestResult).toBe("5 coins, 2 Treasures.");
    expect(seg.secretPassageSearched).toBe(true);
    expect(seg.secretPassageResult).toBe("Nothing here.");
  });
});

describe("Resuming a fight abandoned via Teleport", () => {
  // Teleport (CAST_SPELL spellRoll 3) clears combat outright without marking the segment's
  // monsters defeated -- unlike a death or a Town retreat mid-fight, there's no persisted
  // CombatState left behind for anything to eagerly respawn, so nothing previously picked the
  // fight back up: it just silently vanished forever, boss included.

  it("re-engages a fled fight the moment the player selects that segment again, in the same session", () => {
    const monster: MonsterTemplate = { name: "Orc", hp: 6, damage: 3, abilities: [], count: 1 };
    const room = makeSegment({ id: 1, type: "room-small", doors: [], monsters: monster });
    const level = { ...makeLevel(1), segments: [room] };
    // selectedSegId starts elsewhere so the click below isn't a same-segment no-op.
    const state = { ...stateWithLevel(level), selectedSegId: null, currentSegId: 1 };

    const next = dungeonReducer(state, { type: "SELECT_SEGMENT", segId: 1 });
    expect(next.combat).not.toBeNull();
    expect(next.combat!.monsters[0]).toMatchObject({ name: "Orc", hp: 6 });
    expect(next.log.some((e) => e.message.includes("still waiting"))).toBe(true);
  });

  it("does not re-trigger for a segment whose monsters were actually defeated", () => {
    const monster: MonsterTemplate = { name: "Orc", hp: 6, damage: 3, abilities: [], count: 1 };
    const room = makeSegment({ id: 1, type: "room-small", doors: [], monsters: monster, monstersDefeated: true });
    const level = { ...makeLevel(1), segments: [room] };
    const state = { ...stateWithLevel(level), selectedSegId: null, currentSegId: 1 };

    const next = dungeonReducer(state, { type: "SELECT_SEGMENT", segId: 1 });
    expect(next.combat).toBeNull();
  });

  it("resumes a fled Boss fight (isBoss) on RETURN_TO_DUNGEON when the Final Room is the level's only segment", () => {
    const boss: MonsterTemplate = { name: "Orc King", hp: 24, damage: 5, abilities: ["horde"], count: 1 };
    const finalSeg = makeSegment({ id: 5, type: "final", doors: [], monsters: boss });
    const finalLevel = { ...makeLevel(3), isFinalRoomLevel: true, segments: [finalSeg] };
    const persisted: DungeonState = {
      ...createInitialDungeonState(),
      dungeonTypeKey: "palace",
      levels: [finalLevel],
      activeLevel: 0,
      combat: null, // fled via Teleport -- nothing left to eagerly respawn here
    };

    const next = dungeonReducer(createInitialDungeonState(), {
      type: "RETURN_TO_DUNGEON",
      dungeon: persisted,
      torches: 10,
      hp: 20,
      maxHp: 20,
      coins: 0,
      treasures: 0,
      keys: 0,
      heldItems: [],
      armor: [],
      weapon: null,
      weaponFormula: "1d6",
      spellUses: {},
      characterName: "Pip",
      raceName: "",
      className: "",
      monsterKills: 0,
      bossKills: 0,
      killsByName: {},
      killsByAbility: {},
    });

    expect(next.combat).not.toBeNull();
    expect(next.combat!.isBoss).toBe(true);
    expect(next.combat!.monsters[0]).toMatchObject({ name: "Orc King", hp: 24 }); // full HP
  });
});

describe("isDungeonBeaten", () => {
  it("is false with no levels at all", () => {
    expect(isDungeonBeaten(createInitialDungeonState())).toBe(false);
  });

  it("is false when the Final Room's boss hasn't been defeated yet", () => {
    const finalSeg = makeSegment({ id: 1, type: "final", doors: [], monsters: { name: "Boss", hp: 10, damage: 1, abilities: [], count: 1 } });
    const level = { ...makeLevel(3), isFinalRoomLevel: true, segments: [finalSeg] };
    const state: DungeonState = { ...createInitialDungeonState(), levels: [level] };
    expect(isDungeonBeaten(state)).toBe(false);
  });

  it("is true once the Final Room's boss is marked defeated", () => {
    const finalSeg = makeSegment({
      id: 1,
      type: "final",
      doors: [],
      monsters: { name: "Boss", hp: 10, damage: 1, abilities: [], count: 1 },
      monstersDefeated: true,
    });
    const level = { ...makeLevel(3), isFinalRoomLevel: true, segments: [finalSeg] };
    const state: DungeonState = { ...createInitialDungeonState(), levels: [level] };
    expect(isDungeonBeaten(state)).toBe(true);
  });
});

describe("hasUnlootedRemains", () => {
  it("is false with no levels, or no deaths", () => {
    expect(hasUnlootedRemains(createInitialDungeonState())).toBe(false);
    const room = makeSegment({ id: 1, type: "room-small", doors: [] });
    const level = { ...makeLevel(1), segments: [room] };
    expect(hasUnlootedRemains({ ...createInitialDungeonState(), levels: [level] })).toBe(false);
  });

  it("is true once a segment holds a fallen adventurer's remains", () => {
    const room = makeSegment({
      id: 1,
      type: "room-small",
      doors: [],
      remains: { names: ["Doomed Dara"], coins: 5, treasures: 0, keys: 0, heldItems: [], armor: [], weapon: null },
    });
    const level = { ...makeLevel(1), segments: [room] };
    expect(hasUnlootedRemains({ ...createInitialDungeonState(), levels: [level] })).toBe(true);
  });

  it("is false again once COLLECT_REMAINS clears the segment", () => {
    const room = makeSegment({
      id: 1,
      type: "room-small",
      doors: [],
      remains: { names: ["Doomed Dara"], coins: 5, treasures: 0, keys: 0, heldItems: [], armor: [], weapon: null },
    });
    const level = { ...makeLevel(1), segments: [room] };
    const state = stateWithLevel(level);

    const next = dungeonReducer(state, { type: "COLLECT_REMAINS", segId: 1 });
    expect(hasUnlootedRemains(next)).toBe(false);
  });
});

describe("countUnlootedRemains", () => {
  it("is 0 with no levels, or no deaths", () => {
    expect(countUnlootedRemains(createInitialDungeonState())).toBe(0);
    const room = makeSegment({ id: 1, type: "room-small", doors: [] });
    const level = { ...makeLevel(1), segments: [room] };
    expect(countUnlootedRemains({ ...createInitialDungeonState(), levels: [level] })).toBe(0);
  });

  it("sums names across every segment's remains, not just counting segments", () => {
    const roomA = makeSegment({
      id: 1,
      type: "room-small",
      doors: [],
      // Two different characters died in the same room -- leaveRemains() merges into one entry.
      remains: {
        names: ["Doomed Dara", "Unlucky Umar"],
        coins: 5,
        treasures: 0,
        keys: 0,
        heldItems: [],
        armor: [],
        weapon: null,
      },
    });
    const roomB = makeSegment({
      id: 2,
      type: "room-small",
      doors: [],
      remains: { names: ["Fallen Finn"], coins: 1, treasures: 0, keys: 0, heldItems: [], armor: [], weapon: null },
    });
    const level = { ...makeLevel(1), segments: [roomA, roomB] };
    expect(countUnlootedRemains({ ...createInitialDungeonState(), levels: [level] })).toBe(3);
  });

  it("drops back to 0 for a specific room once COLLECT_REMAINS clears it, keeping others intact", () => {
    const roomA = makeSegment({
      id: 1,
      type: "room-small",
      doors: [],
      remains: { names: ["Doomed Dara"], coins: 5, treasures: 0, keys: 0, heldItems: [], armor: [], weapon: null },
    });
    const roomB = makeSegment({
      id: 2,
      type: "room-small",
      doors: [],
      remains: { names: ["Fallen Finn"], coins: 1, treasures: 0, keys: 0, heldItems: [], armor: [], weapon: null },
    });
    const level = { ...makeLevel(1), segments: [roomA, roomB] };
    const state = stateWithLevel(level);

    const next = dungeonReducer(state, { type: "COLLECT_REMAINS", segId: 1 });
    expect(countUnlootedRemains(next)).toBe(1);
  });
});

describe("RESET", () => {
  it("returns to a completely fresh state", () => {
    const state: DungeonState = { ...stateWithLevel(makeLevel(1)), selectedSegId: 3, dungeonName: "The Prison" };
    const next = dungeonReducer(state, { type: "RESET" });
    expect(next).toEqual(createInitialDungeonState());
  });
});
