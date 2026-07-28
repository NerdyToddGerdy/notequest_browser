import { describe, expect, it } from "vitest";
import { DUNGEON_TABLES } from "../../data/dungeonTables.ts";
import {
  DUNGEON_TYPES,
  SEGMENTS_TABLE_BY_TYPE,
  SECRET_PASSAGE_TABLE_BY_TYPE,
} from "../../data/dungeonTypes.ts";
import { classifyDoorOpen, resolveRoomExtras, rollSegment } from "../dungeon.ts";
import { dungeonReducer } from "../dungeonReducer.ts";
import {
  createInitialDungeonState,
  isDungeonBeaten,
  makeLevel,
  type DungeonState,
  type SegmentState,
} from "../dungeonState.ts";
import { fixedDie, mulberry32, sequenceDie } from "../../test/mulberry32.ts";

/** Sewers (issue #30) -- the first dungeon type with no Boss and no Final Room, the first with
 * Tunnels, and the first with doors that can't be broken. */

function makeSegment(
  overrides: Partial<SegmentState> & Pick<SegmentState, "id" | "type" | "doors">,
): SegmentState {
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

function sewersState(level: ReturnType<typeof makeLevel>): DungeonState {
  return {
    ...createInitialDungeonState(),
    dungeonTypeKey: "sewers",
    levels: [level],
    activeLevel: 0,
    nextSegmentId: 100,
    currentSegId: level.segments[0]?.id ?? null,
  };
}

describe("Sewers tables", () => {
  it("is a real dungeon type with a tunnel entrance and four ways out of it", () => {
    const def = Object.values(DUNGEON_TYPES).find((d) => d.key === "sewers")!;
    expect(def.entranceType).toBe("tunnel");
    expect(def.doors).toBe(4); // "an intersection with 4 corridors"
  });

  it("has no Boss -- the rulebook gives it neither a Boss nor a Final Room", () => {
    expect(DUNGEON_TABLES.sewers.boss).toBeUndefined();
  });

  it("has a full Trap (1-6), Room Content (2-12) and Monster (2-12) set", () => {
    for (let r = 1; r <= 6; r++) expect(DUNGEON_TABLES.sewers.trap[r], `trap ${r}`).toBeDefined();
    for (let s = 2; s <= 12; s++) {
      expect(DUNGEON_TABLES.sewers.roomContent[s], `content ${s}`).toBeDefined();
    }
    // 7 and 8 are "There are no monsters in this room" -- deliberately absent, like every type.
    for (const s of [2, 3, 4, 5, 6, 9, 10, 11, 12]) {
      expect(DUNGEON_TABLES.sewers.monsters[s], `monsters ${s}`).toBeDefined();
    }
    expect(DUNGEON_TABLES.sewers.monsters[7]).toBeUndefined();
    expect(DUNGEON_TABLES.sewers.monsters[8]).toBeUndefined();
  });

  it("brings its own Segments and Secret Passage tables", () => {
    expect(SEGMENTS_TABLE_BY_TYPE.sewers).toBeDefined();
    expect(SECRET_PASSAGE_TABLE_BY_TYPE.sewers).toBeDefined();
  });

  it("has exactly one room that leads out", () => {
    const exits = Object.values(DUNGEON_TABLES.sewers.roomContent).filter((r) => r.isExit);
    expect(exits).toHaveLength(1);
    expect(exits[0]!.text).toContain("ladder");
  });
});

describe("tunnels", () => {
  it("following a tunnel yields more tunnel; opening off it yields rooms", () => {
    for (let roll = 1; roll <= 6; roll++) {
      expect(rollSegment("tunnel", roll, "sewers", true).type, `forward ${roll}`).toBe("tunnel");
      expect(rollSegment("tunnel", roll, "sewers", false).type, `side ${roll}`).toMatch(/^room-/);
    }
  });

  it("rolls Monsters but not Room Content -- the rule that makes it not a corridor", () => {
    const extras = resolveRoomExtras("tunnel", "sewers", fixedDie(1));
    expect(extras).toBeDefined();
    expect(extras!.roomContent).toBeUndefined();
    // 1 + 1 = 2 on the Monster table -> Rat swarm.
    expect(extras!.monsters?.name).toBe("Rat swarm");
  });

  it("a corridor still rolls neither, and a room still rolls both", () => {
    expect(resolveRoomExtras("corridor", "sewers", fixedDie(1))).toBeUndefined();
    const room = resolveRoomExtras("room-small", "sewers", fixedDie(1))!;
    expect(room.roomContent).toBeDefined();
    expect(room.monsters).not.toBeNull();
  });

  it("consumes the same RNG as a room, so it can't shift what's built next", () => {
    const a = mulberry32(11);
    resolveRoomExtras("tunnel", "sewers", a);
    const b = mulberry32(11);
    resolveRoomExtras("room-small", "sewers", b);
    // Both drew 4 dice (2 content + 2 monsters); the next value from each must match.
    expect(a()).toBeCloseTo(b());
  });
});

describe("no Final Room", () => {
  function deadEndish() {
    const seg = makeSegment({
      id: 1,
      type: "room-small",
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
    });
    // doorsRemaining 1 + no staircase is exactly what triggers a dead-end Final Room elsewhere.
    return { ...makeLevel(1), segments: [seg], doorsRemaining: 1, hasStaircase: false };
  }

  it("never builds a dead-end Final Room, where any other type would", () => {
    expect(classifyDoorOpen(sewersState(deadEndish()), 1, 0)).toEqual({ kind: "normal" });
    const palace = { ...sewersState(deadEndish()), dungeonTypeKey: "palace" as const };
    expect(classifyDoorOpen(palace, 1, 0)).toEqual({ kind: "dead-end-final" });
  });

  it("never descends into a Final Room at depth 3", () => {
    const stair = makeSegment({
      id: 1,
      type: "staircase",
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
    });
    const deep = { ...makeLevel(3), segments: [stair], depth: 2 };
    expect(classifyDoorOpen(sewersState(deep), 1, 0)).toEqual({ kind: "descend-normal" });
    const palace = { ...sewersState(deep), dungeonTypeKey: "palace" as const };
    expect(classifyDoorOpen(palace, 1, 0)).toEqual({ kind: "descend-final" });
  });
});

describe("floodgates", () => {
  function gateState() {
    const seg = makeSegment({
      id: 1,
      type: "room-small",
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null, floodgate: true }],
    });
    return {
      ...sewersState({ ...makeLevel(1), segments: [seg], doorsRemaining: 1 }),
      torches: 10,
      keys: 2,
    };
  }
  const resolve = (
    state: DungeonState,
    lockChoice: "pickLock" | "breakDoor" | "useKey" | null,
    doorRoll: number,
  ) =>
    dungeonReducer(
      state,
      { type: "RESOLVE_DOOR_LOCK", segId: 1, doorIdx: 0, doorRoll, trapRoll: 1, lockChoice },
      fixedDie(3),
    );

  it("is always locked, even on a roll that would otherwise be unlocked", () => {
    // A 5 is "unlocked" on the shared table -- a floodgate ignores it and stays locked.
    const next = resolve(gateState(), "pickLock", 5);
    expect(next.torches).toBe(9); // the lock was picked, so it really was locked
  });

  it("never fires a trap, even on a roll of 1", () => {
    const next = resolve(gateState(), "pickLock", 1);
    expect(next.hp).toBe(gateState().hp); // no trap damage
    expect(next.torches).toBe(9);
  });

  it("cannot be broken", () => {
    const before = gateState();
    const next = resolve(before, "breakDoor", 2);
    expect(next.levels[0]!.segments[0]!.doors[0]!.broken).toBeUndefined();
    expect(next.torches).toBe(before.torches);
  });

  it("still opens with a key", () => {
    const next = resolve(gateState(), "useKey", 2);
    expect(next.keys).toBe(1);
    expect(next.torches).toBe(10);
  });
});

describe("climbing out", () => {
  function ladderRoom(exitUsed = false) {
    const seg = makeSegment({
      id: 1,
      type: "room-small",
      doors: [],
      roomContent: DUNGEON_TABLES.sewers.roomContent[10],
    });
    return {
      ...sewersState({ ...makeLevel(1), segments: [seg] }),
      exitUsed: exitUsed || undefined,
    };
  }

  it("finishes the run -- the only completion a bossless dungeon has", () => {
    const before = ladderRoom();
    expect(isDungeonBeaten(before)).toBe(false);
    const next = dungeonReducer(before, { type: "CLIMB_OUT", segId: 1 }, fixedDie(3));
    expect(next.exitUsed).toBe(true);
    expect(isDungeonBeaten(next)).toBe(true);
  });

  it("sets Janitor's milestone (issue #62)", () => {
    const next = dungeonReducer(ladderRoom(), { type: "CLIMB_OUT", segId: 1 }, fixedDie(3));
    expect(next.milestones.clearedASewer).toBe(true);
  });

  it("is a no-op in a room with no ladder", () => {
    const plain = sewersState({
      ...makeLevel(1),
      segments: [
        makeSegment({
          id: 1,
          type: "room-small",
          doors: [],
          roomContent: DUNGEON_TABLES.sewers.roomContent[3],
        }),
      ],
    });
    expect(dungeonReducer(plain, { type: "CLIMB_OUT", segId: 1 }, fixedDie(3))).toBe(plain);
  });

  it("is a no-op from a room the player isn't standing in", () => {
    const away = { ...ladderRoom(), currentSegId: 99 };
    expect(dungeonReducer(away, { type: "CLIMB_OUT", segId: 1 }, fixedDie(3))).toBe(away);
  });

  it("can't be used twice", () => {
    const already = ladderRoom(true);
    expect(dungeonReducer(already, { type: "CLIMB_OUT", segId: 1 }, fixedDie(3))).toBe(already);
  });

  it("doesn't set the Sewer milestone for a ladder in some other dungeon type", () => {
    // Defensive: no other type prints an isExit row today, but the guard is by dungeonTypeKey.
    const elsewhere = { ...ladderRoom(), dungeonTypeKey: "palace" as const };
    const next = dungeonReducer(elsewhere, { type: "CLIMB_OUT", segId: 1 }, fixedDie(3));
    expect(next.exitUsed).toBe(true);
    expect(next.milestones.clearedASewer).toBe(false);
  });
});

describe("moving silently in a tunnel", () => {
  function tunnelWithMonsters(type: "tunnel" | "room-small") {
    const seg = makeSegment({
      id: 1,
      type,
      doors: [],
      monsters: { name: "Sewer Worm", hp: 10, damage: 3, abilities: [], count: 1 },
    });
    return { ...sewersState({ ...makeLevel(1), segments: [seg] }), torches: 10 };
  }

  it("a 2 gives you away in a tunnel, but not in a room", () => {
    const sneak = (state: DungeonState) =>
      dungeonReducer(
        state,
        { type: "RESOLVE_ROOM_ENTRY", segId: 1, choice: "moveSilently" },
        fixedDie(2),
      );
    // In a tunnel a 2 is detection -> combat starts.
    expect(sneak(tunnelWithMonsters("tunnel")).combat).not.toBeNull();
    // In an ordinary room the same roll slips past.
    const room = sneak(tunnelWithMonsters("room-small"));
    expect(room.combat).toBeNull();
    expect(room.levels[0]!.segments[0]!.sneakedPast).toBe(true);
  });

  it("a 3 still gets you past, even in a tunnel", () => {
    const next = dungeonReducer(
      tunnelWithMonsters("tunnel"),
      { type: "RESOLVE_ROOM_ENTRY", segId: 1, choice: "moveSilently" },
      fixedDie(3),
    );
    expect(next.combat).toBeNull();
    expect(next.levels[0]!.segments[0]!.sneakedPast).toBe(true);
  });
});

describe("the Sewers Treasure table", () => {
  it("grants rolled torches, capped at the carry limit", () => {
    const state = { ...sewersState({ ...makeLevel(1), segments: [] }), treasures: 1, torches: 8 };
    // Treasure roll 1 -> "1d6 Torches"; the 1d6 then rolls 6, but only 2 fit.
    const next = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 1 }, sequenceDie([6]));
    expect(next.torches).toBe(10);
    expect(next.treasures).toBe(0);
  });
});
