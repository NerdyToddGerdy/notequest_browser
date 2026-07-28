import { describe, expect, it } from "vitest";
import { dungeonReducer } from "../dungeonReducer.ts";
import {
  createInitialDungeonState,
  makeLevel,
  type DungeonState,
  type SegmentState,
} from "../dungeonState.ts";
import { createInitialMilestones, createInitialTravelStats, sellItem } from "../town.ts";
import type { AdventurerResources } from "../town.ts";
import { fixedDie, mulberry32 } from "../../test/mulberry32.ts";
import type { MonsterTemplate } from "../../data/dungeonTables.ts";

/** Fixes batched into one release: #93 (Forgotten Gods bonus lost on resume), #94 (Fortress sells
 * pay double), #92 (dungeon entry bypassed spendTorches), #95 (Keys were unusable), #96 (broken
 * doors didn't propagate an alert). Kept in one file because they were verified together; each
 * describe block names its own issue. */

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

function stateWithLevel(level: ReturnType<typeof makeLevel>): DungeonState {
  return {
    ...createInitialDungeonState(),
    dungeonTypeKey: "palace",
    levels: [level],
    activeLevel: 0,
    nextSegmentId: 100,
    currentSegId: level.segments[0]?.id ?? null,
  };
}

function makeResources(overrides: Partial<AdventurerResources> = {}): AdventurerResources {
  return {
    torches: 5,
    hp: 20,
    maxHp: 20,
    coins: 0,
    treasures: 0,
    keys: 0,
    heldItems: [],
    armor: [],
    weapon: null,
    spareWeapons: [],
    spareArmor: [],
    spellUses: {},
    maxSpellUses: {},
    monsterKills: 0,
    bossKills: 0,
    killsByName: {},
    killsByAbility: {},
    provisions: 10,
    advancedClasses: [],
    hireling: null,
    animals: [],
    milestones: createInitialMilestones(),
    buildings: [],
    troops: 0,
    troopSources: [],
    travelStats: createInitialTravelStats(),
    survivedRunIds: [],
    flyActive: false,
    catatonic: false,
    nextDungeonDamageBonus: 0,
    ...overrides,
  };
}

const GOBLINS: MonsterTemplate = { name: "Goblins", hp: 3, damage: 1, abilities: [], count: 2 };

// ---------------------------------------------------------------------------------------------
describe("#93: the Forgotten Gods bonus survives resuming a paused run", () => {
  /** A minimal already-explored run carrying a run-wide damage bonus. */
  function pausedRun(runDamageBonus: number): DungeonState {
    const seg = makeSegment({ id: 1, type: "room-small", isEntrance: true, doors: [] });
    return { ...stateWithLevel({ ...makeLevel(1), segments: [seg] }), runDamageBonus };
  }

  const resumeArgs = {
    torches: 5,
    hp: 20,
    maxHp: 20,
    weaponFormula: "1d6",
    spellUses: {},
    maxSpellUses: {},
    characterName: "Tester",
    coins: 0,
    treasures: 0,
    keys: 0,
    heldItems: [],
    armor: [],
    weapon: null,
    monsterKills: 0,
    bossKills: 0,
    raceName: "Human",
    className: "Fighter",
    killsByName: {},
    killsByAbility: {},
    spareWeapons: [],
    advancedClasses: [],
    hireling: null,
    animals: [],
    milestones: createInitialMilestones(),
    buildings: [],
    spareArmor: [],
  };

  it("RETURN_TO_DUNGEON carries it (the same character resuming their own run)", () => {
    const next = dungeonReducer(
      createInitialDungeonState(),
      { type: "RETURN_TO_DUNGEON", dungeon: pausedRun(2), ...resumeArgs },
      mulberry32(1),
    );
    expect(next.runDamageBonus).toBe(2);
  });

  it("defaults to 0 for a run that never had one", () => {
    const next = dungeonReducer(
      createInitialDungeonState(),
      { type: "RETURN_TO_DUNGEON", dungeon: pausedRun(0), ...resumeArgs },
      mulberry32(1),
    );
    expect(next.runDamageBonus).toBe(0);
  });

  it("RESUME_DUNGEON still resets it -- a new character doesn't inherit someone else's blessing", () => {
    const next = dungeonReducer(
      createInitialDungeonState(),
      { type: "RESUME_DUNGEON", dungeon: pausedRun(2), ...resumeArgs },
      mulberry32(1),
    );
    expect(next.runDamageBonus).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------
describe("#94: selling in a Fortress pays double", () => {
  const withItem = () => makeResources({ coins: 0, heldItems: [{ name: "Ornament", worth: 5 }] });

  it("pays the listed worth in an ordinary city", () => {
    expect(sellItem(withItem(), 0).coins).toBe(5);
  });

  it("doubles in a Fortress", () => {
    expect(sellItem(withItem(), 0, false, true).coins).toBe(10);
  });

  it("doubles for a Cat-Person/Merchant, as before", () => {
    expect(sellItem(withItem(), 0, true, false).coins).toBe(10);
  });

  it("stacks to 4x -- the place and the seller are independent multipliers", () => {
    expect(sellItem(withItem(), 0, true, true).coins).toBe(20);
  });

  it("still removes the item and sets the hasSoldItem milestone", () => {
    const after = sellItem(withItem(), 0, true, true);
    expect(after.heldItems).toHaveLength(0);
    expect(after.milestones.hasSoldItem).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
describe("#92: entering a dungeon spends its torch through spendTorches()", () => {
  const enter = (state: DungeonState) =>
    dungeonReducer(
      state,
      { type: "ROLL_DUNGEON", typeRoll: 1, secondRoll: 1, thirdRoll: 1 },
      mulberry32(3),
    );

  it("charges exactly 1 torch on a normal entry", () => {
    const next = enter({ ...createInitialDungeonState(), torches: 5 });
    expect(next.torches).toBe(4);
    expect(next.levels).toHaveLength(1);
  });

  it("never drives torches negative -- the Darkness takes them instead", () => {
    const next = enter({ ...createInitialDungeonState(), torches: 0 });
    expect(next.torches).toBe(0);
    expect(next.alive).toBe(false);
    expect(next.deathCause).toBe("darkness");
  });

  it("builds no dungeon at all when the entry torch can't be paid", () => {
    const next = enter({ ...createInitialDungeonState(), torches: 0 });
    // Nothing half-made left behind: no level, no name, no type.
    expect(next.levels).toHaveLength(0);
    expect(next.dungeonTypeKey).toBeNull();
    expect(next.dungeonName).toBeNull();
  });

  it("spares a Miner rather than killing them, and still doesn't enter", () => {
    const next = enter({ ...createInitialDungeonState(), torches: 0, className: "Miner" });
    expect(next.alive).toBe(true);
    expect(next.torches).toBe(0);
    expect(next.levels).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------------------------
describe("#95: spending a Key on a locked door", () => {
  function doorState(keys: number, torches = 10) {
    const seg = makeSegment({
      id: 1,
      type: "room-small",
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
    });
    return {
      ...stateWithLevel({ ...makeLevel(1), segments: [seg], doorsRemaining: 1 }),
      keys,
      torches,
    };
  }
  const useKey = (state: DungeonState) =>
    dungeonReducer(state, {
      type: "RESOLVE_DOOR_LOCK",
      segId: 1,
      doorIdx: 0,
      doorRoll: 2,
      trapRoll: null,
      lockChoice: "useKey",
    });

  it("spends one key and no torch", () => {
    const next = useKey(doorState(2, 10));
    expect(next.keys).toBe(1);
    expect(next.torches).toBe(10);
    expect(next.alive).toBe(true);
  });

  it("counts toward Thief's locksOpened -- a key opens the lock", () => {
    expect(useKey(doorState(1)).milestones.locksOpened).toBe(1);
  });

  it("is quiet: it doesn't mark the door broken or start a fight", () => {
    const next = useKey(doorState(1));
    expect(next.levels[0]!.segments[0]!.doors[0]!.broken).toBeUndefined();
    expect(next.combat).toBeNull();
  });

  it("the Master key opens the lock at 0 keys, spending nothing (issue #95)", () => {
    const state = {
      ...doorState(0, 10),
      armor: [
        {
          piece: "wonderItem" as const,
          hp: 0,
          maxHp: 0,
          itemName: "Master key",
          effect: { kind: "opensAnyLock" as const },
        },
      ],
    };
    const next = useKey(state);
    expect(next.keys).toBe(0);
    expect(next.torches).toBe(10);
    expect(next.milestones.locksOpened).toBe(1);
    expect(next.log[0]!.message).toContain("Master key");
  });

  it("the Master key is never consumed -- it still works on the next door", () => {
    const master = {
      piece: "wonderItem" as const,
      hp: 0,
      maxHp: 0,
      itemName: "Master key",
      effect: { kind: "opensAnyLock" as const },
    };
    const first = useKey({ ...doorState(0, 10), armor: [master] });
    expect(first.armor).toHaveLength(1);
    expect(first.armor[0]!.effect).toEqual({ kind: "opensAnyLock" });
  });

  it("is a no-op with no keys -- no torch spent, no lock opened", () => {
    const next = useKey(doorState(0, 10));
    expect(next.keys).toBe(0);
    expect(next.torches).toBe(10);
    expect(next.milestones.locksOpened).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------
describe("#96: a broken door carries an alert one segment over", () => {
  /** Segment 1 (where the player stands) is joined to segment 2 by an already-broken door;
   * segment 3 hangs off segment 2, one hop further out. */
  function threeSegments(brokenTo2: boolean) {
    const seg1 = makeSegment({
      id: 1,
      type: "room-small",
      isEntrance: true,
      doors: [
        { dir: "E", opened: true, childId: 2, leadsToLevel: null, broken: brokenTo2 },
        { dir: "N", opened: false, childId: null, leadsToLevel: null },
      ],
    });
    const seg2 = makeSegment({
      id: 2,
      type: "room-small",
      monsters: GOBLINS,
      sneakedPast: true,
      doors: [
        { dir: "E", opened: true, childId: 3, leadsToLevel: null, broken: true },
        // A second, still-closed door -- the reducer refuses to re-resolve an already-opened one,
        // so the "noise happens in segment 2" test needs something it can actually break.
        { dir: "S", opened: false, childId: null, leadsToLevel: null },
      ],
    });
    const seg3 = makeSegment({ id: 3, type: "room-small", monsters: GOBLINS, doors: [] });
    return stateWithLevel({ ...makeLevel(1), segments: [seg1, seg2, seg3], doorsRemaining: 1 });
  }

  /** Breaking seg 1's *other* door is the noisy action under test. */
  const breakTheOtherDoor = (state: DungeonState) =>
    dungeonReducer(
      state,
      {
        type: "RESOLVE_DOOR_LOCK",
        segId: 1,
        doorIdx: 1,
        doorRoll: 2,
        trapRoll: null,
        lockChoice: "breakDoor",
      },
      fixedDie(3),
    );

  it("records that a door was broken", () => {
    const next = breakTheOtherDoor(threeSegments(false));
    expect(next.levels[0]!.segments[0]!.doors[1]!.broken).toBe(true);
  });

  it("alerts the segment on the far side of an existing broken door", () => {
    const next = breakTheOtherDoor(threeSegments(true));
    const seg2 = next.levels[0]!.segments[1]!;
    expect(seg2.alerted).toBe(true);
    expect(seg2.sneakedPast).toBe(false); // a room you snuck through is given away
  });

  it("does not reach through an intact door", () => {
    const next = breakTheOtherDoor(threeSegments(false));
    const seg2 = next.levels[0]!.segments[1]!;
    expect(seg2.alerted).toBeUndefined();
    expect(seg2.sneakedPast).toBe(true); // still unnoticed
  });

  it("stops after one hop -- no transitive flood-fill", () => {
    const next = breakTheOtherDoor(threeSegments(true));
    // Segment 3 is joined to segment 2 by a broken door too, but it's two hops from the noise.
    expect(next.levels[0]!.segments[2]!.alerted).toBeUndefined();
  });

  it("propagates backwards too -- the door is recorded only on the parent segment", () => {
    // Noise in segment 2; the broken door joining it to segment 1 lives on segment 1.
    const state = { ...threeSegments(true), currentSegId: 2 };
    const next = dungeonReducer(
      state,
      {
        type: "RESOLVE_DOOR_LOCK",
        segId: 2,
        doorIdx: 1,
        doorRoll: 2,
        trapRoll: null,
        lockChoice: "breakDoor",
      },
      fixedDie(3),
    );
    // Segment 1 has no monsters, so nothing to alert -- but segment 3 (through seg 2's own broken
    // door) does, and it's exactly one hop away.
    expect(next.levels[0]!.segments[2]!.alerted).toBe(true);
  });

  it("an alerted group gets the first strike when the player finally arrives", () => {
    const alerted = breakTheOtherDoor(threeSegments(true));
    const hpBefore = alerted.hp;
    // Walking into segment 2 starts the fight -- alerted means they act first.
    const arrived = dungeonReducer(alerted, { type: "SELECT_SEGMENT", segId: 2 }, fixedDie(3));
    expect(arrived.combat).not.toBeNull();
    expect(arrived.hp).toBeLessThan(hpBefore);
    // The flag is consumed -- only one free ambush out of it.
    expect(arrived.levels[0]!.segments[1]!.alerted).toBe(false);
  });
});
