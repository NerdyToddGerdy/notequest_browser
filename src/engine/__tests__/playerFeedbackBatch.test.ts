import { describe, expect, it } from "vitest";
import { DUNGEON_TABLES, substituteItemPlaceholder } from "../../data/dungeonTables.ts";
import { ADVANCED_CLASS_TABLE } from "../../data/advancedClasses.ts";
import { HIRELING_BY_NAME } from "../../data/hirelings.ts";
import { hasImplementedAbility, isAdvancedClassTrackable } from "../advancedClasses.ts";
import { dungeonReducer } from "../dungeonReducer.ts";
import {
  createInitialDungeonState,
  makeLevel,
  type CombatState,
  type DungeonState,
  type SegmentState,
} from "../dungeonState.ts";
import { hireHireling } from "../hirelings.ts";
import {
  buyLamp,
  canBuyLamp,
  createInitialMilestones,
  createInitialTravelStats,
  ownsLamp,
  type AdventurerResources,
} from "../town.ts";
import { fixedDie, sequenceDie } from "../../test/mulberry32.ts";

/** The batch of defects reported by a player in real play (issues #109/#111/#114/#115/#116). Every
 * test here starts from something a player actually hit, so each one names the symptom rather than
 * just the mechanism. */

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

function makeCombat(overrides: Partial<CombatState> = {}): CombatState {
  return {
    segId: 1,
    monsters: [
      {
        id: 1,
        name: "Orc",
        hp: 8,
        maxHp: 8,
        damage: 4,
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
    isBoss: false,
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
    ...overrides,
  };
}

/** A persisted run with an interrupted fight, which is what `restoreMapFromPersisted()` respawns
 * through `startCombat()` -- the one realistic path that exercises the Hireling's own seeding. */
function stateWithInterruptedFight(hirelingHp: number | null): DungeonState {
  const seg = makeSegment({
    id: 1,
    type: "room-medium",
    doors: [],
    isEntrance: true,
    monsters: { name: "Orc", hp: 8, damage: 4, abilities: [], count: 1 },
  });
  return {
    ...palaceState({ hireling: "Torchbearer", hirelingHp }),
    levels: [{ ...makeLevel(0), segments: [seg] }],
  };
}

function resumeSameTrip(persisted: DungeonState, hirelingHp: number | null): DungeonState {
  return dungeonReducer(createInitialDungeonState(), {
    type: "RETURN_TO_DUNGEON",
    dungeon: persisted,
    torches: 5,
    hp: 10,
    maxHp: 10,
    coins: 0,
    treasures: 0,
    keys: 0,
    heldItems: [],
    armor: [],
    weapon: null,
    spareWeapons: [],
    spareArmor: [],
    weaponFormula: "1d6",
    spellUses: {},
    maxSpellUses: {},
    characterName: "Pip",
    raceName: "Human",
    className: "Fighter",
    monsterKills: 0,
    bossKills: 0,
    killsByName: {},
    killsByAbility: {},
    advancedClasses: [],
    hireling: "Torchbearer",
    hirelingHp,
    animals: [],
    milestones: createInitialMilestones(),
    buildings: [],
  });
}

function palaceState(overrides: Partial<DungeonState> = {}): DungeonState {
  const level = {
    ...makeLevel(0),
    segments: [makeSegment({ id: 1, type: "room-medium", doors: [], isEntrance: true })],
  };
  return {
    ...createInitialDungeonState(),
    dungeonTypeKey: "palace",
    levels: [level],
    activeLevel: 0,
    selectedSegId: 1,
    currentSegId: 1,
    nextSegmentId: 100,
    ...overrides,
  };
}

function makeResources(overrides: Partial<AdventurerResources> = {}): AdventurerResources {
  return {
    torches: 5,
    hp: 20,
    maxHp: 20,
    coins: 1000,
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
    hirelingHp: null,
    curiosities: {},
    animals: [],
    milestones: createInitialMilestones(),
    buildings: [],
    troops: 0,
    troopSources: [],
    travelStats: createInitialTravelStats(),
    survivedRunIds: [],
    flyActive: false,
    catatonic: false,
    mutations: [],
    zombieRevivals: 0,
    nextDungeonDamageBonus: 0,
    ...overrides,
  };
}

describe("issue #114: a Hireling is not a free meat shield", () => {
  /** Absorbs `damage` onto the Hireling and returns the resulting state. */
  function absorb(hirelingHp: number, damage: number): DungeonState {
    const state = palaceState({
      hireling: "Torchbearer",
      hirelingHp,
      combat: makeCombat({
        hireling: { name: "Torchbearer", hp: hirelingHp, maxHp: TORCHBEARER_HP },
        pendingDamage: damage,
      }),
    });
    return dungeonReducer(state, { type: "RESOLVE_DAMAGE", absorbWith: "hireling" });
  }

  const TORCHBEARER_HP = HIRELING_BY_NAME["Torchbearer"]!.hp;

  it("hiring one sets its HP, so nothing has to infer 'full' from the data table later", () => {
    const hired = hireHireling(makeResources(), "Torchbearer", "human", false);
    expect(hired.hireling).toBe("Torchbearer");
    expect(hired.hirelingHp).toBe(TORCHBEARER_HP);
  });

  it("absorbing damage writes the loss back, so it outlives the fight it happened in", () => {
    const after = absorb(TORCHBEARER_HP, 3);
    expect(after.hirelingHp).toBe(TORCHBEARER_HP - 3);
    expect(after.hp).toBe(20); // the player took none of it
  });

  it("a later fight starts the Hireling where the last one left it, not at full", () => {
    const wounded = resumeSameTrip(stateWithInterruptedFight(2), 2);
    // The exploit was this reading HIRELING_BY_NAME["Torchbearer"].hp instead.
    expect(wounded.combat?.hireling).toEqual({ name: "Torchbearer", hp: 2, maxHp: TORCHBEARER_HP });
  });

  it("a Hireling hired before this field existed starts at full exactly once", () => {
    const legacy = resumeSameTrip(stateWithInterruptedFight(null), null);
    expect(legacy.combat?.hireling?.hp).toBe(TORCHBEARER_HP);
  });

  it("still can't be revived by grinding it to exactly 0 -- it's gone for good", () => {
    const dead = absorb(TORCHBEARER_HP, TORCHBEARER_HP);
    expect(dead.hireling).toBeNull();
    expect(dead.hirelingHp).toBeNull();
  });

  it("clamps a nonsensically high saved value to the roster's own HP", () => {
    const absurd = resumeSameTrip(stateWithInterruptedFight(999), 999);
    expect(absurd.combat?.hireling?.hp).toBe(TORCHBEARER_HP);
  });

  it("hiring a replacement doesn't inherit the previous Hireling's wounds", () => {
    const wounded = makeResources({ hireling: "Torchbearer", hirelingHp: 1 });
    const replaced = hireHireling(wounded, "Mercenary", "human", false);
    expect(replaced.hireling).toBe("Mercenary");
    expect(replaced.hirelingHp).toBe(HIRELING_BY_NAME["Mercenary"]!.hp);
  });
});

describe("issue #111: an ability that does nothing says so", () => {
  it("marks exactly the acquirable classes whose ability text isn't implemented", () => {
    const flavorOnly = Object.values(ADVANCED_CLASS_TABLE)
      .filter((def) => !hasImplementedAbility(def.name))
      .map((def) => def.name)
      .sort();
    expect(flavorOnly).toEqual([
      "Ambidextrous",
      "Assassin",
      "Collector",
      "Cook",
      "Emperor",
      "Ghostbuster",
      "Multidextrous",
    ]);
  });

  it("never marks a class whose ability text already admits it does nothing", () => {
    for (const def of Object.values(ADVANCED_CLASS_TABLE)) {
      if (def.abilityText === "None.") {
        expect(hasImplementedAbility(def.name), def.name).toBe(true);
      }
    }
  });

  it("is about the ability, not the requirement -- every marked class is really buyable", () => {
    // The whole point: these charge coins and meet their requirements, which is why silence about
    // the ability was misleading. An unbuyable class is already covered by isAdvancedClassTrackable.
    for (const def of Object.values(ADVANCED_CLASS_TABLE)) {
      if (!hasImplementedAbility(def.name)) {
        expect(isAdvancedClassTrackable(def.name), def.name).toBe(true);
        expect(def.cost, def.name).toBeGreaterThan(0);
      }
    }
  });
});

describe("issue #116: a magic item says what it is and where it's worn", () => {
  it("substitutes the placeholder, case-insensitively, and leaves plain names alone", () => {
    expect(substituteItemPlaceholder("[Armor] of Royalty", "Helm")).toBe("Helm of Royalty");
    expect(substituteItemPlaceholder("Leprechaun's [Armor]", "Boots")).toBe("Leprechaun's Boots");
    expect(substituteItemPlaceholder("[Weapon] of Destruction", "Mace")).toBe(
      "Mace of Destruction",
    );
    expect(substituteItemPlaceholder("Master key", "Helm")).toBe("Master key");
  });

  it("stores the concrete name on the worn piece, not the template", () => {
    // Palace magicItem roll 3 -> "Centurion's [Armor]" (+1 HP); base Armor roll 3 -> Boots (3 HP).
    const next = dungeonReducer(
      palaceState({ treasures: 1 }),
      { type: "OPEN_TREASURE", roll: 6 },
      fixedDie(3),
    );
    expect(next.armor[0]!.itemName).toBe("Centurion's Boots");
    expect(next.armor[0]!.piece).toBe("boots");
  });

  it("keeps the item's own name on a weapon instead of discarding it for the base weapon", () => {
    // magicItem roll 4 -> "[Weapon] of Destruction"; Palace's base weapon roll 4 -> Whip.
    const next = dungeonReducer(
      palaceState({ treasures: 1 }),
      { type: "OPEN_TREASURE", roll: 6 },
      fixedDie(4),
    );
    expect(next.spareWeapons[0]!.name).toBe("Whip of Destruction");
    expect(next.spareWeapons[0]!.formula).toBe("1d6+1");
  });

  it("leaves no template in any authored Magic Item's stored name, for any dungeon type", () => {
    // A regression net: a new type's table can't reintroduce an unsubstituted placeholder without
    // this failing, since every one of these goes through the same two grant branches.
    for (const [key, tables] of Object.entries(DUNGEON_TABLES)) {
      for (let roll = 1; roll <= 6; roll++) {
        const entry = tables.magicItem[roll]!;
        const concrete = substituteItemPlaceholder(entry.name, "Helm");
        expect(concrete, `${key} magicItem ${roll}`).not.toMatch(/\[(Armor|Weapon)\]/i);
      }
    }
  });
});

describe("issues #109/#115: a flavor item lands in Curiosities instead of vanishing", () => {
  it("tallies a pure-flavor Wonder that previously granted nothing at all", () => {
    // Crypt treasure roll 5 -> the Wonders column; Wonders roll 3 is Crypt's Salamander Potion.
    const state: DungeonState = { ...palaceState({ treasures: 1 }), dungeonTypeKey: "crypt" };
    const wonderRoll = Object.entries(DUNGEON_TABLES.crypt.wonders).find(
      ([, w]) => w.effect.kind === "flavor" && w.grantsHp === undefined,
    );
    expect(wonderRoll).toBeDefined();
    const [roll, entry] = wonderRoll!;
    const next = dungeonReducer(
      state,
      { type: "OPEN_TREASURE", roll: 5 },
      sequenceDie([Number(roll)]),
    );
    expect(next.curiosities).toEqual({ [entry.name]: 1 });
    // It's a keepsake, not gear: nothing in the Pack, nothing worn, no HP.
    expect(next.heldItems).toEqual([]);
    expect(next.armor).toEqual([]);
  });

  it("counts repeats, which is the entire point of '4 arms and 3 tails'", () => {
    const state: DungeonState = { ...palaceState({ treasures: 3 }), dungeonTypeKey: "crypt" };
    const [roll, entry] = Object.entries(DUNGEON_TABLES.crypt.wonders).find(
      ([, w]) => w.effect.kind === "flavor" && w.grantsHp === undefined,
    )!;
    let next = state;
    for (let i = 0; i < 3; i++) {
      next = dungeonReducer(next, { type: "OPEN_TREASURE", roll: 5 }, sequenceDie([Number(roll)]));
    }
    expect(next.curiosities).toEqual({ [entry.name]: 3 });
  });

  it("tallies a flavor potion from the Laboratory's own Potions column", () => {
    const state: DungeonState = { ...palaceState({ treasures: 1 }), dungeonTypeKey: "laboratory" };
    // Treasure 6 -> Potions column; Potions 2 -> Goblin Potion (flavor).
    const next = dungeonReducer(state, { type: "OPEN_TREASURE", roll: 6 }, sequenceDie([2]));
    expect(next.curiosities).toEqual({ "Goblin Potion": 1 });
  });

  it("a mechanically-real Wonder is still worn, not tallied as a curiosity", () => {
    // The Laboratory's Wonders column has HP-bearing entries (Alchemist's Mask, 3 HP).
    const state: DungeonState = { ...palaceState({ treasures: 1 }), dungeonTypeKey: "laboratory" };
    const [roll] = Object.entries(DUNGEON_TABLES.laboratory.wonders).find(
      ([, w]) => w.grantsHp !== undefined,
    )!;
    const next = dungeonReducer(
      state,
      { type: "OPEN_TREASURE", roll: 5 },
      sequenceDie([Number(roll)]),
    );
    expect(next.curiosities ?? {}).toEqual({});
    expect(next.armor).toHaveLength(1);
  });

  it("carries the tally across a resumed trip rather than resetting it", () => {
    const persisted: DungeonState = { ...palaceState(), curiosities: { "Goblin Whistle": 2 } };
    const returned = dungeonReducer(createInitialDungeonState(), {
      type: "RETURN_TO_DUNGEON",
      dungeon: persisted,
      torches: 5,
      hp: 10,
      maxHp: 10,
      coins: 0,
      treasures: 0,
      keys: 0,
      heldItems: [],
      armor: [],
      weapon: null,
      spareWeapons: [],
      spareArmor: [],
      weaponFormula: "1d6",
      spellUses: {},
      maxSpellUses: {},
      characterName: "Pip",
      raceName: "Human",
      className: "Fighter",
      curiosities: { "Goblin Whistle": 2 },
      monsterKills: 0,
      bossKills: 0,
      killsByName: {},
      killsByAbility: {},
      advancedClasses: [],
      hireling: null,
      animals: [],
      milestones: createInitialMilestones(),
      buildings: [],
    });
    expect(returned.curiosities).toEqual({ "Goblin Whistle": 2 });
  });

  it("a new character taking over a dead one's map brings their own, not the dead one's", () => {
    const persisted: DungeonState = { ...palaceState(), curiosities: { "Goblin Whistle": 2 } };
    const resumed = dungeonReducer(createInitialDungeonState(), {
      type: "RESUME_DUNGEON",
      dungeon: persisted,
      torches: 5,
      hp: 10,
      maxHp: 10,
      weaponFormula: "1d6",
      spellUses: {},
      maxSpellUses: {},
      characterName: "Newcomer",
      raceName: "Human",
      className: "Fighter",
    });
    expect(resumed.curiosities).toEqual({});
  });
});

describe("issue #109: the Dwarven Lamp is one per character", () => {
  it("can be bought once", () => {
    const before = makeResources({ coins: 100 });
    expect(canBuyLamp(before)).toBe(true);
    const after = buyLamp(before);
    expect(ownsLamp(after)).toBe(true);
    expect(after.coins).toBe(60);
  });

  it("cannot be bought again, however many coins are left", () => {
    const owner = buyLamp(makeResources({ coins: 1000 }));
    expect(canBuyLamp(owner)).toBe(false);
  });

  it("is still gated on affording it", () => {
    expect(canBuyLamp(makeResources({ coins: 39 }))).toBe(false);
  });
});
