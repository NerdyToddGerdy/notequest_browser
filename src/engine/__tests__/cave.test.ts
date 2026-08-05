import { describe, expect, it } from "vitest";
import { DUNGEON_TABLES, KILLER_OCTOPUS, MAGMA_MONSTER } from "../../data/dungeonTables.ts";
import {
  CAVE_FAMILY,
  DUNGEON_TYPES,
  SEGMENTS_TABLE_BY_TYPE,
  SECRET_PASSAGE_TABLE_BY_TYPE,
  SECRET_PASSAGE_TABLE,
  TYPES_WITHOUT_FINAL_ROOM,
  isHiddenChestResult,
  type DungeonTypeKey,
} from "../../data/dungeonTypes.ts";
import { DUNGEON_TYPE_BY_TERRAIN, LOCATION_FORCED_DUNGEON_TYPE } from "../../data/hexTables.ts";
import { resolveRoomExtras, rollSegment } from "../dungeon.ts";
import { dungeonReducer } from "../dungeonReducer.ts";
import {
  createInitialDungeonState,
  guardianOf,
  isDungeonBeaten,
  makeLevel,
  segmentHasChest,
  type DungeonState,
  type SegmentState,
} from "../dungeonState.ts";
import { handsFree } from "../hands.ts";
import { fixedDie, mulberry32 } from "../../test/mulberry32.ts";

/** Cave and its three sub-variants (issue #138) -- the second family with no Boss and no Final
 * Room, and the first with a *width* axis on its tunnels. */

const CAVE_KEYS = [...CAVE_FAMILY] as DungeonTypeKey[];

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

function caveState(
  level: ReturnType<typeof makeLevel>,
  key: DungeonTypeKey = "cave",
  overrides: Partial<DungeonState> = {},
): DungeonState {
  return {
    ...createInitialDungeonState(),
    dungeonTypeKey: key,
    levels: [level],
    activeLevel: 0,
    nextSegmentId: 100,
    currentSegId: level.segments[0]?.id ?? null,
    ...overrides,
  };
}

describe("the Cave family", () => {
  it("registers all four types, each entered through a single wide tunnel", () => {
    for (const key of CAVE_KEYS) {
      const def = Object.values(DUNGEON_TYPES).find((d) => d.key === key)!;
      expect(def, key).toBeDefined();
      // "Your only way is by following the Wide Tunnel" -- one door, unlike Sewers' 4-way manhole.
      expect(def.entranceType, key).toBe("tunnel");
      expect(def.doors, key).toBe(1);
    }
  });

  it("gives none of them a Boss -- no Final Room either", () => {
    for (const key of CAVE_KEYS) {
      expect(DUNGEON_TABLES[key].boss, key).toBeUndefined();
      expect(TYPES_WITHOUT_FINAL_ROOM.has(key), key).toBe(true);
    }
  });

  it("shares one Segments and Secret Passage table across the whole family", () => {
    for (const key of CAVE_KEYS) {
      expect(SEGMENTS_TABLE_BY_TYPE[key], key).toBe(SEGMENTS_TABLE_BY_TYPE.cave);
      expect(SECRET_PASSAGE_TABLE_BY_TYPE[key], key).toBe(SECRET_PASSAGE_TABLE_BY_TYPE.cave);
    }
  });

  it("has a full Trap (1-6), Room Content (2-12) and Monster (2-12) set", () => {
    for (let r = 1; r <= 6; r++) expect(DUNGEON_TABLES.cave.trap[r], `trap ${r}`).toBeDefined();
    for (let s = 2; s <= 12; s++) {
      expect(DUNGEON_TABLES.cave.roomContent[s], `content ${s}`).toBeDefined();
      // 7 and 8 are "no monsters" -- present as an absent key, like every other type.
      if (s !== 7 && s !== 8) expect(DUNGEON_TABLES.cave.monsters[s], `monster ${s}`).toBeDefined();
    }
  });
});

describe("wide vs. narrow tunnels", () => {
  it("reads the narrow column whichever door was opened -- width is the tunnel's, not the door's", () => {
    for (let roll = 1; roll <= 6; roll++) {
      const forward = rollSegment("tunnel-narrow", roll, "cave", true);
      const side = rollSegment("tunnel-narrow", roll, "cave", false);
      expect(side, `roll ${roll}`).toEqual(forward);
    }
  });

  it("falls back to the wide column for a wide tunnel's side door -- both lead onward", () => {
    for (let roll = 1; roll <= 6; roll++) {
      const forward = rollSegment("tunnel", roll, "cave", true);
      const side = rollSegment("tunnel", roll, "cave", false);
      expect(side, `roll ${roll}`).toEqual(forward);
    }
  });

  it("keeps Sewers' direction axis intact -- forward yields tunnel, a side door yields a room", () => {
    for (let roll = 1; roll <= 6; roll++) {
      expect(rollSegment("tunnel", roll, "sewers", true).type, `forward ${roll}`).toBe("tunnel");
      expect(rollSegment("tunnel", roll, "sewers", false).type, `side ${roll}`).toMatch(/^room-/);
    }
  });

  it("narrows on a 1 and reaches Grottos only from a narrow tunnel", () => {
    expect(rollSegment("tunnel", 1, "cave", true).type).toBe("tunnel-narrow");
    // Rolls 1 and 2 of the narrow column both end in a Grotto (a room).
    expect(rollSegment("tunnel-narrow", 1, "cave", true).type).toMatch(/^room-/);
    expect(rollSegment("tunnel-narrow", 2, "cave", true).type).toMatch(/^room-/);
  });
});

describe("what each segment type rolls for", () => {
  it("gives a wide tunnel Monsters but no Content", () => {
    const extras = resolveRoomExtras("tunnel", "cave", fixedDie(1))!;
    expect(extras.roomContent).toBeUndefined();
    expect(extras.monsters).not.toBeNull();
  });

  it("gives a narrow tunnel nothing at all -- 'Narrow Tunnels have nothing'", () => {
    const extras = resolveRoomExtras("tunnel-narrow", "cave", fixedDie(1))!;
    expect(extras.roomContent).toBeUndefined();
    expect(extras.monsters).toBeNull();
  });

  it("gives a Grotto both, like any room", () => {
    const grotto = resolveRoomExtras("room-medium", "cave", fixedDie(1))!;
    expect(grotto.roomContent).toBeDefined();
    expect(grotto.monsters).not.toBeNull();
  });

  it("consumes identical RNG for all three, so narrowing can't shift the roll sequence", () => {
    const consumed = (type: Parameters<typeof resolveRoomExtras>[0]) => {
      let calls = 0;
      const counting = () => {
        calls += 1;
        return 0.5;
      };
      resolveRoomExtras(type, "cave", counting);
      return calls;
    };
    expect(consumed("tunnel-narrow")).toBe(consumed("tunnel"));
    expect(consumed("tunnel-narrow")).toBe(consumed("room-medium"));
  });
});

describe("leaving a Cave", () => {
  function floodedGrottoState(torches: number) {
    const seg = makeSegment({
      id: 1,
      type: "room-medium",
      doors: [],
      roomContent: DUNGEON_TABLES.cave.roomContent[2],
    });
    const level = makeLevel(0);
    level.segments = [seg];
    return caveState(level, "cave", { torches });
  }

  it("is Room Content 2, and it costs a torch", () => {
    const row = DUNGEON_TABLES.cave.roomContent[2]!;
    expect(row.isExit).toBe(true);
    expect(row.exitTorchCost).toBe(1);
  });

  it("finishes the run without any Final Room", () => {
    const state = floodedGrottoState(3);
    const after = dungeonReducer(state, { type: "CLIMB_OUT", segId: 1 }, mulberry32(1));
    expect(after.exitUsed).toBe(true);
    expect(after.torches).toBe(2);
    expect(isDungeonBeaten(after)).toBe(true);
  });

  it("refuses rather than killing you in the act of escaping", () => {
    const state = floodedGrottoState(0);
    const after = dungeonReducer(state, { type: "CLIMB_OUT", segId: 1 }, mulberry32(1));
    expect(after.exitUsed).toBeFalsy();
    expect(isDungeonBeaten(after)).toBe(false);
    expect(after.alive).toBe(true);
  });

  it("does not set clearedASewer -- a Cave is not a Sewer", () => {
    const after = dungeonReducer(
      floodedGrottoState(3),
      { type: "CLIMB_OUT", segId: 1 },
      mulberry32(1),
    );
    expect(after.milestones.clearedASewer).toBe(false);
  });
});

describe("the Underwater and Volcanic Cave guardians", () => {
  it("replaces the whole 9-12 band, leaving the shared rows alone", () => {
    for (const total of [9, 10, 11, 12]) {
      expect(DUNGEON_TABLES.underwaterCave.monsters[total]?.name, `${total}`).toBe(
        KILLER_OCTOPUS.name,
      );
      expect(DUNGEON_TABLES.volcanicCave.monsters[total]?.name, `${total}`).toBe(
        MAGMA_MONSTER.name,
      );
    }
    for (const total of [2, 3, 4, 5, 6]) {
      expect(DUNGEON_TABLES.underwaterCave.monsters[total], `${total}`).toEqual(
        DUNGEON_TABLES.cave.monsters[total],
      );
    }
  });

  it("names the right guardian per type, and none for a plain Cave or Mine", () => {
    expect(guardianOf("underwaterCave")).toBe(KILLER_OCTOPUS.name);
    expect(guardianOf("volcanicCave")).toBe(MAGMA_MONSTER.name);
    expect(guardianOf("cave")).toBeNull();
    expect(guardianOf("mine")).toBeNull();
    expect(guardianOf(null)).toBeNull();
  });

  it("leaves a Chest behind when the guardian falls", () => {
    const seg = makeSegment({ id: 1, type: "room-medium", doors: [] });
    const level = makeLevel(0);
    level.segments = [seg];
    // A guardian with 1 HP, so a single hit ends the fight and reaches finishIfVictorious().
    const state: DungeonState = {
      ...caveState(level, "underwaterCave"),
      combat: {
        segId: 1,
        monsters: [
          {
            id: 1,
            name: KILLER_OCTOPUS.name,
            hp: 1,
            maxHp: 1,
            damage: 0,
            abilities: [],
            bonusDamage: 0,
            deathtouchPending: false,
            paralyzePending: 0,
            skipNextAttack: false,
            silencedTurns: 0,
          },
        ],
        outcome: "ongoing",
        paralyzedTurns: 0,
        pendingDamage: null,
        playerDamageBonus: 0,
        engulfableBodies: 0,
        damageReduction: 0,
        shields: [],
        absorbSoulActive: false,
        fireOfTheDeadActive: false,
        hireling: null,
        hirelingAttackedThisRound: false,
        animalAttackedThisRound: false,
        guardianChest: true,
        isBoss: false,
        pendingLootRolls: 0,
      },
    };
    const after = dungeonReducer(
      state,
      { type: "PLAYER_ATTACK", targetId: 1, roll: 6 },
      mulberry32(7),
    );
    const segAfter = after.levels[0]!.segments[0]!;
    expect(segAfter.monstersDefeated).toBe(true);
    expect(segAfter.guardianChest).toBe(true);
    expect(segmentHasChest(segAfter)).toBe(true);
  });
});

describe("Cave's own reward rows", () => {
  it("still calls its buried Chest a chest -- the wording differs from every other table", () => {
    const table = SECRET_PASSAGE_TABLE_BY_TYPE.cave!;
    expect(table[3]).toContain("buried Chest");
    expect(isHiddenChestResult(table[3])).toBe(true);
    expect(isHiddenChestResult(table[4])).toBe(true);
    // ...and the rows that grant nothing still don't.
    expect(isHiddenChestResult(table[2])).toBe(false);
    expect(isHiddenChestResult(SECRET_PASSAGE_TABLE[2])).toBe(false);
  });

  it("never mentions a chest in a Secret Passage row without granting one", () => {
    // `isHiddenChestResult()` matches the bare noun, which is only safe while this holds.
    const tables = [SECRET_PASSAGE_TABLE, ...Object.values(SECRET_PASSAGE_TABLE_BY_TYPE)];
    for (const table of tables) {
      for (const text of Object.values(table)) {
        if (/\bchests?\b/i.test(text)) {
          expect(isHiddenChestResult(text), text).toBe(true);
        }
      }
    }
  });

  it("makes the Magic Wood Puppet hold the torch, exactly like a Torchbearer", () => {
    const puppet = DUNGEON_TABLES.cave.magicItem[3]!;
    expect(puppet.effect.kind).toBe("freesHands");
    const bearer = {
      heldItems: [],
      hireling: null,
      weapon: null,
      spareWeapons: [],
      armor: [{ piece: "wonderItem" as const, hp: 0, maxHp: 0, effect: puppet.effect }],
    };
    expect(handsFree(bearer)).toBe(true);
    // ...but a lost arm still vetoes it -- no light source gives an arm back.
    expect(handsFree({ ...bearer, armLost: true })).toBe(false);
  });
});

describe("where a Cave can be found", () => {
  it("is reachable from real terrain rather than substituted", () => {
    expect(Object.values(DUNGEON_TYPE_BY_TERRAIN.mountain)).toContain(13); // Cave
    expect(Object.values(DUNGEON_TYPE_BY_TERRAIN.mountain)).toContain(14); // Mine
    expect(Object.values(DUNGEON_TYPE_BY_TERRAIN.forest)).toContain(13);
  });

  it("gives a Reef and a Volcano their own named type instead of a roll", () => {
    expect(LOCATION_FORCED_DUNGEON_TYPE.reef).toBe(15);
    expect(LOCATION_FORCED_DUNGEON_TYPE.volcano).toBe(16);
    expect(DUNGEON_TYPES[15]!.key).toBe("underwaterCave");
    expect(DUNGEON_TYPES[16]!.key).toBe("volcanicCave");
  });
});
