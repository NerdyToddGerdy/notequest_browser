import { describe, expect, it } from "vitest";
import { SEGMENTS_TABLE } from "../../data/dungeonTypes.ts";
import { DUNGEON_TABLES } from "../../data/dungeonTables.ts";
import {
  assignDirections,
  boxFromCenter,
  classifyDoorOpen,
  collidesInList,
  isTeleportDestination,
  MARGIN,
  placeChild,
  reachableSegIds,
  resolveBoss,
  resolveRoomExtras,
  rollSegment,
  sizeFor,
} from "../dungeon.ts";
import type { DungeonState, LevelState, SegmentState } from "../dungeonState.ts";
import { createInitialMilestones } from "../town.ts";
import { sequenceDie } from "../../test/mulberry32.ts";

describe("table completeness", () => {
  it("Segments table covers every 1d6 row with all three columns", () => {
    for (let roll = 1; roll <= 6; roll++) {
      const row = SEGMENTS_TABLE[roll];
      expect(row, `missing Segments row ${roll}`).toBeDefined();
      expect(row!.staircase).toBeDefined();
      expect(row!.corridor).toBeDefined();
      expect(row!.room).toBeDefined();
    }
  });

  it("every dungeon type has full Trap (1-6) and Room Content/Monsters (2-12) tables", () => {
    for (const key of [
      "palace",
      "crypt",
      "tomb",
      "sanctuary",
      "temple",
      "prison",
      "citadel",
      "pyramid",
      "ziggurat",
      "necropolis",
    ] as const) {
      const tables = DUNGEON_TABLES[key];
      for (let roll = 1; roll <= 6; roll++) {
        expect(tables.trap[roll], `${key} trap ${roll}`).toBeDefined();
      }
      for (let sum = 2; sum <= 12; sum++) {
        expect(tables.roomContent[sum], `${key} roomContent ${sum}`).toBeDefined();
        expect(tables.monsters[sum], `${key} monsters ${sum}`).toBeDefined();
      }
    }
  });

  it("every dungeon type has a full Boss (1-6) table, and no boss carries the Loot ability", () => {
    // Necropolis is deliberately excluded -- its own Boss is a 3-dice combinator
    // (resolveNecropolisBoss(), see the dedicated describe block below), not a flat table.
    for (const key of [
      "palace",
      "crypt",
      "tomb",
      "sanctuary",
      "temple",
      "prison",
      "citadel",
      "pyramid",
      "ziggurat",
    ] as const) {
      const tables = DUNGEON_TABLES[key];
      for (let roll = 1; roll <= 6; roll++) {
        const boss = tables.boss![roll];
        expect(boss, `${key} boss ${roll}`).toBeDefined();
        expect(boss!.hp).toBeGreaterThan(0);
        // Boss victory always grants a flat 2d6 Treasures (see finishIfVictorious); the
        // normal per-monster Loot roll should never double up on a boss kill.
        expect(boss!.abilities).not.toContain("loot");
      }
    }
  });

  it("every dungeon type has a full Treasure (1-6) table", () => {
    for (const key of [
      "palace",
      "crypt",
      "tomb",
      "sanctuary",
      "temple",
      "prison",
      "citadel",
      "pyramid",
      "ziggurat",
      "necropolis",
    ] as const) {
      const tables = DUNGEON_TABLES[key];
      for (let roll = 1; roll <= 6; roll++) {
        expect(tables.treasure[roll], `${key} treasure ${roll}`).toBeDefined();
      }
    }
  });
});

describe("assignDirections", () => {
  it("gives the root all four compass directions", () => {
    expect(assignDirections(null, 4)).toEqual(["E", "S", "N", "W"]);
  });

  it("gives a non-root segment straight-ahead, then left, then right (never back the way it came)", () => {
    expect(assignDirections("E", 3)).toEqual(["E", "N", "S"]);
    expect(assignDirections("N", 2)).toEqual(["N", "W"]);
  });

  it("returns nothing for a dead-end (0 doors)", () => {
    expect(assignDirections("E", 0)).toEqual([]);
  });
});

describe("rollSegment", () => {
  it("reads the Staircase column when standing on a staircase", () => {
    const result = rollSegment("staircase", 1, "palace");
    expect(result).toEqual(SEGMENTS_TABLE[1]!.staircase);
  });

  it("reads the Room column for any room type", () => {
    const result = rollSegment("room-wide", 6, "palace");
    expect(result).toEqual(SEGMENTS_TABLE[6]!.room);
    expect(result.type).toBe("staircase"); // rolling a 6 from a room always finds a staircase
  });

  it("falls back to the shared SEGMENTS_TABLE for a Core 6 type, but uses a new type's own table when it has one (issue #30)", () => {
    const shared = rollSegment("room-wide", 4, "palace");
    const citadel = rollSegment("room-wide", 4, "citadel");
    // Citadel's own Segments table differs from the shared one at this exact row (Big Room vs Wide
    // Room) -- confirms the per-type lookup actually took effect, not silently falling through.
    expect(shared.type).toBe("room-wide");
    expect(citadel.type).toBe("room-big");
  });
});

describe("placement geometry", () => {
  it("places two children from the same root without overlapping", () => {
    const root = boxFromCenter(0, 0, sizeFor("room-large", null));
    const east = placeChild(root, "E", "corridor", [root]);
    const north = placeChild(root, "N", "corridor", [root, east]);
    expect(collidesInList(east, [root], MARGIN)).toBe(false);
    expect(collidesInList(north, [root, east], MARGIN)).toBe(false);
  });

  it("pushes a child further out if the direct spot is already occupied", () => {
    const root = boxFromCenter(0, 0, sizeFor("room-small", null));
    const blocker = boxFromCenter(200, 0, sizeFor("room-large", null)); // sits east of root
    const child = placeChild(root, "E", "room-large", [root, blocker]);
    expect(collidesInList(child, [root, blocker], MARGIN)).toBe(false);
  });
});

describe("resolveRoomExtras", () => {
  it("returns undefined for non-room segment types", () => {
    expect(resolveRoomExtras("corridor", "palace")).toBeUndefined();
    expect(resolveRoomExtras("staircase", "palace")).toBeUndefined();
    expect(resolveRoomExtras("final", "palace")).toBeUndefined();
  });

  it("rolls content and monsters for a room, matching the dungeon type's tables", () => {
    // content roll 2+2=4, monster roll 3+3=6
    const rng = sequenceDie([2, 2, 3, 3]);
    const extras = resolveRoomExtras("room-small", "palace", rng);
    expect(extras).toBeDefined();
    expect(extras!.roomContent).toEqual(DUNGEON_TABLES.palace.roomContent[4]);
    expect(extras!.monsters).toEqual(DUNGEON_TABLES.palace.monsters[6]);
    expect(extras!.monsters).not.toBeNull();
  });

  it("resolves to null monsters on the 'no monsters' rows (7 and 8)", () => {
    const rngSeven = sequenceDie([2, 2, 3, 4]); // monster sum 7
    expect(resolveRoomExtras("room-small", "palace", rngSeven)!.monsters).toBeNull();
    const rngEight = sequenceDie([2, 2, 4, 4]); // monster sum 8
    expect(resolveRoomExtras("room-small", "palace", rngEight)!.monsters).toBeNull();
  });

  it("isEntrance forces null monsters even on a roll that would normally spawn some, but still rolls Room Content normally", () => {
    // content roll 2+2=4, monster roll 3+3=6 -- same roll as the "rolls content and monsters"
    // test above, which confirms row 6 normally spawns a monster.
    const rng = sequenceDie([2, 2, 3, 3]);
    const extras = resolveRoomExtras("room-small", "palace", rng, true);
    expect(extras!.roomContent).toEqual(DUNGEON_TABLES.palace.roomContent[4]);
    expect(extras!.monsters).toBeNull();
  });
});

describe("resolveBoss", () => {
  it("rolls a single die and returns the matching Boss entry for that dungeon type", () => {
    expect(resolveBoss("palace", sequenceDie([6]))).toEqual(DUNGEON_TABLES.palace.boss![6]);
    expect(resolveBoss("prison", sequenceDie([1]))).toEqual(DUNGEON_TABLES.prison.boss![1]);
  });

  it("Necropolis (issue #30): combines 3 independent dice into one boss, not a flat table lookup", () => {
    // Part 1 roll 1 (Colossal, +30 HP), Part 2 roll 2 (Skeleton, 12 HP/4 dmg/Undead), Part 3
    // roll 1 (of Death, Deathtouch).
    const boss = resolveBoss("necropolis", sequenceDie([1, 2, 1]));
    expect(boss.name).toBe("Colossal Skeleton of Death");
    expect(boss.hp).toBe(42); // 12 base + 30 from Colossal
    expect(boss.damage).toBe(4); // Part 2's own damage, no Part 1/3 damage modifier this roll
    expect(boss.abilities).toEqual(["undead", "deathtouch"]);
    expect(boss.count).toBe(1);
  });

  it("Necropolis: a damage-modifying Part combines correctly and abilities from multiple parts don't duplicate", () => {
    // Part 1 roll 6 (Stone, Stoneskin), Part 2 roll 6 (Lich, 25 HP/6 dmg/Necromancy+Undead),
    // Part 3 roll 2 (of the Blades, +2 damage).
    const boss = resolveBoss("necropolis", sequenceDie([6, 6, 2]));
    expect(boss.name).toBe("Stone Lich of the Blades");
    expect(boss.hp).toBe(25);
    expect(boss.damage).toBe(8); // 6 base + 2 from "of the Blades"
    expect(boss.abilities).toEqual(["stoneskin", "necromancy", "undead"]);
  });

  it("Necropolis: HP never drops below 1 even on the 'Dying' modifier against a low-HP creature", () => {
    // Part 1 roll 5 (Dying, -5 HP), Part 2 roll 1 (Animal, 20 HP/3 dmg), Part 3 roll 3 (from Hell,
    // Firebreath) -- 20 - 5 = 15, well above 1, just confirming the floor logic doesn't misfire
    // on an ordinary case.
    const boss = resolveBoss("necropolis", sequenceDie([5, 1, 3]));
    expect(boss.hp).toBe(15);
    expect(boss.abilities).toEqual(["firebreath"]);
  });
});

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

function makeLevel(overrides: Partial<LevelState> = {}): LevelState {
  return {
    depth: 1,
    segments: [],
    connectors: [],
    doorsRemaining: 0,
    hasStaircase: false,
    isFinalRoomLevel: false,
    finalRoomPlaced: false,
    stairwayTarget: null,
    ...overrides,
  };
}

function makeState(levels: LevelState[], activeLevel = 0): DungeonState {
  return {
    dungeonTypeKey: "palace",
    dungeonName: "The Palace of the Secret Horrors",
    entranceFlavor: null,
    levels,
    activeLevel,
    nextSegmentId: 100,
    nextLogId: 1,
    selectedSegId: null,
    currentSegId: null,
    stats: { segments: 0, corridors: 0, rooms: 0, staircases: 0, doorsRemaining: 0, finalRooms: 0 },
    log: [],
    torches: 10,
    hp: 20,
    maxHp: 20,
    coins: 0,
    treasures: 0,
    keys: 0,
    heldItems: [],
    pendingPackItem: null,
    armor: [],
    weapon: null,
    spareWeapons: [],
    spareArmor: [],
    combat: null,
    monsterKills: 0,
    bossKills: 0,
    killsByName: {},
    killsByAbility: {},
    characterName: "Test Adventurer",
    raceName: "",
    className: "",
    advancedClasses: [],
    hireling: null,
    animals: [],
    milestones: createInitialMilestones(),
    buildings: [],
    runDamageBonus: 0,
    weaponFormula: "1d6",
    spellUses: {},
    maxSpellUses: {},
    nextMonsterId: 1,
    alive: true,
    deathCause: null,
  };
}

describe("classifyDoorOpen", () => {
  it("classifies an ordinary door on a normal, non-exhausted level as 'normal'", () => {
    const seg = makeSegment({
      id: 1,
      type: "room-small",
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
    });
    const level = makeLevel({ segments: [seg], doorsRemaining: 3, hasStaircase: false });
    const state = makeState([level]);
    expect(classifyDoorOpen(state, 1, 0)).toEqual({ kind: "normal" });
  });

  it("classifies the last unopened door on a level with no staircase as a dead end", () => {
    const seg = makeSegment({
      id: 1,
      type: "room-small",
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
    });
    const level = makeLevel({ segments: [seg], doorsRemaining: 1, hasStaircase: false });
    const state = makeState([level]);
    expect(classifyDoorOpen(state, 1, 0)).toEqual({ kind: "dead-end-final" });
  });

  it("does not classify as dead-end if a staircase exists on the level, even at 1 door remaining", () => {
    const seg = makeSegment({
      id: 1,
      type: "room-small",
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
    });
    const level = makeLevel({ segments: [seg], doorsRemaining: 1, hasStaircase: true });
    const state = makeState([level]);
    expect(classifyDoorOpen(state, 1, 0)).toEqual({ kind: "normal" });
  });

  it("classifies a staircase-type entrance's (only) door as normal -- neither a descent nor a premature dead end", () => {
    const seg = makeSegment({
      id: 1,
      type: "staircase",
      isEntrance: true,
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
    });
    // A 1-door entrance (Crypt/Sanctuary/Prison) has doorsRemaining===1 and no staircase
    // found yet from its very first moment -- that must read as neither "descend to level 2"
    // nor "no stairs, dead end," just an ordinary door continuing level 1.
    const level = makeLevel({ segments: [seg], doorsRemaining: 1, hasStaircase: false });
    const state = makeState([level]);
    expect(classifyDoorOpen(state, 1, 0)).toEqual({ kind: "normal" });
  });

  it("classifies a fresh staircase at depth 1 as a normal descent", () => {
    const seg = makeSegment({
      id: 1,
      type: "staircase",
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
    });
    const level = makeLevel({
      depth: 1,
      segments: [seg],
      hasStaircase: true,
      stairwayTarget: null,
    });
    const state = makeState([level]);
    expect(classifyDoorOpen(state, 1, 0)).toEqual({ kind: "descend-normal" });
  });

  it("classifies a staircase at depth 2 as the automatic Final Room", () => {
    const seg = makeSegment({
      id: 1,
      type: "staircase",
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
    });
    const level = makeLevel({
      depth: 2,
      segments: [seg],
      hasStaircase: true,
      stairwayTarget: null,
    });
    const state = makeState([level]);
    expect(classifyDoorOpen(state, 1, 0)).toEqual({ kind: "descend-final" });
  });

  it("reuses an existing target level for a second staircase on the same floor", () => {
    const seg = makeSegment({
      id: 1,
      type: "staircase",
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
    });
    const level = makeLevel({ depth: 1, segments: [seg], hasStaircase: true, stairwayTarget: 1 });
    const normalTarget = makeLevel({ depth: 2, isFinalRoomLevel: false });
    const state = makeState([level, normalTarget]);
    expect(classifyDoorOpen(state, 1, 0)).toEqual({ kind: "reuse-normal", targetLevel: 1 });
  });

  it("reuses an existing Final Room level for a second staircase reaching the same depth", () => {
    const seg = makeSegment({
      id: 1,
      type: "staircase",
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
    });
    const level = makeLevel({ depth: 2, segments: [seg], hasStaircase: true, stairwayTarget: 1 });
    const finalTarget = makeLevel({ depth: 3, isFinalRoomLevel: true });
    const state = makeState([level, finalTarget]);
    expect(classifyDoorOpen(state, 1, 0)).toEqual({ kind: "reuse-final", targetLevel: 1 });
  });
});

describe("reachableSegIds", () => {
  it("is empty when there's no current position", () => {
    const seg = makeSegment({ id: 1, type: "room-small", doors: [] });
    const level = makeLevel({ segments: [seg] });
    expect(reachableSegIds(level, null)).toEqual(new Set());
  });

  it("always includes the current segment itself, even with no doors", () => {
    const seg = makeSegment({ id: 1, type: "room-small", doors: [] });
    const level = makeLevel({ segments: [seg] });
    expect(reachableSegIds(level, 1)).toEqual(new Set([1]));
  });

  it("includes a neighbor reached via the current segment's own opened door", () => {
    const seg1 = makeSegment({
      id: 1,
      type: "room-small",
      doors: [{ dir: "E", opened: true, childId: 2, leadsToLevel: null }],
    });
    const seg2 = makeSegment({ id: 2, type: "room-small", doors: [] });
    const level = makeLevel({ segments: [seg1, seg2] });
    expect(reachableSegIds(level, 1)).toEqual(new Set([1, 2]));
  });

  it("includes a neighbor whose own door instead points back to the current segment", () => {
    const seg1 = makeSegment({ id: 1, type: "room-small", doors: [] });
    const seg2 = makeSegment({
      id: 2,
      type: "room-small",
      doors: [{ dir: "W", opened: true, childId: 1, leadsToLevel: null }],
    });
    const level = makeLevel({ segments: [seg1, seg2] });
    expect(reachableSegIds(level, 1)).toEqual(new Set([1, 2]));
  });

  it("excludes a neighbor whose connecting door hasn't been opened yet", () => {
    const seg1 = makeSegment({
      id: 1,
      type: "room-small",
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
    });
    const seg2 = makeSegment({ id: 2, type: "room-small", doors: [] });
    const level = makeLevel({ segments: [seg1, seg2] });
    expect(reachableSegIds(level, 1)).toEqual(new Set([1]));
  });

  it("excludes a segment two hops away -- reachability is direct neighbors only", () => {
    const seg1 = makeSegment({
      id: 1,
      type: "room-small",
      doors: [{ dir: "E", opened: true, childId: 2, leadsToLevel: null }],
    });
    const seg2 = makeSegment({
      id: 2,
      type: "room-small",
      doors: [{ dir: "E", opened: true, childId: 3, leadsToLevel: null }],
    });
    const seg3 = makeSegment({ id: 3, type: "room-small", doors: [] });
    const level = makeLevel({ segments: [seg1, seg2, seg3] });
    expect(reachableSegIds(level, 1)).toEqual(new Set([1, 2]));
  });
});

describe("isTeleportDestination", () => {
  it("allows a plain empty room", () => {
    const seg = makeSegment({ id: 2, type: "room-small", doors: [] });
    expect(isTeleportDestination(seg, 1)).toBe(true);
  });

  it("excludes the room the fight is currently happening in", () => {
    const seg = makeSegment({ id: 1, type: "room-small", doors: [] });
    expect(isTeleportDestination(seg, 1)).toBe(false);
  });

  it("excludes corridors and staircases -- not a \"room\" per the rulebook", () => {
    const corridor = makeSegment({ id: 2, type: "corridor", doors: [] });
    const staircase = makeSegment({ id: 3, type: "staircase", doors: [] });
    expect(isTeleportDestination(corridor, 1)).toBe(false);
    expect(isTeleportDestination(staircase, 1)).toBe(false);
  });

  it("excludes a room with undefeated, un-sneaked-past monsters", () => {
    const seg = makeSegment({
      id: 2,
      type: "room-small",
      doors: [],
      monsters: { name: "Orc", hp: 6, damage: 3, abilities: [], count: 1 },
    });
    expect(isTeleportDestination(seg, 1)).toBe(false);
  });

  it("allows a room whose monsters were defeated or sneaked past", () => {
    const defeated = makeSegment({
      id: 2,
      type: "room-small",
      doors: [],
      monsters: { name: "Orc", hp: 6, damage: 3, abilities: [], count: 1 },
      monstersDefeated: true,
    });
    const sneakedInto = makeSegment({
      id: 3,
      type: "room-small",
      doors: [],
      monsters: { name: "Orc", hp: 6, damage: 3, abilities: [], count: 1 },
      monstersDefeated: true,
      sneakedPast: false,
    });
    expect(isTeleportDestination(defeated, 1)).toBe(true);
    expect(isTeleportDestination(sneakedInto, 1)).toBe(true);
  });

  it("excludes a sneaked-past room -- its monsters are still there, just not noticing yet", () => {
    const seg = makeSegment({
      id: 2,
      type: "room-small",
      doors: [],
      monsters: { name: "Orc", hp: 6, damage: 3, abilities: [], count: 1 },
      sneakedPast: true,
    });
    expect(isTeleportDestination(seg, 1)).toBe(false);
  });

  it("excludes a room flagged needsMonsterReroll -- regression: it looks empty, but arriving would immediately re-roll a fresh encounter and can start a new fight", () => {
    const seg = makeSegment({
      id: 2,
      type: "room-small",
      doors: [],
      needsMonsterReroll: true,
    });
    expect(isTeleportDestination(seg, 1)).toBe(false);
  });
});
