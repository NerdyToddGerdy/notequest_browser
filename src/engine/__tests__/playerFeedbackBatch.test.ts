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
  type Consumable,
  type DungeonState,
  type SegmentState,
} from "../dungeonState.ts";
import { hireHireling } from "../hirelings.ts";
import {
  armorWorth,
  buyLamp,
  canDrinkConsumable,
  drinkConsumable,
  packUsedSlots,
  canBuyLamp,
  createInitialMilestones,
  createInitialTravelStats,
  equipmentSaleWorth,
  ownsLamp,
  sellEquipment,
  weaponWorth,
  type AdventurerResources,
} from "../town.ts";
import { createInitialWorldState, ownedBuildings, withBuilding } from "../hexState.ts";
import { buildingTaxTotal } from "../../data/buildings.ts";
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
    consumables: [],
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
    consumables: [],
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
    // Collector and Assassin came off this list in v2.55.0 (issue #103).
    expect(flavorOnly).toEqual(["Ambidextrous", "Cook", "Emperor", "Ghostbuster", "Multidextrous"]);
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
      consumables: [],
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

describe("issue #117: gear can be sold", () => {
  const BREASTPLATE = { piece: "breastplate" as const, hp: 10, maxHp: 10 };
  const RING = { piece: "ring" as const, hp: 0, maxHp: 0 };

  it("prices armor at its HP, floored at 1 so nothing is worthless", () => {
    expect(armorWorth(BREASTPLATE)).toBe(10);
    expect(armorWorth({ piece: "boots", hp: 3, maxHp: 3 })).toBe(3);
    expect(armorWorth(RING)).toBe(1); // a Ring is 0 HP by the rulebook's own table
  });

  it("prices a weapon off its damage formula, the one number the rulebook gives it", () => {
    expect(weaponWorth({ name: "Dagger", formula: "1d6-1" })).toBe(2);
    expect(weaponWorth({ name: "Sword", formula: "1d6" })).toBe(3);
    expect(weaponWorth({ name: "Great Sword", formula: "1d6+2" })).toBe(5);
    expect(weaponWorth({ name: "Halberd", formula: "1d6+3" })).toBe(6);
  });

  it("sells a benched spare piece, which previously had no way out of the list at all", () => {
    const before = makeResources({ coins: 0, spareArmor: [BREASTPLATE] });
    const target = { list: "spareArmor" as const, index: 0 };
    expect(equipmentSaleWorth(before, target)).toBe(10);
    const after = sellEquipment(before, target);
    expect(after.coins).toBe(10);
    expect(after.spareArmor).toEqual([]);
    expect(after.milestones.hasSoldItem).toBe(true); // Merchant's requirement, like sellItem
  });

  it("sells the equipped weapon safely -- it's an override, so the class weapon takes back over", () => {
    const before = makeResources({ coins: 0, weapon: { name: "Sword", formula: "1d6" } });
    const after = sellEquipment(before, { list: "weapon", index: 0 });
    expect(after.coins).toBe(3);
    expect(after.weapon).toBeNull();
  });

  it("removes only the piece sold, leaving the rest of the list in order", () => {
    const before = makeResources({
      armor: [RING, BREASTPLATE, { piece: "helm", hp: 4, maxHp: 4 }],
    });
    const after = sellEquipment(before, { list: "armor", index: 1 });
    expect(after.armor.map((p) => p.piece)).toEqual(["ring", "helm"]);
  });

  it("stacks the Fortress and Merchant multipliers exactly like the Pack's own sell action", () => {
    const before = makeResources({ coins: 0, spareArmor: [BREASTPLATE] });
    const target = { list: "spareArmor" as const, index: 0 };
    expect(equipmentSaleWorth(before, target, { isFortress: true })).toBe(20);
    expect(equipmentSaleWorth(before, target, { isDoubler: true })).toBe(20);
    expect(equipmentSaleWorth(before, target, { isDoubler: true, isFortress: true })).toBe(40);
  });

  it("is a no-op on an empty slot rather than crediting anything", () => {
    const before = makeResources({ coins: 7 });
    expect(equipmentSaleWorth(before, { list: "weapon", index: 0 })).toBeNull();
    expect(sellEquipment(before, { list: "weapon", index: 0 })).toEqual(before);
    expect(sellEquipment(before, { list: "spareArmor", index: 3 }).coins).toBe(7);
  });
});

describe("issue #103: Collector", () => {
  it("floors a cheap piece at 5 coins, which is the whole of its ability", () => {
    expect(armorWorth({ piece: "ring", hp: 0, maxHp: 0 }, true)).toBe(5);
    expect(armorWorth({ piece: "boots", hp: 3, maxHp: 3 }, true)).toBe(5);
  });

  it("doesn't double-count on a piece already worth more than 5", () => {
    expect(armorWorth({ piece: "breastplate", hp: 10, maxHp: 10 }, true)).toBe(10);
  });

  it("applies through the sale itself, and still stacks with the place and the seller", () => {
    const before = makeResources({ coins: 0, spareArmor: [{ piece: "ring", hp: 0, maxHp: 0 }] });
    const target = { list: "spareArmor" as const, index: 0 };
    expect(equipmentSaleWorth(before, target, { isCollector: true })).toBe(5);
    expect(equipmentSaleWorth(before, target, { isCollector: true, isFortress: true })).toBe(10);
    expect(sellEquipment(before, target, { isCollector: true }).coins).toBe(5);
  });

  it("changes nothing for a weapon -- the ability names armor specifically", () => {
    const weapon = { name: "Dagger", formula: "1d6-1" };
    const before = makeResources({ coins: 0, spareWeapons: [weapon] });
    const target = { list: "spareWeapons" as const, index: 0 };
    expect(equipmentSaleWorth(before, target, { isCollector: true })).toBe(2);
  });
});

describe("issue #103: Assassin", () => {
  /** One weapon attack for `roll`, against a monster tough enough to survive a tripled hit. */
  function strike(state: DungeonState, roll: number): DungeonState {
    return dungeonReducer(state, { type: "PLAYER_ATTACK", targetId: 1, roll });
  }

  function fight(advancedClasses: string[], overrides: Partial<DungeonState> = {}): DungeonState {
    return palaceState({
      advancedClasses,
      weaponFormula: "1d6",
      combat: makeCombat({
        monsters: [
          {
            id: 1,
            name: "Aberration",
            hp: 60,
            maxHp: 60,
            damage: 0,
            abilities: [],
            bonusDamage: 0,
            deathtouchPending: false,
            paralyzePending: 0,
            skipNextAttack: false,
            silencedTurns: 0,
          },
        ],
      }),
      ...overrides,
    });
  }

  it("triples the first hit of the fight", () => {
    const plain = strike(fight([]), 4);
    const assassin = strike(fight(["Assassin"]), 4);
    expect(60 - plain.combat!.monsters[0]!.hp).toBe(4);
    expect(60 - assassin.combat!.monsters[0]!.hp).toBe(12);
  });

  it("only the first -- the second hit of the same fight is ordinary", () => {
    const first = strike(fight(["Assassin"]), 4);
    expect(first.combat!.playerHasAttacked).toBe(true);
    const second = strike(first, 4);
    // 12 from the opener, then 4.
    expect(60 - second.combat!.monsters[0]!.hp).toBe(16);
  });

  it("is per fight, not per monster -- a second target gets no opener", () => {
    const twoMonsters = fight(["Assassin"]);
    const withPair: DungeonState = {
      ...twoMonsters,
      combat: {
        ...twoMonsters.combat!,
        monsters: [
          twoMonsters.combat!.monsters[0]!,
          { ...twoMonsters.combat!.monsters[0]!, id: 2, name: "Aberration II" },
        ],
      },
    };
    const first = strike(withPair, 4);
    const second = dungeonReducer(first, { type: "PLAYER_ATTACK", targetId: 2, roll: 4 });
    expect(60 - second.combat!.monsters[0]!.hp).toBe(12); // the opener
    expect(60 - second.combat!.monsters[1]!.hp).toBe(4); // an ordinary hit
  });

  it("applies to a Rinoceroid's horn too -- it's the character's training, not the weapon's", () => {
    const horned = fight(["Assassin"], { raceName: "Rinoceroid" });
    const next = dungeonReducer(horned, {
      type: "PLAYER_ATTACK",
      targetId: 1,
      roll: 4,
      useHorn: true,
    });
    expect(60 - next.combat!.monsters[0]!.hp).toBe(12);
  });

  it("a paralyzed turn isn't an attack, so the opener survives it", () => {
    const paralyzed = fight(["Assassin"]);
    const withParalysis: DungeonState = {
      ...paralyzed,
      combat: { ...paralyzed.combat!, paralyzedTurns: 1 },
    };
    const skipped = strike(withParalysis, 4);
    expect(skipped.combat!.playerHasAttacked ?? false).toBe(false);
    const opener = strike(skipped, 4);
    expect(60 - opener.combat!.monsters[0]!.hp).toBe(12);
  });

  it("a fight persisted before this field existed reads as 'not yet struck'", () => {
    const legacy = fight(["Assassin"]);
    expect(legacy.combat!.playerHasAttacked).toBeUndefined();
    expect(60 - strike(legacy, 4).combat!.monsters[0]!.hp).toBe(12);
  });
});

describe("issue #110: potions are held, not drunk on discovery", () => {
  function potionState(overrides: Partial<DungeonState> = {}): DungeonState {
    return palaceState({ treasures: 1, hp: 12, maxHp: 20, ...overrides });
  }

  it("stows a Health Potion found at full HP instead of wasting it", () => {
    const full = dungeonReducer(potionState({ hp: 20 }), { type: "OPEN_TREASURE", roll: 2 });
    expect(full.hp).toBe(20);
    expect(full.consumables).toHaveLength(1);
    // ...and it's still there to drink after taking damage.
    const hurt: DungeonState = { ...full, hp: 5 };
    expect(dungeonReducer(hurt, { type: "USE_CONSUMABLE", index: 0 }).hp).toBe(20);
  });

  it("names the potion from its printed text, dropping the effect parenthetical", () => {
    const found = dungeonReducer(potionState(), { type: "OPEN_TREASURE", roll: 2 });
    expect(found.consumables![0]!.name).toBe("Health Potion");
    expect(found.consumables![0]!.text).toContain("Recovers all HP");
  });

  it("keeps a Potion of Fury for the next fight rather than discarding it", () => {
    const found = dungeonReducer(potionState(), { type: "OPEN_TREASURE", roll: 5 }, fixedDie(5));
    expect(found.consumables![0]!.effect).toEqual({ kind: "combatDamageBonus", amount: 2 });
    const fighting: DungeonState = { ...found, combat: makeCombat() };
    const drunk = dungeonReducer(fighting, { type: "USE_CONSUMABLE", index: 0 });
    expect(drunk.combat!.playerDamageBonus).toBe(2);
  });

  it("drinking consumes the combat round, like casting a spell", () => {
    const found = dungeonReducer(potionState(), { type: "OPEN_TREASURE", roll: 2 });
    const fighting: DungeonState = { ...found, hp: 12, combat: makeCombat() };
    const drunk = dungeonReducer(fighting, { type: "USE_CONSUMABLE", index: 0 });
    // Healed to full, then the monster hit back -- the round ended.
    expect(drunk.hp).toBeLessThan(20);
    expect(drunk.consumables).toEqual([]);
  });

  it("is a no-op on an index that holds nothing", () => {
    const state = potionState();
    expect(dungeonReducer(state, { type: "USE_CONSUMABLE", index: 0 })).toEqual(state);
  });

  it("discards one without drinking it, and not during a fight", () => {
    const found = dungeonReducer(potionState(), { type: "OPEN_TREASURE", roll: 2 });
    const dropped = dungeonReducer(found, { type: "DISCARD_CONSUMABLE", index: 0 });
    expect(dropped.consumables).toEqual([]);
    expect(dropped.hp).toBe(12); // not drunk on the way out

    const fighting: DungeonState = { ...found, combat: makeCombat() };
    expect(
      dungeonReducer(fighting, { type: "DISCARD_CONSUMABLE", index: 0 }).consumables,
    ).toHaveLength(1);
  });

  it("shares the Pack's slots with sellables, per the rulebook's one 10-item backpack", () => {
    const nearlyFull = potionState({
      heldItems: Array.from({ length: 9 }, (_, i) => ({ name: `Trinket ${i}`, worth: 1 })),
    });
    const found = dungeonReducer(nearlyFull, { type: "OPEN_TREASURE", roll: 2 });
    expect(found.consumables).toHaveLength(1); // the 10th slot

    // At 10 used, a further potion has nowhere to go, so it degrades to the old behavior -- drunk on
    // the spot rather than lost.
    const full: DungeonState = { ...found, treasures: 1, hp: 5 };
    const overflowed = dungeonReducer(full, { type: "OPEN_TREASURE", roll: 2 });
    expect(overflowed.consumables).toHaveLength(1); // unchanged
    expect(overflowed.hp).toBe(20); // drunk where they stood
  });

  it("an Ogre still sells a potion instead of ever holding one (issue #83)", () => {
    const ogre = dungeonReducer(potionState({ raceName: "Ogre" }), {
      type: "OPEN_TREASURE",
      roll: 2,
    });
    expect(ogre.consumables ?? []).toEqual([]);
    expect(ogre.heldItems).toEqual([{ name: "Health Potion", worth: 3 }]);
  });

  it("a fallen character's undrunk potions are left in their remains, not lost", () => {
    // The Darkness is the deterministic death: no torch left to enter with.
    const carrying = potionState({
      torches: 0,
      coins: 0,
      treasures: 0,
      consumables: [{ name: "Health Potion", text: "Health Potion.", effect: { kind: "healAll" } }],
    });
    const dead = dungeonReducer(carrying, {
      type: "ROLL_DUNGEON",
      typeRoll: 1,
      nameRolls: [3, 3, 3],
    });
    expect(dead.alive).toBe(false);
    expect(dead.levels[0]!.segments[0]!.remains?.consumables).toEqual([
      { name: "Health Potion", text: "Health Potion.", effect: { kind: "healAll" } },
    ]);
  });

  it("recovers those potions when a later character collects the remains", () => {
    const withRemains = palaceState();
    withRemains.levels[0]!.segments[0]!.remains = {
      names: ["Doomed Dara"],
      coins: 0,
      treasures: 0,
      keys: 0,
      heldItems: [],
      consumables: [{ name: "Health Potion", text: "Health Potion.", effect: { kind: "healAll" } }],
      armor: [],
      spareArmor: [],
      weapon: null,
      weapons: [],
    };
    const next = dungeonReducer(withRemains, { type: "COLLECT_REMAINS", segId: 1 });
    expect(next.consumables).toHaveLength(1);
    expect(next.levels[0]!.segments[0]!.remains).toBeNull();
  });

  it("out in Town, drinking works and Potion of Fury is refused rather than wasted", () => {
    const healer: Consumable = {
      name: "Health Potion",
      text: "Health Potion.",
      effect: { kind: "healAll" },
    };
    const fury: Consumable = {
      name: "Potion of Fury",
      text: "Potion of Fury.",
      effect: { kind: "combatDamageBonus", amount: 2 },
    };
    const resources = makeResources({ hp: 4, maxHp: 20, consumables: [healer, fury] });
    expect(canDrinkConsumable(resources, 0)).toBe(true);
    expect(canDrinkConsumable(resources, 1)).toBe(false); // no fight out here

    const healed = drinkConsumable(resources, 0);
    expect(healed.hp).toBe(20);
    expect(healed.consumables).toEqual([fury]);
    // Refused, not silently consumed.
    expect(drinkConsumable(resources, 1)).toEqual(resources);
  });

  it("counts potions and sellables together for the Pack's own capacity readout", () => {
    const resources = makeResources({
      heldItems: [{ name: "Jewel", worth: 20 }],
      consumables: [{ name: "Health Potion", text: "x", effect: { kind: "healAll" } }],
    });
    expect(packUsedSlots(resources)).toBe(2);
  });
});

describe("issue #121: buildings outlive their builder", () => {
  it("derives the owned list from the map, which is where a Castle actually stands", () => {
    const world = createInitialWorldState(fixedDie(3));
    const built = withBuilding(
      withBuilding(world, { q: 0, r: 0 }, "Castle"),
      { q: 1, r: 0 },
      "Tower",
    );
    expect(ownedBuildings(built)).toEqual(
      expect.arrayContaining([
        { hexKey: "0,0", kind: "Castle" },
        { hexKey: "1,0", kind: "Tower" },
      ]),
    );
  });

  it("is empty for a world nobody has built on", () => {
    expect(ownedBuildings(createInitialWorldState(fixedDie(3)))).toEqual([]);
  });

  it("still pays the Boss-kill tax to whoever inherits it", () => {
    const world = withBuilding(createInitialWorldState(fixedDie(3)), { q: 0, r: 0 }, "Castle");
    // The tax reads the same OwnedBuilding[] shape, so an inherited estate pays exactly as one you
    // bought yourself would.
    expect(buildingTaxTotal(ownedBuildings(world).map((b) => b.kind))).toBeGreaterThan(0);
  });
});
