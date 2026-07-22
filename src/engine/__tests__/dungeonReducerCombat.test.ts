import { describe, expect, it } from "vitest";
import { dungeonReducer } from "../dungeonReducer.ts";
import {
  createInitialDungeonState,
  makeLevel,
  type CombatMonsterState,
  type CombatState,
  type DungeonState,
  type SegmentState,
} from "../dungeonState.ts";
import { fixedDie, sequenceDie } from "../../test/mulberry32.ts";

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

function makeMonster(overrides: Partial<CombatMonsterState> = {}): CombatMonsterState {
  return {
    id: 5,
    name: "Orc",
    hp: 6,
    maxHp: 6,
    damage: 3,
    abilities: [],
    bonusDamage: 0,
    deathtouchPending: false,
    paralyzePending: 0,
    skipNextAttack: false,
    ...overrides,
  };
}

/** A state with combat already underway in a lone room on level 1. */
function stateWithCombat(
  overrides: Partial<DungeonState> = {},
  monsters: CombatMonsterState[] = [makeMonster()],
): DungeonState {
  const room = makeSegment({ id: 1, type: "room-small", doors: [] });
  const level = { ...makeLevel(1), segments: [room] };
  const combat: CombatState = {
    segId: 1,
    monsters,
    paralyzedTurns: 0,
    pendingLootRolls: 0,
    isBoss: false,
    outcome: "ongoing",
    pendingDamage: null,
    playerDamageBonus: 0,
    engulfableBodies: 0,
  };
  return {
    ...createInitialDungeonState(),
    dungeonTypeKey: "palace",
    levels: [level],
    combat,
    ...overrides,
  };
}

describe("combat auto-start on OPEN_DOOR", () => {
  function twoDoorEntranceState(): DungeonState {
    const entrance = makeSegment({
      id: 1,
      type: "corridor",
      doors: [
        { dir: "E", opened: false, childId: null, leadsToLevel: null },
        { dir: "N", opened: false, childId: null, leadsToLevel: null },
      ],
    });
    const level = { ...makeLevel(1), segments: [entrance], doorsRemaining: 2 };
    return {
      ...createInitialDungeonState(),
      dungeonTypeKey: "palace",
      levels: [level],
      nextSegmentId: 100,
      currentSegId: entrance.id,
    };
  }

  it("a quiet door with monsters waits for RESOLVE_ROOM_ENTRY instead of starting combat immediately", () => {
    // content sum 2 ([1,1]), monster sum 4 -> a single Orc (palace table)
    const rng = sequenceDie([1, 1, 2, 2]);
    const next = dungeonReducer(
      twoDoorEntranceState(),
      { type: "OPEN_DOOR", segId: 1, doorIdx: 0, roll: 2, wasNoisy: false },
      rng,
    );
    expect(next.combat).toBeNull();
    const revealedSeg = next.levels[0]!.segments.find((s) => s.id !== 1)!;
    expect(next.currentSegId).toBe(revealedSeg.id);
    expect(revealedSeg.monsters).toMatchObject({ name: "Orc", hp: 6, damage: 3 });
    expect(revealedSeg.monstersDefeated).toBeFalsy();
    expect(revealedSeg.sneakedPast).toBeFalsy();
    expect(next.hp).toBe(next.maxHp);

    // Choosing "Attack First" still gets the player the first attack, same as before this action existed.
    const afterChoice = dungeonReducer(next, {
      type: "RESOLVE_ROOM_ENTRY",
      segId: revealedSeg.id,
      choice: "attack",
    });
    expect(afterChoice.combat).not.toBeNull();
    expect(afterChoice.combat!.monsters).toHaveLength(1);
    expect(afterChoice.combat!.monsters[0]).toMatchObject({
      name: "Orc",
      hp: 6,
      maxHp: 6,
      damage: 3,
    });
    expect(afterChoice.hp).toBe(afterChoice.maxHp);
  });

  it("lets the monsters strike first when the door was noisy", () => {
    const rng = sequenceDie([1, 1, 2, 2]);
    const next = dungeonReducer(
      twoDoorEntranceState(),
      { type: "OPEN_DOOR", segId: 1, doorIdx: 0, roll: 2, wasNoisy: true },
      rng,
    );
    expect(next.combat).not.toBeNull();
    expect(next.hp).toBe(next.maxHp - 3); // the Orc's free attack (damage 3) already landed
    expect(next.log.some((entry) => entry.message.includes("noise gave you away"))).toBe(true);
  });

  it("a room with no monsters (rows 7/8) never starts combat", () => {
    // content sum 2 ([1,1]), monster sum 7 -> no monsters
    const rng = sequenceDie([1, 1, 2, 5]);
    const next = dungeonReducer(
      twoDoorEntranceState(),
      { type: "OPEN_DOOR", segId: 1, doorIdx: 0, roll: 2, wasNoisy: false },
      rng,
    );
    expect(next.combat).toBeNull();
  });
});

describe("a room-type dungeon entrance never rolls Monsters (#43)", () => {
  it("Palace's entrance (room-large) has no monsters and never triggers RESOLVE_ROOM_ENTRY, even on a roll that would normally spawn one", () => {
    const rng = sequenceDie([1, 1, 2, 2]); // content sum 2, monster sum 4 -> a single Orc on a non-entrance room
    const next = dungeonReducer(
      createInitialDungeonState(),
      { type: "ROLL_DUNGEON", typeRoll: 1, secondRoll: 1, thirdRoll: 1 },
      rng,
    );
    expect(next.combat).toBeNull();
    const entranceSeg = next.levels[0]!.segments[0]!;
    expect(entranceSeg.type).toBe("room-large");
    expect(entranceSeg.monsters).toBeUndefined();

    // Confirms the whole "waits for Attack First/Move Silently" flow never engages for the
    // entrance: RESOLVE_ROOM_ENTRY is a no-op with nothing to resolve.
    const afterChoice = dungeonReducer(next, {
      type: "RESOLVE_ROOM_ENTRY",
      segId: entranceSeg.id,
      choice: "attack",
    });
    expect(afterChoice.combat).toBeNull();
  });
});

describe("RESOLVE_ROOM_ENTRY: Move Silently", () => {
  function statePendingRoomEntry(overrides: Partial<DungeonState> = {}): DungeonState {
    const room = makeSegment({
      id: 1,
      type: "room-small",
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
      monsters: { name: "Orc", hp: 6, damage: 3, abilities: [], count: 1 },
    });
    const level = { ...makeLevel(1), segments: [room] };
    return {
      ...createInitialDungeonState(),
      dungeonTypeKey: "palace",
      levels: [level],
      currentSegId: 1,
      ...overrides,
    };
  }

  it("succeeds silently, skipping combat, when no monster rolls a 1", () => {
    const next = dungeonReducer(
      statePendingRoomEntry(),
      { type: "RESOLVE_ROOM_ENTRY", segId: 1, choice: "moveSilently" },
      sequenceDie([4]),
    );
    expect(next.combat).toBeNull();
    expect(next.torches).toBe(9);
    const seg = next.levels[0]!.segments[0]!;
    expect(seg.sneakedPast).toBe(true);
    expect(seg.monstersDefeated).toBeFalsy();
  });

  it("gets detected and lets the monsters attack first when a monster rolls a 1", () => {
    const next = dungeonReducer(
      statePendingRoomEntry(),
      { type: "RESOLVE_ROOM_ENTRY", segId: 1, choice: "moveSilently" },
      sequenceDie([1]),
    );
    expect(next.torches).toBe(9);
    expect(next.combat).not.toBeNull();
    expect(next.combat!.monsters[0]).toMatchObject({ name: "Orc" });
    const seg = next.levels[0]!.segments[0]!;
    expect(seg.sneakedPast).toBeFalsy();
    expect(next.log.some((entry) => entry.message.includes("spotted"))).toBe(true);
  });

  it("Halfling keeps the higher of two dice per monster, avoiding detection a plain roll would suffer", () => {
    const next = dungeonReducer(
      statePendingRoomEntry({ raceName: "Halfling" }),
      { type: "RESOLVE_ROOM_ENTRY", segId: 1, choice: "moveSilently" },
      sequenceDie([1, 6]), // discards the 1, keeps the 6 -> undetected
    );
    expect(next.combat).toBeNull();
    expect(next.levels[0]!.segments[0]!.sneakedPast).toBe(true);
  });

  it("Dog (issue #26): blocks Move Silently entirely, leaving the state untouched", () => {
    const pending = statePendingRoomEntry({ animals: ["Dog"] });
    const next = dungeonReducer(
      pending,
      { type: "RESOLVE_ROOM_ENTRY", segId: 1, choice: "moveSilently" },
      sequenceDie([4]), // would otherwise succeed silently
    );
    expect(next).toBe(pending); // no torch spent, no roll resolved, no combat started
  });

  it("blocks other dungeon actions until the player chooses Attack First or Move Silently", () => {
    const pending = statePendingRoomEntry();
    expect(
      dungeonReducer(pending, { type: "ROLL_SECRET_PASSAGE", segId: 1, roll: 6, trapRoll: null }),
    ).toBe(pending);
    expect(dungeonReducer(pending, { type: "SWITCH_LEVEL", levelIndex: 0 })).toBe(pending);
  });

  it("waking a sneaked-past room: breaking a door there afterward alerts its monsters", () => {
    const sneaked = dungeonReducer(
      statePendingRoomEntry(),
      { type: "RESOLVE_ROOM_ENTRY", segId: 1, choice: "moveSilently" },
      sequenceDie([4]),
    );
    expect(sneaked.levels[0]!.segments[0]!.sneakedPast).toBe(true);

    const afterBreak = dungeonReducer(sneaked, {
      type: "RESOLVE_DOOR_LOCK",
      segId: 1,
      doorIdx: 0,
      doorRoll: 2, // "locked"
      trapRoll: null,
      lockChoice: "breakDoor",
    });
    expect(afterBreak.levels[0]!.segments[0]!.sneakedPast).toBe(false);
    expect(afterBreak.combat).not.toBeNull();
    expect(afterBreak.log.some((entry) => entry.message.includes("noise gives you away"))).toBe(
      true,
    );
  });
});

describe("PLAYER_ATTACK", () => {
  it("defeats a monster in one hit, awards loot, marks the room cleared, and closes combat", () => {
    const monster = makeMonster({ hp: 3, abilities: ["loot"] });
    const state = stateWithCombat({}, [monster]);
    const rng = sequenceDie([4]); // only consumed by the post-victory Loot roll -> a coin
    const next = dungeonReducer(
      state,
      { type: "PLAYER_ATTACK", targetId: monster.id, roll: 6 },
      rng,
    );

    expect(next.combat).toBeNull();
    expect(next.coins).toBe(1);
    expect(next.levels[0]!.segments[0]!.monstersDefeated).toBe(true);
    expect(next.monsterKills).toBe(1);
    expect(next.bossKills).toBe(0);
    expect(next.killsByName).toEqual({ orc: 1 }); // makeMonster()'s default name, lowercased
    expect(next.killsByAbility).toEqual({ loot: 1 });
  });

  it("tallies kills by name (lowercased) and by every ability the monster has", () => {
    const monster = makeMonster({ name: "Vampire", hp: 3, abilities: ["undead", "poison"] });
    const state = stateWithCombat({}, [monster]);
    const next = dungeonReducer(
      state,
      { type: "PLAYER_ATTACK", targetId: monster.id, roll: 6 },
      fixedDie(3),
    ); // fails the Undead revival roll

    expect(next.killsByName).toEqual({ vampire: 1 });
    expect(next.killsByAbility).toEqual({ undead: 1, poison: 1 });
  });

  it("accumulates across multiple kills of the same name/ability", () => {
    const first = makeMonster({ id: 1, name: "Imp", hp: 1, abilities: [] });
    const second = makeMonster({ id: 2, name: "Imp", hp: 1, abilities: [] });
    const state = stateWithCombat({}, [first, second]);
    const afterFirst = dungeonReducer(state, {
      type: "PLAYER_ATTACK",
      targetId: first.id,
      roll: 6,
    });
    const afterSecond = dungeonReducer(afterFirst, {
      type: "PLAYER_ATTACK",
      targetId: second.id,
      roll: 6,
    });

    expect(afterSecond.killsByName).toEqual({ imp: 2 });
  });

  it("doesn't tally a revived Undead monster as a kill yet", () => {
    const monster = makeMonster({ name: "Skeleton", hp: 2, abilities: ["undead"] });
    const state = stateWithCombat({}, [monster]);
    const next = dungeonReducer(
      state,
      { type: "PLAYER_ATTACK", targetId: monster.id, roll: 6 },
      fixedDie(1),
    ); // revival roll succeeds

    expect(next.killsByName).toEqual({});
    expect(next.killsByAbility).toEqual({});
  });

  it("a Boss kill grants a flat 2d6 Treasures instead of the normal Loot table, even with pendingLootRolls queued", () => {
    const boss = makeMonster({ hp: 3, abilities: [] });
    const state = stateWithCombat({}, [boss]);
    state.combat!.isBoss = true;
    state.combat!.pendingLootRolls = 1; // should be ignored entirely for a Boss kill
    const rng = sequenceDie([4, 5]); // 2d6 Treasures roll -> 9 (never touches rollLoot)
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: boss.id, roll: 6 }, rng);

    expect(next.combat).toBeNull();
    expect(next.coins).toBe(0); // Boss reward isn't coins
    expect(next.treasures).toBe(9);
    expect(next.log.some((entry) => entry.message.includes("9 Treasures"))).toBe(true);
    expect(next.log.some((entry) => entry.message.includes("conquered the dungeon"))).toBe(true);
    expect(next.monsterKills).toBe(1);
    expect(next.bossKills).toBe(1);
  });

  it("Loot's Treasures and Keys are credited to state, not just logged", () => {
    const monster = makeMonster({ hp: 3, abilities: ["loot"] });
    const state = stateWithCombat({}, [monster]);
    const rng = sequenceDie([6]); // Loot roll of 6 -> a Treasure
    const next = dungeonReducer(
      state,
      { type: "PLAYER_ATTACK", targetId: monster.id, roll: 6 },
      rng,
    );

    expect(next.treasures).toBe(1);
    expect(next.keys).toBe(0);
    expect(next.coins).toBe(0);
  });

  it("lets monsters counter-attack in the same round when the fight continues", () => {
    const monster = makeMonster({ hp: 10, damage: 4 });
    const state = stateWithCombat({}, [monster]);
    const rng = () => {
      throw new Error("no rng call expected for a plain, surviving, non-ability monster");
    };
    const next = dungeonReducer(
      state,
      { type: "PLAYER_ATTACK", targetId: monster.id, roll: 3 },
      rng,
    );

    expect(next.combat!.monsters[0]!.hp).toBe(7); // took 3 damage, still alive
    expect(next.hp).toBe(next.maxHp - 4); // the Orc's counter-attack landed
  });

  it("marks the player dead when a monster counter-attack drops HP to zero", () => {
    const monster = makeMonster({ hp: 10, damage: 4 });
    const state = stateWithCombat({ hp: 3 }, [monster]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 3 });

    expect(next.alive).toBe(false);
    expect(next.deathCause).toBe("combat");
    expect(next.combat).toBeNull(); // no fight lingers behind the death panel
  });

  it("kills the player outright on a pending Deathtouch, bypassing armor entirely", () => {
    const monster = makeMonster({ hp: 10, damage: 0, deathtouchPending: true });
    const state = stateWithCombat({ hp: 5, armor: [{ piece: "breastplate", hp: 10, maxHp: 10 }] }, [
      monster,
    ]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 3 });

    expect(next.alive).toBe(false);
    expect(next.deathCause).toBe("combat");
    expect(next.hp).toBe(0);
    expect(next.combat).toBeNull();
  });

  it("leaves the dying character's coins/Treasures/Keys behind in the fight's segment", () => {
    const monster = makeMonster({ hp: 10, damage: 4 });
    const state = stateWithCombat(
      { hp: 3, coins: 7, treasures: 1, keys: 2, characterName: "Doomed Dara" },
      [monster],
    );
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 3 });

    expect(next.alive).toBe(false);
    expect(next.levels[0]!.segments[0]!.remains).toEqual({
      names: ["Doomed Dara"],
      coins: 7,
      treasures: 1,
      keys: 2,
      heldItems: [],
      armor: [],
      weapon: null,
      weapons: [],
    });
  });

  it("Explosive kills its owner instantly and damages the player, bypassing normal damage math", () => {
    const monster = makeMonster({ hp: 5, abilities: ["explosive"] });
    const state = stateWithCombat({}, [monster]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 1 });

    expect(next.hp).toBe(next.maxHp - 5);
    expect(next.combat).toBeNull(); // last monster gone, no Loot ability -> straight to victory
  });

  it("Explosive can kill the player outright if its HP exceeds the player's remaining HP", () => {
    const monster = makeMonster({ hp: 20, abilities: ["explosive"] });
    const state = stateWithCombat({ hp: 5 }, [monster]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 1 });

    expect(next.alive).toBe(false);
    expect(next.deathCause).toBe("combat");
    expect(next.combat).toBeNull(); // no fight lingers behind the death panel
  });

  it("Goblinator (Advanced Class, issue #23): takes -2 damage per Explosion", () => {
    const monster = makeMonster({ hp: 5, abilities: ["explosive"] });
    const state = stateWithCombat({ advancedClasses: ["Goblinator"] }, [monster]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 1 });

    expect(next.hp).toBe(next.maxHp - 3); // 5 - 2, instead of the usual 5
  });

  it("Goblinator's -2 reduction never drops the explosion's damage below 0", () => {
    const monster = makeMonster({ hp: 1, abilities: ["explosive"] });
    const state = stateWithCombat({ advancedClasses: ["Goblinator"] }, [monster]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 1 });

    expect(next.hp).toBe(next.maxHp); // 1 - 2, floored at 0
  });

  it("revives an Undead monster at 1 HP instead of removing it, on a roll of 1", () => {
    const monster = makeMonster({ hp: 2, abilities: ["undead"] });
    const state = stateWithCombat({}, [monster]);
    const next = dungeonReducer(
      state,
      { type: "PLAYER_ATTACK", targetId: monster.id, roll: 6 },
      fixedDie(1),
    );

    expect(next.combat).not.toBeNull();
    expect(next.combat!.monsters).toHaveLength(1);
    expect(next.combat!.monsters[0]!.hp).toBe(1);
    expect(next.monsterKills).toBe(0); // revived, not actually defeated -- doesn't count as a kill yet
  });

  it("removes the monster for good when the Undead revival roll fails", () => {
    const monster = makeMonster({ hp: 2, abilities: ["undead"] });
    const state = stateWithCombat({}, [monster]);
    const next = dungeonReducer(
      state,
      { type: "PLAYER_ATTACK", targetId: monster.id, roll: 6 },
      fixedDie(3),
    );

    expect(next.combat).toBeNull();
    expect(next.monsterKills).toBe(1);
  });

  it("Horde adds a fresh Orc to the fight on a roll of 1", () => {
    const monster = makeMonster({ hp: 20, abilities: ["horde"] });
    const state = stateWithCombat({}, [monster]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 1 });

    expect(next.combat!.monsters).toHaveLength(2);
    expect(next.combat!.monsters[1]).toMatchObject({
      name: "Orc",
      hp: 6,
      damage: 3,
      abilities: [],
    });
  });

  it("Necromancy adds an Undead Skeleton to the fight on a roll of 1", () => {
    const monster = makeMonster({ hp: 20, abilities: ["necromancy"] });
    const state = stateWithCombat({}, [monster]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 1 });

    expect(next.combat!.monsters).toHaveLength(2);
    expect(next.combat!.monsters[1]).toMatchObject({
      name: "Skeleton",
      hp: 4,
      damage: 1,
      abilities: ["undead"],
    });
  });

  it("Paralyze queues a paralysis effect that lands on the monster's own next counter-attack", () => {
    const monster = makeMonster({ hp: 20, damage: 2, abilities: ["paralyze"] });
    const state = stateWithCombat({}, [monster]);
    const next = dungeonReducer(
      state,
      { type: "PLAYER_ATTACK", targetId: monster.id, roll: 1 },
      fixedDie(4),
    );

    expect(next.combat!.paralyzedTurns).toBe(4);
    expect(next.combat!.monsters[0]!.paralyzePending).toBe(0); // already consumed this round
    expect(next.hp).toBe(next.maxHp - 2); // the paralyzing attack still deals its normal damage
  });

  it("skips the player's attack while paralyzed, still lets monsters act, and decrements the counter", () => {
    const monster = makeMonster({ hp: 20, damage: 2 });
    const state = stateWithCombat({}, [monster]);
    state.combat!.paralyzedTurns = 2;
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 6 });

    expect(next.combat!.paralyzedTurns).toBe(1);
    expect(next.combat!.monsters[0]!.hp).toBe(20); // the player's attack never landed
    expect(next.hp).toBe(next.maxHp - 2); // but the monster still attacked
  });
});

describe("PLAYER_ATTACK: blocked-attack messages", () => {
  it("names Stoneskin when a low-damage hit is blocked", () => {
    const monster = makeMonster({ hp: 20, damage: 0, abilities: ["stoneskin"] });
    const state = stateWithCombat({}, [monster]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 3 });

    expect(next.combat!.monsters[0]!.hp).toBe(20); // 3 damage <= 3 -- blocked
    expect(next.log[0]!.message).toBe("Your attack fails to harm Orc (stoneskin).");
  });

  it("names Intangible when an even-damage hit is blocked", () => {
    const monster = makeMonster({ hp: 20, damage: 0, abilities: ["intangible"] });
    const state = stateWithCombat({}, [monster]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 4 });

    expect(next.combat!.monsters[0]!.hp).toBe(20); // 4 is even -- blocked
    expect(next.log[0]!.message).toBe("Your attack fails to harm Orc (intangible).");
  });

  it("still lets odd damage through against an Intangible monster, undamped", () => {
    const monster = makeMonster({ hp: 20, damage: 0, abilities: ["intangible"] });
    const state = stateWithCombat({}, [monster]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 3 });

    expect(next.combat!.monsters[0]!.hp).toBe(17); // 3 is odd -- goes through untouched
    expect(next.log[0]!.message).toBe("You hit Orc for 3 damage.");
  });
});

describe("PLAYER_ATTACK guards", () => {
  it("is a no-op when there is no active combat", () => {
    const state = createInitialDungeonState();
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: 1, roll: 3 });
    expect(next).toBe(state);
  });

  it("is a no-op once the character is dead", () => {
    const state = { ...stateWithCombat(), alive: false };
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: 5, roll: 3 });
    expect(next).toBe(state);
  });
});

describe("CAST_SPELL in combat", () => {
  it("Cold Ray deals 4 damage, freezes the target for its next attack, and consumes a use", () => {
    const monster = makeMonster({ hp: 20, damage: 5 });
    const state = stateWithCombat({ spellUses: { "basic:4": 2 } }, [monster]);
    const next = dungeonReducer(state, {
      type: "CAST_SPELL",
      table: "basic",
      spellRoll: 4,
      targetId: monster.id,
    });

    expect(next.spellUses["basic:4"]).toBe(1);
    expect(next.combat!.monsters[0]!.hp).toBe(16);
    expect(next.hp).toBe(next.maxHp); // frozen monster skips its counter-attack this round
    // Necromancer/Scholar (issue #70): Cold Ray specifically sets hasCastColdRay, alongside the
    // generic hasCastSpell every successful cast already sets.
    expect(next.milestones.hasCastSpell).toBe(true);
    expect(next.milestones.hasCastColdRay).toBe(true);
  });

  it("Lightning deals 6 damage and lets the monster counter-attack normally", () => {
    const monster = makeMonster({ hp: 20, damage: 5 });
    const state = stateWithCombat({ spellUses: { "basic:5": 1 } }, [monster]);
    const next = dungeonReducer(state, {
      type: "CAST_SPELL",
      table: "basic",
      spellRoll: 5,
      targetId: monster.id,
    });

    expect(next.combat!.monsters[0]!.hp).toBe(14);
    expect(next.hp).toBe(next.maxHp - 5); // not frozen -- counter-attack lands
    // Scholar (issue #70): any successful cast sets the generic flag; Lightning isn't Cold Ray,
    // so the Necromancer-specific one stays false.
    expect(next.milestones.hasCastSpell).toBe(true);
    expect(next.milestones.hasCastColdRay).toBe(false);
  });

  it("Fireball hits every monster in the room", () => {
    const monsters = [
      makeMonster({ id: 1, hp: 20, damage: 0 }),
      makeMonster({ id: 2, hp: 3, damage: 0 }),
    ];
    const state = stateWithCombat({ spellUses: { "basic:6": 1 } }, monsters);
    const next = dungeonReducer(state, { type: "CAST_SPELL", table: "basic", spellRoll: 6 });

    expect(next.combat!.monsters).toHaveLength(1); // the 3-HP monster died to 5 fire damage
    expect(next.combat!.monsters[0]!.hp).toBe(15); // 20 - 5
  });

  it("a killing spell defeats the monster, awards Loot, and closes combat like a weapon kill would", () => {
    const monster = makeMonster({ hp: 6, abilities: ["loot"] });
    const state = stateWithCombat({ spellUses: { "basic:5": 1 } }, [monster]);
    const rng = sequenceDie([4]); // Loot roll -> a coin
    const next = dungeonReducer(
      state,
      { type: "CAST_SPELL", table: "basic", spellRoll: 5, targetId: monster.id },
      rng,
    );

    expect(next.combat).toBeNull();
    expect(next.coins).toBe(1);
  });

  it("Teleport flees combat without a monster counter-attack, and doesn't mark the room cleared", () => {
    const monster = makeMonster({ hp: 20, damage: 5 });
    const state = stateWithCombat({ spellUses: { "basic:3": 1 } }, [monster]);
    const dest = makeSegment({ id: 2, type: "room-small", doors: [] });
    state.levels[0]!.segments.push(dest);

    const next = dungeonReducer(state, {
      type: "CAST_SPELL",
      table: "basic",
      spellRoll: 3,
      destLevel: 0,
      destSegId: 2,
    });

    expect(next.combat).toBeNull();
    expect(next.hp).toBe(next.maxHp);
    expect(next.spellUses["basic:3"]).toBe(0);
    expect(next.levels[0]!.segments[0]!.monstersDefeated).toBeUndefined();
    expect(next.currentSegId).toBe(2);
    expect(next.selectedSegId).toBe(2);
  });

  it("Teleport rejects a room flagged needsMonsterReroll -- regression: it looks empty but would immediately spawn a fresh fight on arrival", () => {
    const monster = makeMonster({ hp: 20, damage: 5 });
    const state = stateWithCombat({ spellUses: { "basic:3": 1 } }, [monster]);
    const dest = makeSegment({ id: 2, type: "room-small", doors: [], needsMonsterReroll: true });
    state.levels[0]!.segments.push(dest);

    const next = dungeonReducer(state, {
      type: "CAST_SPELL",
      table: "basic",
      spellRoll: 3,
      destLevel: 0,
      destSegId: 2,
    });

    expect(next).toBe(state);
  });

  it("Teleport is a no-op without a valid destination room", () => {
    const monster = makeMonster({ hp: 20, damage: 5 });
    const state = stateWithCombat({ spellUses: { "basic:3": 1 } }, [monster]);

    expect(dungeonReducer(state, { type: "CAST_SPELL", table: "basic", spellRoll: 3 })).toBe(state);
    expect(
      dungeonReducer(state, {
        type: "CAST_SPELL",
        table: "basic",
        spellRoll: 3,
        destLevel: 0,
        destSegId: 999,
      }),
    ).toBe(state);
    // Segment 1 is the room the fight is happening in -- not a valid destination for itself.
    expect(
      dungeonReducer(state, {
        type: "CAST_SPELL",
        table: "basic",
        spellRoll: 3,
        destLevel: 0,
        destSegId: 1,
      }),
    ).toBe(state);
  });

  it("casting while paralyzed consumes the paralyzed turn instead of the spell's effect, but still spends a use", () => {
    const monster = makeMonster({ hp: 20, damage: 2 });
    const state = stateWithCombat({ spellUses: { "basic:5": 1 } }, [monster]);
    state.combat!.paralyzedTurns = 1;
    const next = dungeonReducer(state, {
      type: "CAST_SPELL",
      table: "basic",
      spellRoll: 5,
      targetId: monster.id,
    });

    expect(next.combat!.paralyzedTurns).toBe(0);
    expect(next.combat!.monsters[0]!.hp).toBe(20); // Lightning never landed
    expect(next.spellUses["basic:5"]).toBe(0);
    expect(next.hp).toBe(next.maxHp - 2); // but the monster still attacked
  });

  it("Cold Ray still freezes an Intangible monster even though its even-numbered damage is blocked", () => {
    const monster = makeMonster({ hp: 20, damage: 5, abilities: ["intangible"] });
    const state = stateWithCombat({ spellUses: { "basic:4": 1 } }, [monster]);
    const next = dungeonReducer(state, {
      type: "CAST_SPELL",
      table: "basic",
      spellRoll: 4,
      targetId: monster.id,
    });

    expect(next.combat!.monsters[0]!.hp).toBe(20); // Intangible blocked the (even) 4 damage
    expect(next.hp).toBe(next.maxHp); // but it's still frozen, so no counter-attack
  });
});

describe("CAST_SPELL: New Spells (issue #24) -- name-matched dispatch", () => {
  it("Elemental's Cold Ray (roll 3) resolves identically to Basic's, since CAST_SPELL matches by spell name", () => {
    const monster = makeMonster({ hp: 20, damage: 5 });
    const state = stateWithCombat({ spellUses: { "elemental:3": 1 } }, [monster]);
    const next = dungeonReducer(state, {
      type: "CAST_SPELL",
      table: "elemental",
      spellRoll: 3,
      targetId: monster.id,
    });

    expect(next.spellUses["elemental:3"]).toBe(0);
    expect(next.combat!.monsters[0]!.hp).toBe(16); // same 4 damage as Basic's Cold Ray
    expect(next.hp).toBe(next.maxHp); // frozen monster skips its counter-attack this round
  });

  it("Elemental's Fireball (roll 5) hits every monster in the room, same as Basic's", () => {
    const monsters = [
      makeMonster({ id: 1, hp: 20, damage: 0 }),
      makeMonster({ id: 2, hp: 3, damage: 0 }),
    ];
    const state = stateWithCombat({ spellUses: { "elemental:5": 1 } }, monsters);
    const next = dungeonReducer(state, { type: "CAST_SPELL", table: "elemental", spellRoll: 5 });

    expect(next.combat!.monsters).toHaveLength(1); // the 3-HP monster died to 5 fire damage
    expect(next.combat!.monsters[0]!.hp).toBe(15);
  });

  it("a New Spells effect with no real implementation yet (Nature's Natural Cure) is a no-op even with uses remaining", () => {
    const monster = makeMonster({ hp: 20, damage: 5 });
    const state = stateWithCombat({ spellUses: { "nature:1": 1 } }, [monster]);
    const next = dungeonReducer(state, { type: "CAST_SPELL", table: "nature", spellRoll: 1 });

    expect(next).toBe(state);
  });
});

describe("CAST_SPELL guards in combat", () => {
  it("is a no-op with no uses remaining", () => {
    const state = stateWithCombat({ spellUses: { "basic:5": 0 } });
    const next = dungeonReducer(state, {
      type: "CAST_SPELL",
      table: "basic",
      spellRoll: 5,
      targetId: state.combat!.monsters[0]!.id,
    });
    expect(next).toBe(state);
  });

  it("Cold Ray / Lightning are no-ops without a valid targetId", () => {
    const state = stateWithCombat({ spellUses: { "basic:4": 1, "basic:5": 1 } });
    expect(dungeonReducer(state, { type: "CAST_SPELL", table: "basic", spellRoll: 4 })).toBe(state);
    expect(
      dungeonReducer(state, { type: "CAST_SPELL", table: "basic", spellRoll: 5, targetId: 999 }),
    ).not.toBe(state); // consumes a use, but hits nothing
  });
});

describe("OPEN_TREASURE in combat", () => {
  it("resolving it mid-fight consumes the round, letting the monster counter-attack", () => {
    const monster = makeMonster({ hp: 20, damage: 5 });
    const state = stateWithCombat({ treasures: 1 }, [monster]);
    const next = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 1, maxSpellUses: {} });

    expect(next.treasures).toBe(0);
    expect(next.coins).toBe(0);
    expect(next.heldItems).toEqual([{ name: "Ornament", worth: 5 }]); // Palace roll 1
    expect(next.hp).toBe(next.maxHp - 5); // the monster's counter-attack landed
  });

  it("while paralyzed, consumes the paralyzed turn instead of resolving the treasure", () => {
    const monster = makeMonster({ hp: 20, damage: 2 });
    const state = stateWithCombat({ treasures: 1 }, [monster]);
    state.combat!.paralyzedTurns = 1;
    const next = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 1, maxSpellUses: {} });

    expect(next.combat!.paralyzedTurns).toBe(0);
    expect(next.treasures).toBe(1); // never opened
    expect(next.coins).toBe(0);
    expect(next.hp).toBe(next.maxHp - 2); // but the monster still attacked
  });
});

describe("combat blocks other dungeon actions", () => {
  it("OPEN_DOOR is a no-op while combat is active", () => {
    const seg = makeSegment({
      id: 1,
      type: "room-small",
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
    });
    const level = { ...makeLevel(1), segments: [seg], doorsRemaining: 1 };
    const state = stateWithCombat({ levels: [level] });
    const next = dungeonReducer(state, {
      type: "OPEN_DOOR",
      segId: 1,
      doorIdx: 0,
      roll: 1,
      wasNoisy: false,
    });
    expect(next).toBe(state);
  });

  it("RESOLVE_DOOR_LOCK is a no-op while combat is active", () => {
    const seg = makeSegment({
      id: 1,
      type: "room-small",
      doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
    });
    const level = { ...makeLevel(1), segments: [seg] };
    const state = stateWithCombat({ levels: [level] });
    const next = dungeonReducer(state, {
      type: "RESOLVE_DOOR_LOCK",
      segId: 1,
      doorIdx: 0,
      doorRoll: 5,
      trapRoll: null,
      lockChoice: null,
    });
    expect(next).toBe(state);
  });

  it("ROLL_SECRET_PASSAGE is a no-op while combat is active", () => {
    const room = makeSegment({
      id: 1,
      type: "room-small",
      doors: [],
      roomContent: { text: "x", secretPassage: true },
    });
    const level = { ...makeLevel(1), segments: [room] };
    const state = stateWithCombat({ levels: [level] });
    const next = dungeonReducer(state, {
      type: "ROLL_SECRET_PASSAGE",
      segId: 1,
      roll: 4,
      trapRoll: null,
    });
    expect(next).toBe(state);
  });

  it("SWITCH_LEVEL is a no-op while combat is active", () => {
    const state = stateWithCombat({ levels: [makeLevel(1), makeLevel(2)] });
    const next = dungeonReducer(state, { type: "SWITCH_LEVEL", levelIndex: 1 });
    expect(next).toBe(state);
  });
});

describe("Armor: damage-absorption choice", () => {
  it("defers to pendingDamage instead of subtracting HP when the player has usable armor", () => {
    const monster = makeMonster({ hp: 10, damage: 4 });
    const state = stateWithCombat({ armor: [{ piece: "boots", hp: 3, maxHp: 3 }] }, [monster]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 3 });

    expect(next.hp).toBe(next.maxHp); // untouched -- the choice hasn't been made yet
    expect(next.combat!.pendingDamage).toBe(4);
  });

  it("applies damage straight to HP when there's no usable armor (0 HP pieces don't count)", () => {
    const monster = makeMonster({ hp: 10, damage: 4 });
    const state = stateWithCombat({ armor: [{ piece: "ring", hp: 0, maxHp: 0 }] }, [monster]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 3 });

    expect(next.hp).toBe(next.maxHp - 4);
    expect(next.combat!.pendingDamage).toBeNull();
  });

  it("PLAYER_ATTACK, CAST_SPELL, and OPEN_TREASURE are no-ops while a damage choice is pending", () => {
    const state = stateWithCombat({
      armor: [{ piece: "boots", hp: 3, maxHp: 3 }],
      treasures: 1,
      spellUses: { "basic:1": 1 },
    });
    state.combat!.pendingDamage = 4;

    expect(
      dungeonReducer(state, {
        type: "PLAYER_ATTACK",
        targetId: state.combat!.monsters[0]!.id,
        roll: 3,
      }),
    ).toBe(state);
    expect(dungeonReducer(state, { type: "CAST_SPELL", table: "basic", spellRoll: 1 })).toBe(state);
    expect(dungeonReducer(state, { type: "OPEN_TREASURE", roll: 1, maxSpellUses: {} })).toBe(state);
  });

  it("RESOLVE_DAMAGE applied to HP subtracts it directly", () => {
    const state = stateWithCombat({ armor: [{ piece: "boots", hp: 3, maxHp: 3 }] });
    state.combat!.pendingDamage = 5;

    const next = dungeonReducer(state, { type: "RESOLVE_DAMAGE", absorbWith: "hp" });
    expect(next.hp).toBe(next.maxHp - 5);
    expect(next.combat!.pendingDamage).toBeNull();
  });

  it("RESOLVE_DAMAGE applied to an armor piece absorbs what it can and overflows the rest onto HP", () => {
    const state = stateWithCombat({ armor: [{ piece: "boots", hp: 3, maxHp: 3 }] });
    state.combat!.pendingDamage = 5;

    const next = dungeonReducer(state, { type: "RESOLVE_DAMAGE", absorbWith: 0 });
    expect(next.armor[0]!.hp).toBe(0); // fully depleted
    expect(next.hp).toBe(next.maxHp - 2); // the 2-damage overflow landed on HP
    expect(next.milestones.hasHadArmorDestroyed).toBe(true); // Blacksmith (issue #70)
  });

  it("RESOLVE_DAMAGE fully absorbed by an armor piece leaves HP untouched", () => {
    const state = stateWithCombat({ armor: [{ piece: "breastplate", hp: 10, maxHp: 10 }] });
    state.combat!.pendingDamage = 4;

    const next = dungeonReducer(state, { type: "RESOLVE_DAMAGE", absorbWith: 0 });
    expect(next.armor[0]!.hp).toBe(6);
    expect(next.hp).toBe(next.maxHp);
    expect(next.milestones.hasHadArmorDestroyed).toBe(false); // piece survived intact
  });

  it("resolving pending damage down to 0 HP still kills the character and leaves remains", () => {
    const monster = makeMonster({ hp: 10, damage: 4 });
    const state = stateWithCombat(
      { hp: 3, armor: [{ piece: "boots", hp: 1, maxHp: 3 }], characterName: "Doomed Dara" },
      [monster],
    );
    const afterAttack = dungeonReducer(state, {
      type: "PLAYER_ATTACK",
      targetId: monster.id,
      roll: 3,
    });
    expect(afterAttack.combat!.pendingDamage).toBe(4);

    const next = dungeonReducer(afterAttack, { type: "RESOLVE_DAMAGE", absorbWith: 0 });
    expect(next.alive).toBe(false);
    expect(next.deathCause).toBe("combat");
    expect(next.levels[0]!.segments[0]!.remains).not.toBeNull();
  });

  it("Poison damage always hits HP directly, even with usable armor equipped -- only non-poison damage is offered as a choice", () => {
    const poisoner = makeMonster({ id: 1, hp: 10, damage: 2, abilities: ["poison"] });
    const brute = makeMonster({ id: 2, hp: 10, damage: 5, abilities: [] });
    const state = stateWithCombat({ armor: [{ piece: "breastplate", hp: 10, maxHp: 10 }] }, [
      poisoner,
      brute,
    ]);

    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: poisoner.id, roll: 3 });

    expect(next.hp).toBe(next.maxHp - 2); // the Poison damage landed on HP immediately
    expect(next.combat!.pendingDamage).toBe(5); // only the Brute's damage is offered as a choice
  });

  it("a fatal Poison tick doesn't leave a moot absorption choice pending for the rest of the round's damage", () => {
    const poisoner = makeMonster({ id: 1, hp: 10, damage: 20, abilities: ["poison"] });
    const brute = makeMonster({ id: 2, hp: 10, damage: 5, abilities: [] });
    const state = stateWithCombat({ hp: 5, armor: [{ piece: "breastplate", hp: 10, maxHp: 10 }] }, [
      poisoner,
      brute,
    ]);

    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: poisoner.id, roll: 3 });

    expect(next.alive).toBe(false);
    expect(next.combat).toBeNull(); // no lingering absorption prompt (or fight at all) for a dead character
  });

  it("Pirate (Advanced Class, issue #72): Ignores Poison -- the damage still lands, but as an absorbable choice, not forced onto HP", () => {
    const poisoner = makeMonster({ id: 1, hp: 10, damage: 2, abilities: ["poison"] });
    const state = stateWithCombat(
      { advancedClasses: ["Pirate"], armor: [{ piece: "breastplate", hp: 10, maxHp: 10 }] },
      [poisoner],
    );

    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: poisoner.id, roll: 3 });

    expect(next.hp).toBe(next.maxHp); // untouched -- the choice hasn't been made yet
    expect(next.combat!.pendingDamage).toBe(2); // Poison damage now offered as a normal choice
  });
});

describe("Armor: ignoresMonsterAbility", () => {
  it("skips the Undead revival roll when the player has an item that ignores it", () => {
    const monster = makeMonster({ hp: 3, abilities: ["undead"] });
    const state = stateWithCombat(
      {
        armor: [
          {
            piece: "wonderItem",
            hp: 0,
            maxHp: 0,
            itemName: "Amulet of the Dead",
            effect: { kind: "ignoresMonsterAbility", ability: "undead" },
          },
        ],
      },
      [monster],
    );
    // roll of 1 would normally revive the Undead monster -- ignored here, so it just dies.
    const next = dungeonReducer(
      state,
      { type: "PLAYER_ATTACK", targetId: monster.id, roll: 6 },
      fixedDie(1),
    );
    expect(next.combat).toBeNull(); // fight over -- the monster was removed, not revived
  });

  it("[Weapon] of the Dragon shields against a Firebreath counterattack on a roll of 1", () => {
    const monster = makeMonster({ hp: 20, damage: 3, abilities: ["firebreath"] });
    const weapon = {
      name: "[Weapon] of the Dragon",
      formula: "1d6",
      bonusEffect: { kind: "ignoresMonsterAbility" as const, ability: "firebreath" as const },
    };
    const state = stateWithCombat({ weapon }, [monster]);
    // roll of 1 would normally arm a +10 Firebreath counterattack -- ignored here.
    const next = dungeonReducer(
      state,
      { type: "PLAYER_ATTACK", targetId: monster.id, roll: 1 },
      fixedDie(3),
    );
    expect(next.combat!.monsters[0]!.bonusDamage).toBe(0);
    expect(next.hp).toBe(next.maxHp - 3); // only the monster's plain damage lands
  });

  it("Boatman's Oar bypasses Intangible's even-damage block", () => {
    const monster = makeMonster({ hp: 20, damage: 0, abilities: ["intangible"] });
    const weapon = {
      name: "Boatman's Oar",
      formula: "1d6+1",
      bonusEffect: { kind: "ignoresMonsterAbility" as const, ability: "intangible" as const },
    };
    const state = stateWithCombat({ weapon }, [monster]);
    // roll 3 + modifier 1 = 4, an even total that Intangible would normally block entirely.
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 3 });
    expect(next.combat!.monsters[0]!.hp).toBe(16);
  });
});

describe("Weapon bonus effects: Phase 2", () => {
  it("lifesteal heals the player on a successful hit, capped at maxHp", () => {
    const monster = makeMonster({ hp: 20, damage: 0 });
    const weapon = {
      name: "Vampiric Sword",
      formula: "1d6",
      bonusEffect: { kind: "lifesteal" as const, amount: 1 },
    };
    const state = stateWithCombat({ weapon, hp: 15, maxHp: 20 }, [monster]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 3 });
    expect(next.combat!.monsters[0]!.hp).toBe(17); // 3 damage dealt
    expect(next.hp).toBe(16); // healed 1
  });

  it("lifesteal doesn't overheal past maxHp", () => {
    const monster = makeMonster({ hp: 20, damage: 0 });
    const weapon = {
      name: "Vampiric Sword",
      formula: "1d6",
      bonusEffect: { kind: "lifesteal" as const, amount: 1 },
    };
    const state = stateWithCombat({ weapon, hp: 20, maxHp: 20 }, [monster]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 3 });
    expect(next.hp).toBe(20);
  });

  it("instantKillOnRoll short-circuits normal damage math and defeats the monster outright", () => {
    const monster = makeMonster({ hp: 100, damage: 0, abilities: ["loot"] });
    const weapon = {
      name: "Vorpal Sword",
      formula: "1d6-3",
      bonusEffect: { kind: "instantKillOnRoll" as const, roll: 6 },
    };
    const state = stateWithCombat({ weapon }, [monster]);
    const rng = sequenceDie([4]); // only consumed by the post-victory Loot roll
    const next = dungeonReducer(
      state,
      { type: "PLAYER_ATTACK", targetId: monster.id, roll: 6 },
      rng,
    );
    expect(next.combat).toBeNull(); // the 100 HP monster is gone despite the weapon's weak formula
    expect(next.coins).toBe(1);
  });

  it("instantKillOnRoll does nothing on a non-matching roll -- normal damage applies", () => {
    const monster = makeMonster({ hp: 100, damage: 0 });
    const weapon = {
      name: "Vorpal Sword",
      formula: "1d6",
      bonusEffect: { kind: "instantKillOnRoll" as const, roll: 6 },
    };
    const state = stateWithCombat({ weapon }, [monster]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 3 });
    expect(next.combat!.monsters[0]!.hp).toBe(97);
  });
});

describe("Weapon bonus effects", () => {
  it("weaponDamageBonus adds flat damage to every attack", () => {
    const monster = makeMonster({ hp: 20, damage: 0 });
    const state = stateWithCombat(
      {
        weapon: {
          name: "Sword",
          formula: "1d6",
          bonusEffect: { kind: "weaponDamageBonus", amount: 2 },
        },
      },
      [monster],
    );
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 3 });
    expect(next.combat!.monsters[0]!.hp).toBe(15); // 3 (roll) + 2 (bonus) = 5 damage
  });

  it("damageBonusVsTag only applies when the monster's name matches", () => {
    const angel = makeMonster({ hp: 20, damage: 0, name: "Warrior Angel" });
    const orc = makeMonster({ hp: 20, damage: 0, name: "Orc" });
    const weapon = {
      name: "Spear",
      formula: "1d6",
      bonusEffect: { kind: "damageBonusVsTag" as const, tags: ["angel"], amount: 2 },
    };

    const vsAngel = dungeonReducer(stateWithCombat({ weapon }, [angel]), {
      type: "PLAYER_ATTACK",
      targetId: angel.id,
      roll: 3,
    });
    expect(vsAngel.combat!.monsters[0]!.hp).toBe(15); // 3 + 2

    const vsOrc = dungeonReducer(stateWithCombat({ weapon }, [orc]), {
      type: "PLAYER_ATTACK",
      targetId: orc.id,
      roll: 3,
    });
    expect(vsOrc.combat!.monsters[0]!.hp).toBe(17); // just 3, no bonus
  });

  it("damageMultiplierVsTag doubles just the weapon roll when the monster's name matches", () => {
    const dragon = makeMonster({ hp: 20, damage: 0, name: "Dragon" });
    const weapon = {
      name: "Dragon Slayer",
      formula: "1d6",
      bonusEffect: { kind: "damageMultiplierVsTag" as const, tags: ["dragon"], multiplier: 2 },
    };
    const state = stateWithCombat({ weapon }, [dragon]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: dragon.id, roll: 3 });
    expect(next.combat!.monsters[0]!.hp).toBe(14); // 3 * 2 = 6 damage
  });

  it("combat.playerDamageBonus (e.g. Potion of Fury) adds to every attack this fight", () => {
    const monster = makeMonster({ hp: 20, damage: 0 });
    const state = stateWithCombat({}, [monster]);
    state.combat!.playerDamageBonus = 2;
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 3 });
    expect(next.combat!.monsters[0]!.hp).toBe(15); // 3 + 2
  });
});

describe("Grave Digger: +2 damage to Undead", () => {
  it("adds +2 damage against an Undead-ability monster", () => {
    const monster = makeMonster({ hp: 20, damage: 0, abilities: ["undead"] });
    const state = stateWithCombat({ className: "Grave Digger" }, [monster]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 3 });
    expect(next.combat!.monsters[0]!.hp).toBe(15); // 3 + 2
  });

  it("does not apply the bonus against a non-Undead monster", () => {
    const monster = makeMonster({ hp: 20, damage: 0, abilities: [] });
    const state = stateWithCombat({ className: "Grave Digger" }, [monster]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 3 });
    expect(next.combat!.monsters[0]!.hp).toBe(17); // just 3
  });

  it("a non-Grave-Digger gets no bonus even against Undead", () => {
    const monster = makeMonster({ hp: 20, damage: 0, abilities: ["undead"] });
    const state = stateWithCombat({}, [monster]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 3 });
    expect(next.combat!.monsters[0]!.hp).toBe(17); // just 3
  });

  it("Gravedigger (Advanced Class, issue #23) grants the identical +2 bonus, independent of class", () => {
    const monster = makeMonster({ hp: 20, damage: 0, abilities: ["undead"] });
    const state = stateWithCombat({ advancedClasses: ["Gravedigger"] }, [monster]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 3 });
    expect(next.combat!.monsters[0]!.hp).toBe(15); // 3 + 2
  });

  it("having both the Grave Digger class and the Gravedigger Advanced Class doesn't stack the bonus", () => {
    const monster = makeMonster({ hp: 20, damage: 0, abilities: ["undead"] });
    const state = stateWithCombat(
      { className: "Grave Digger", advancedClasses: ["Gravedigger"] },
      [monster],
    );
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 3 });
    expect(next.combat!.monsters[0]!.hp).toBe(15); // still just 3 + 2, not +4
  });
});

describe("Hirelings (issue #25): passive combat bonuses", () => {
  it("Minstrel grants an unconditional +2 damage", () => {
    const monster = makeMonster({ hp: 20, damage: 0, abilities: [] });
    const state = stateWithCombat({ hireling: "Minstrel" }, [monster]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 3 });
    expect(next.combat!.monsters[0]!.hp).toBe(15); // 3 + 2
  });

  it("Dwarf Soldier grants +1 damage against Orcs and Goblins", () => {
    const orc = makeMonster({ hp: 20, damage: 0, abilities: [], name: "Orc" });
    const state = stateWithCombat({ hireling: "Dwarf Soldier" }, [orc]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: orc.id, roll: 3 });
    expect(next.combat!.monsters[0]!.hp).toBe(16); // 3 + 1
  });

  it("Dwarf Soldier's bonus doesn't apply against a non-Orc/Goblin monster", () => {
    const monster = makeMonster({ hp: 20, damage: 0, abilities: [], name: "Skeleton" });
    const state = stateWithCombat({ hireling: "Dwarf Soldier" }, [monster]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 3 });
    expect(next.combat!.monsters[0]!.hp).toBe(17); // just 3
  });

  it("no hireling means no bonus", () => {
    const monster = makeMonster({ hp: 20, damage: 0, abilities: [], name: "Orc" });
    const state = stateWithCombat({}, [monster]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 3 });
    expect(next.combat!.monsters[0]!.hp).toBe(17); // just 3
  });
});

describe("Ogre (New Races, issue #22): +2 damage, unconditional", () => {
  it("adds +2 damage against any monster, undead or not", () => {
    const monster = makeMonster({ hp: 20, damage: 0, abilities: [] });
    const state = stateWithCombat({ raceName: "Ogre" }, [monster]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 3 });
    expect(next.combat!.monsters[0]!.hp).toBe(15); // 3 + 2
  });

  it("a non-Ogre gets no bonus", () => {
    const monster = makeMonster({ hp: 20, damage: 0, abilities: [] });
    const state = stateWithCombat({}, [monster]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 3 });
    expect(next.combat!.monsters[0]!.hp).toBe(17); // just 3
  });
});

describe("Cook: +1 coin per kill (except Undead)", () => {
  it("gains 1 coin when a non-Undead monster is killed", () => {
    const monster = makeMonster({ hp: 3, abilities: [] });
    const state = stateWithCombat({ className: "Cook" }, [monster]);
    const next = dungeonReducer(
      state,
      { type: "PLAYER_ATTACK", targetId: monster.id, roll: 6 },
      sequenceDie([1]),
    );
    expect(next.coins).toBe(1);
    expect(next.log.some((e) => e.message.includes("Cook's instincts"))).toBe(true);
  });

  it("does not gain a coin from killing an Undead monster", () => {
    const monster = makeMonster({ hp: 3, abilities: ["undead"] });
    const state = stateWithCombat({ className: "Cook" }, [monster]);
    // roll of 1 on the Undead-revival check -> stays dead; no further rng needed
    const next = dungeonReducer(
      state,
      { type: "PLAYER_ATTACK", targetId: monster.id, roll: 6 },
      fixedDie(6),
    );
    expect(next.coins).toBe(0);
  });

  it("a non-Cook gets no coin from a kill", () => {
    const monster = makeMonster({ hp: 3, abilities: [] });
    const state = stateWithCombat({}, [monster]);
    const next = dungeonReducer(
      state,
      { type: "PLAYER_ATTACK", targetId: monster.id, roll: 6 },
      sequenceDie([1]),
    );
    expect(next.coins).toBe(0);
  });
});

describe("Rinoceroid: horn attack", () => {
  it("attacks with a flat 1d6, ignoring the equipped weapon's formula and bonus effects", () => {
    const monster = makeMonster({ hp: 20, damage: 0 });
    const weapon = { name: "Halberd", formula: "1d6+3", twoHanded: true };
    const state = stateWithCombat({ raceName: "Rinoceroid", weapon }, [monster]);
    const next = dungeonReducer(state, {
      type: "PLAYER_ATTACK",
      targetId: monster.id,
      roll: 4,
      useHorn: true,
    });
    expect(next.combat!.monsters[0]!.hp).toBe(16); // just the raw roll, no +3 weapon modifier
  });

  it("useHorn is ignored for a non-Rinoceroid, falling back to the equipped weapon", () => {
    const monster = makeMonster({ hp: 20, damage: 0 });
    const state = stateWithCombat({ weaponFormula: "1d6+3" }, [monster]);
    const next = dungeonReducer(state, {
      type: "PLAYER_ATTACK",
      targetId: monster.id,
      roll: 4,
      useHorn: true,
    });
    expect(next.combat!.monsters[0]!.hp).toBe(13); // 4 + 3 modifier applied
  });
});

describe("Slimemen: engulf a fallen enemy's body", () => {
  it("tracks an engulfable body for every monster actually killed (not revived), regardless of race", () => {
    const monster = makeMonster({ hp: 3, abilities: [] });
    const state = stateWithCombat({}, [monster, makeMonster({ id: 9, hp: 20, damage: 0 })]);
    const next = dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: monster.id, roll: 6 });
    expect(next.combat!.engulfableBodies).toBe(1);
  });

  it("ENGULF_BODY heals a Slimemen to full HP and consumes one body, then the fight continues", () => {
    const monster = makeMonster({ hp: 20, damage: 4 });
    const state = stateWithCombat({ raceName: "Slimemen", hp: 5, maxHp: 20 }, [monster]);
    state.combat!.engulfableBodies = 1;
    const next = dungeonReducer(state, { type: "ENGULF_BODY" });
    expect(next.hp).toBe(20 - 4); // healed to full, then the monster's counter-attack landed
    expect(next.combat!.engulfableBodies).toBe(0);
    expect(next.log.some((e) => e.message.includes("engulf"))).toBe(true);
  });

  it("is a no-op for a non-Slimemen", () => {
    const monster = makeMonster({ hp: 20, damage: 4 });
    const state = stateWithCombat({ hp: 5, maxHp: 20 }, [monster]);
    state.combat!.engulfableBodies = 1;
    const next = dungeonReducer(state, { type: "ENGULF_BODY" });
    expect(next).toBe(state);
  });

  it("is a no-op when there's no body to engulf", () => {
    const monster = makeMonster({ hp: 20, damage: 4 });
    const state = stateWithCombat({ raceName: "Slimemen", hp: 5, maxHp: 20 }, [monster]);
    const next = dungeonReducer(state, { type: "ENGULF_BODY" });
    expect(next).toBe(state);
  });
});
