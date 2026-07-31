import { describe, expect, it } from "vitest";
import { dungeonReducer } from "../dungeonReducer.ts";
import { DUNGEON_TABLES } from "../../data/dungeonTables.ts";
import {
  createInitialDungeonState,
  makeLevel,
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

function doorState(dungeonTypeKey: DungeonState["dungeonTypeKey"], torches = 10): DungeonState {
  const seg = makeSegment({
    id: 1,
    type: "room-small",
    doors: [{ dir: "E", opened: false, childId: null, leadsToLevel: null }],
  });
  const level = { ...makeLevel(1), segments: [seg], doorsRemaining: 1 };
  return {
    ...createInitialDungeonState(),
    dungeonTypeKey,
    levels: [level],
    activeLevel: 0,
    nextSegmentId: 100,
    currentSegId: 1,
    torches,
  };
}

describe("Pyramid trap (issue #30): unconditional instant death", () => {
  it("kills outright on any roll -- no secondary roll like the Blade Trap", () => {
    const state = { ...doorState("pyramid"), hp: 20, coins: 5, characterName: "Doomed" };
    const next = dungeonReducer(state, {
      type: "RESOLVE_DOOR_LOCK",
      segId: 1,
      doorIdx: 0,
      doorRoll: 1,
      trapRoll: 1,
      lockChoice: null,
    });
    expect(next.alive).toBe(false);
    expect(next.hp).toBe(0);
    expect(next.deathCause).toBe("combat");
    expect(next.levels[0]!.segments[0]!.remains?.coins).toBe(5);
  });

  it("Samambro/Raven survival still applies -- reuses the ordinary damage-death path", () => {
    const state = { ...doorState("pyramid"), hp: 20, raceName: "Samambro" };
    const next = dungeonReducer(
      state,
      {
        type: "RESOLVE_DOOR_LOCK",
        segId: 1,
        doorIdx: 0,
        doorRoll: 1,
        trapRoll: 1,
        lockChoice: null,
      },
      fixedDie(3),
    );
    expect(next.alive).toBe(true);
    expect(next.hp).toBe(1);
  });
});

describe("Ziggurat trap (issue #30): destroysArmor", () => {
  it("destroys one equipped armor piece and flags the Blacksmith milestone", () => {
    const state = {
      ...doorState("ziggurat"),
      armor: [{ piece: "boots" as const, hp: 3, maxHp: 3 }],
    };
    const next = dungeonReducer(state, {
      type: "RESOLVE_DOOR_LOCK",
      segId: 1,
      doorIdx: 0,
      doorRoll: 1,
      trapRoll: 2,
      lockChoice: null,
    });
    expect(next.armor[0]!.hp).toBe(0);
    expect(next.milestones.hasHadArmorDestroyed).toBe(true);
    expect(next.log.some((e) => e.message.includes("destroys your Boots"))).toBe(true);
  });

  it("is a no-op (flavor message only) with nothing equipped", () => {
    const state = { ...doorState("ziggurat"), armor: [] };
    const next = dungeonReducer(state, {
      type: "RESOLVE_DOOR_LOCK",
      segId: 1,
      doorIdx: 0,
      doorRoll: 1,
      trapRoll: 2,
      lockChoice: null,
    });
    expect(next.armor).toEqual([]);
    expect(next.log.some((e) => e.message.includes("no armor to destroy"))).toBe(true);
  });

  it("only considers pieces that can actually absorb damage (skips a 0-maxHp Ring)", () => {
    const state = {
      ...doorState("ziggurat"),
      armor: [
        { piece: "ring" as const, hp: 0, maxHp: 0 },
        { piece: "helm" as const, hp: 4, maxHp: 4 },
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
    expect(next.armor.find((p) => p.piece === "helm")!.hp).toBe(0);
    expect(next.armor.find((p) => p.piece === "ring")!.hp).toBe(0); // untouched, was already 0
  });
});

describe("Ziggurat trap (issue #30): rollsMonsterTable", () => {
  it("rolls fresh into the dungeon's own Monster table and starts combat", () => {
    const state = doorState("ziggurat");
    const next = dungeonReducer(
      state,
      {
        type: "RESOLVE_DOOR_LOCK",
        segId: 1,
        doorIdx: 0,
        doorRoll: 1,
        trapRoll: 4,
        lockChoice: null,
      },
      sequenceDie([5, 5]), // monster sum 10 -> Giant Bat
    );
    expect(next.combat).not.toBeNull();
    expect(next.combat!.monsters[0]!.name).toBe("Giant Bat");
  });

  it("logs 'nothing emerges' when the roll lands on a no-monsters row", () => {
    const state = doorState("ziggurat");
    const next = dungeonReducer(
      state,
      {
        type: "RESOLVE_DOOR_LOCK",
        segId: 1,
        doorIdx: 0,
        doorRoll: 1,
        trapRoll: 4,
        lockChoice: null,
      },
      sequenceDie([4, 3]), // monster sum 7 -> no monsters
    );
    expect(next.combat).toBeNull();
    expect(next.log.some((e) => e.message.includes("nothing emerges"))).toBe(true);
  });
});

describe("Necropolis trap (issue #30): torchCostDice", () => {
  it("spends a freshly-rolled 1d6 torches, not a flat amount", () => {
    const state = doorState("necropolis", 10);
    const next = dungeonReducer(
      state,
      {
        type: "RESOLVE_DOOR_LOCK",
        segId: 1,
        doorIdx: 0,
        doorRoll: 1,
        trapRoll: 4,
        lockChoice: null,
      },
      fixedDie(4),
    );
    expect(next.torches).toBe(6); // 10 - 4
    expect(next.log.some((e) => e.message.includes("Spent 4 torches"))).toBe(true);
  });

  it("the Darkness still applies if the rolled cost exceeds torches on hand", () => {
    const state = doorState("necropolis", 2);
    const next = dungeonReducer(
      state,
      {
        type: "RESOLVE_DOOR_LOCK",
        segId: 1,
        doorIdx: 0,
        doorRoll: 1,
        trapRoll: 4,
        lockChoice: null,
      },
      fixedDie(5),
    );
    expect(next.alive).toBe(false);
  });
});

describe("Pyramid Wonders (issue #30): rerollBaseTable", () => {
  it("'armor' branch grants a plain Armor piece with no bonus effect", () => {
    const state = { ...doorState("pyramid"), treasures: 1 };
    const next = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 5 }, sequenceDie([5, 4]));
    // Treasure roll 5 -> reroll wonders (die 5) -> Pyramid wonders[5] = rerollBaseTable:armor (die 4 -> shoulderpads)
    expect(next.armor).toHaveLength(1);
    expect(next.armor[0]!.piece).toBe("shoulderpads");
    expect(next.armor[0]!.effect).toBeUndefined();
  });

  it("'weapon' branch grants a plain weapon from the dungeon's own Weapon table", () => {
    const state = { ...doorState("pyramid"), treasures: 1 };
    const next = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 5 }, sequenceDie([6, 3]));
    // wonders[6] = rerollBaseTable:weapon (die 3 -> Katar, 1d6)
    expect(next.spareWeapons).toEqual([{ name: "Katar", formula: "1d6" }]);
  });

  it("Ogre still benefits from the weapon branch but not the armor branch", () => {
    const armorState = { ...doorState("pyramid"), treasures: 1, raceName: "Ogre" };
    const afterArmor = dungeonReducer(
      armorState,
      { type: "OPEN_TREASURE", roll: 5 },
      sequenceDie([5, 4]),
    );
    expect(afterArmor.armor).toEqual([]);
    expect(afterArmor.heldItems).toHaveLength(1); // sold instead (issue #83)

    const weaponState = { ...doorState("pyramid"), treasures: 1, raceName: "Ogre" };
    const afterWeapon = dungeonReducer(
      weaponState,
      { type: "OPEN_TREASURE", roll: 5 },
      sequenceDie([6, 3]),
    );
    expect(afterWeapon.spareWeapons).toEqual([{ name: "Katar", formula: "1d6" }]);
  });
});

describe("Citadel Wonders (issue #30): grantsWeapon", () => {
  it("Orc Machete grants a plain weapon directly, not a wonderItem armor piece", () => {
    const state = { ...doorState("citadel"), treasures: 1 };
    const next = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 5 }, fixedDie(4));
    // Treasure roll 5 -> reroll wonders (die 4) -> Citadel wonders[4] = Orc Machete
    expect(next.spareWeapons).toEqual([{ name: "Orc Machete", formula: "1d6+1" }]);
    expect(next.armor).toEqual([]);
  });
});

/** Issue #110: a timing-dependent reward is stowed rather than drunk on discovery, so these tests
 * open the Treasure and then drink the potion it produced. */
function drinkFirstConsumable(state: DungeonState, rng?: () => number): DungeonState {
  return dungeonReducer(state, { type: "USE_CONSUMABLE", index: 0 }, rng);
}

describe("Ziggurat Wonders (issue #30): healAmount", () => {
  it("is stowed when found, then heals a small fixed amount when drunk", () => {
    const state = { ...doorState("ziggurat"), treasures: 1, hp: 10, maxHp: 20 };
    const found = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 5 }, fixedDie(1));
    expect(found.hp).toBe(10); // issue #110: not drunk on discovery anymore
    expect(found.consumables).toHaveLength(1);
    expect(drinkFirstConsumable(found).hp).toBe(11);
  });

  it("never overheals past maxHp", () => {
    const state = { ...doorState("ziggurat"), treasures: 1, hp: 20, maxHp: 20 };
    const found = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 5 }, fixedDie(1));
    expect(drinkFirstConsumable(found).hp).toBe(20);
  });
});

describe("Ziggurat Treasure (issue #30): restoreRandomSpellUse", () => {
  it("restores a use of a randomly-picked known spell, capped at its own ceiling", () => {
    const state = {
      ...doorState("ziggurat"),
      treasures: 1,
      spellUses: { "basic:1": 1 },
      maxSpellUses: { "basic:1": 3 },
    };
    const next = drinkFirstConsumable(dungeonReducer(state, { type: "OPEN_TREASURE", roll: 1 }));
    expect(next.spellUses).toEqual({ "basic:1": 2 });
  });

  it("doesn't exceed the spell's own ceiling", () => {
    const state = {
      ...doorState("ziggurat"),
      treasures: 1,
      spellUses: { "basic:1": 3 },
      maxSpellUses: { "basic:1": 3 },
    };
    const next = drinkFirstConsumable(dungeonReducer(state, { type: "OPEN_TREASURE", roll: 1 }));
    expect(next.spellUses).toEqual({ "basic:1": 3 });
  });

  it("is a no-op (flavor log only) when no spells are known at all", () => {
    const state = { ...doorState("ziggurat"), treasures: 1, spellUses: {} };
    const next = drinkFirstConsumable(dungeonReducer(state, { type: "OPEN_TREASURE", roll: 1 }));
    expect(next.spellUses).toEqual({});
    expect(next.log.some((e) => e.message.includes("don't know any spells"))).toBe(true);
  });
});

describe("Necropolis Magic Item (issue #30): fixedArmor/twoHanded/grantsSpells", () => {
  it("fixedArmor grants a specific named piece, not a rolled one", () => {
    const state = { ...doorState("necropolis"), treasures: 1 };
    // Treasure roll 6 -> reroll magicItem, a single die (2) picks magicItem[2] directly (Dwarf
    // King's Helm, fixedArmor helm/11 -- no second roll needed since fixedArmor skips ARMOR_TABLE).
    const next = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 6 }, fixedDie(2));
    expect(next.armor).toEqual([
      {
        piece: "helm",
        hp: 11,
        maxHp: 11,
        itemName: "Dwarf King's Helm",
        effect: { kind: "flavor" },
      },
    ]);
  });

  it("twoHanded threads through a fixedFormula weapon grant", () => {
    const state = { ...doorState("necropolis"), treasures: 1 };
    // magicItem[5] = Vampiric Trident, fixedFormula 1d6+2, twoHanded, lifesteal -- one roll picks
    // the row directly, fixedFormula skips the base Weapon table roll.
    const next = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 6 }, fixedDie(5));
    expect(next.spareWeapons).toEqual([
      {
        name: "Vampiric Trident",
        formula: "1d6+2",
        twoHanded: true,
        bonusEffect: { kind: "lifesteal", amount: 1 },
      },
    ]);
  });

  it("grantsSpells (Fool's Potion) learns 3 random Basic Spells directly, no item at all", () => {
    const state = { ...doorState("necropolis"), treasures: 1, spellUses: {}, maxSpellUses: {} };
    const next = dungeonReducer(
      state,
      { type: "OPEN_TREASURE", roll: 6 },
      sequenceDie([1, 1, 2, 3]),
    );
    // magicItem[1] = Fool's Potion, grantsSpells: 3 -> rolls 3 more dice (1, 2, 3)
    expect(next.spellUses).toEqual({ "basic:1": 1, "basic:2": 1, "basic:3": 1 });
    expect(next.maxSpellUses).toEqual({ "basic:1": 1, "basic:2": 1, "basic:3": 1 });
    expect(next.armor).toEqual([]);
    expect(next.spareWeapons).toEqual([]);
    expect(next.milestones.hasCastSpell).toBe(true);
  });
});

function stateWithBossVictory(dungeonTypeKey: DungeonState["dungeonTypeKey"]): DungeonState {
  const seg = makeSegment({ id: 1, type: "final", doors: [] });
  const level = { ...makeLevel(1), segments: [seg] };
  return {
    ...createInitialDungeonState(),
    dungeonTypeKey,
    levels: [level],
    currentSegId: 1,
    combat: {
      segId: 1,
      monsters: [
        {
          id: 1,
          name: "Dummy",
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
      paralyzedTurns: 0,
      pendingLootRolls: 0,
      isBoss: true,
      outcome: "ongoing",
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
    },
  };
}

describe("bossBonusLoot (issue #30): Citadel's Dwarf Hallows / Necropolis's Forgotten Hallows", () => {
  it("Citadel: rolls an extra bonus item on top of the usual 2d6 Treasures on Boss victory", () => {
    const state = stateWithBossVictory("citadel");
    // PLAYER_ATTACK roll kills the 1-HP dummy; then 2d6 Treasures (2,3), then bossBonusLoot roll (5)
    const next = dungeonReducer(
      state,
      { type: "PLAYER_ATTACK", targetId: 1, roll: 6 },
      sequenceDie([2, 3, 5]),
    );
    expect(next.combat).toBeNull();
    expect(next.armor).toEqual([
      { piece: "helm", hp: 11, maxHp: 11, itemName: "Dwarf King's Helm", effect: undefined },
    ]);
    expect(next.log.some((e) => e.message.includes("Dwarf King's Helm"))).toBe(true);
  });

  it("Necropolis: a 'trinket' bossBonusLoot kind grants a wonderItem-style armor piece", () => {
    const state = stateWithBossVictory("necropolis");
    const next = dungeonReducer(
      state,
      { type: "PLAYER_ATTACK", targetId: 1, roll: 6 },
      sequenceDie([2, 3, 1]),
    );
    expect(next.armor).toEqual([
      {
        piece: "wonderItem",
        hp: 4,
        maxHp: 4,
        itemName: "Magic Stone Dog",
        effect: { kind: "weaponDamageBonus", amount: 2 },
      },
    ]);
  });

  it("a type with no bossBonusLoot table (Palace) doesn't roll one at all", () => {
    const state = stateWithBossVictory("palace");
    const next = dungeonReducer(
      state,
      { type: "PLAYER_ATTACK", targetId: 1, roll: 6 },
      sequenceDie([2, 3]),
    );
    expect(next.combat).toBeNull();
    expect(next.armor).toEqual([]);
    expect(next.spareWeapons).toEqual([]);
  });
});

function roomState(dungeonTypeKey: DungeonState["dungeonTypeKey"]): DungeonState {
  const room = makeSegment({
    id: 1,
    type: "room-small",
    doors: [],
    roomContent: { text: "flavor", secretPassage: true },
  });
  const level = { ...makeLevel(1), segments: [room] };
  return {
    ...createInitialDungeonState(),
    dungeonTypeKey,
    levels: [level],
    currentSegId: 1,
  };
}

describe("Secret Passage per-type lookup (issue #30)", () => {
  it("Pyramid uses its own distinct table (roll 2 is a Trap, unlike the shared table's 'nothing')", () => {
    const next = dungeonReducer(roomState("pyramid"), {
      type: "ROLL_SECRET_PASSAGE",
      segId: 1,
      roll: 2,
      trapRoll: null,
    });
    expect(next.levels[0]!.segments[0]!.secretPassageResult).toBe("You have activated a Trap!");
  });

  it("Necropolis uses its own distinct table (roll 5 is a Staircase, unlike the shared table's Chest)", () => {
    const next = dungeonReducer(roomState("necropolis"), {
      type: "ROLL_SECRET_PASSAGE",
      segId: 1,
      roll: 5,
      trapRoll: null,
    });
    expect(next.levels[0]!.segments[0]!.secretPassageResult).toBe("A secret door to a Staircase.");
  });

  it("Citadel and Ziggurat fall back to the shared table (their own printed tables match it exactly)", () => {
    const citadel = dungeonReducer(roomState("citadel"), {
      type: "ROLL_SECRET_PASSAGE",
      segId: 1,
      roll: 2,
      trapRoll: null,
    });
    expect(citadel.levels[0]!.segments[0]!.secretPassageResult).toBe("There's nothing here.");

    const ziggurat = dungeonReducer(roomState("ziggurat"), {
      type: "ROLL_SECRET_PASSAGE",
      segId: 1,
      roll: 2,
      trapRoll: null,
    });
    expect(ziggurat.levels[0]!.segments[0]!.secretPassageResult).toBe("There's nothing here.");
  });
});

describe("table completeness (issue #30): Citadel/Pyramid/Ziggurat/Necropolis", () => {
  it("every new type has full Trap (1-6), Room Content/Monsters (2-12), Treasure/Wonders/MagicItem (1-6), and Weapon (1-6) tables", () => {
    for (const key of ["citadel", "pyramid", "ziggurat", "necropolis"] as const) {
      const tables = DUNGEON_TABLES[key];
      for (let roll = 1; roll <= 6; roll++) {
        expect(tables.trap[roll], `${key} trap ${roll}`).toBeDefined();
        expect(tables.treasure[roll], `${key} treasure ${roll}`).toBeDefined();
        expect(tables.wonders[roll], `${key} wonders ${roll}`).toBeDefined();
        expect(tables.magicItem[roll], `${key} magicItem ${roll}`).toBeDefined();
        expect(tables.weapon[roll], `${key} weapon ${roll}`).toBeDefined();
      }
      for (let sum = 2; sum <= 12; sum++) {
        expect(tables.roomContent[sum], `${key} roomContent ${sum}`).toBeDefined();
        expect(tables.monsters[sum] !== undefined, `${key} monsters ${sum}`).toBe(true);
      }
    }
  });

  it("Citadel and Ziggurat have a full flat Boss (1-6) table; Necropolis deliberately doesn't (3-part combinator instead)", () => {
    for (const key of ["citadel", "pyramid", "ziggurat"] as const) {
      for (let roll = 1; roll <= 6; roll++) {
        expect(DUNGEON_TABLES[key].boss?.[roll], `${key} boss ${roll}`).toBeDefined();
      }
    }
    expect(DUNGEON_TABLES.necropolis.boss).toBeUndefined();
  });

  it("Citadel and Necropolis each have a full bossBonusLoot (1-6) Hallows table; Pyramid/Ziggurat deliberately don't", () => {
    for (let roll = 1; roll <= 6; roll++) {
      expect(
        DUNGEON_TABLES.citadel.bossBonusLoot?.[roll],
        `citadel bossBonusLoot ${roll}`,
      ).toBeDefined();
      expect(
        DUNGEON_TABLES.necropolis.bossBonusLoot?.[roll],
        `necropolis bossBonusLoot ${roll}`,
      ).toBeDefined();
    }
    expect(DUNGEON_TABLES.pyramid.bossBonusLoot).toBeUndefined();
    expect(DUNGEON_TABLES.ziggurat.bossBonusLoot).toBeUndefined();
  });
});
