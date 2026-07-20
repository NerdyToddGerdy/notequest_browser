import { describe, expect, it } from "vitest";
import {
  buyElvenBoots,
  buyLamp,
  buyOrcGladio,
  buyProvision,
  buyTorch,
  canBuyElvenBoots,
  canBuyLamp,
  canBuyOrcGladio,
  canBuyProvision,
  canBuyTorch,
  canCastSpell,
  canDrinkVerdosaPotion,
  canFixArmor,
  canHardWork,
  canHireBoat,
  canLearnRandomSpell,
  canRemoveCurse,
  canRest,
  castSpell,
  drinkVerdosaPotion,
  fixArmor,
  gamble,
  hardWork,
  hasElvenBoots,
  hireBoat,
  learnRandomSpell,
  payTravelCost,
  removeCurse,
  resolveThugLife,
  rest,
  sellItem,
  wieldWeapon,
  type AdventurerResources,
} from "../town.ts";
import { sequenceDie } from "../../test/mulberry32.ts";

function makeResources(overrides: Partial<AdventurerResources> = {}): AdventurerResources {
  return {
    torches: 5,
    hp: 10,
    maxHp: 20,
    coins: 3,
    treasures: 0,
    keys: 0,
    heldItems: [],
    armor: [],
    weapon: null,
    spareWeapons: [],
    spellUses: { "basic:1": 0 },
    monsterKills: 0,
    bossKills: 0,
    killsByName: {},
    killsByAbility: {},
    provisions: 10,
    ...overrides,
  };
}

describe("canRest / rest", () => {
  it("requires at least 1 coin", () => {
    expect(canRest(makeResources({ coins: 0, hp: 10, maxHp: 20 }), { 1: 3 })).toBe(false);
    expect(canRest(makeResources({ coins: 1, hp: 10, maxHp: 20 }), { 1: 3 })).toBe(true);
  });

  it("stays true below max HP regardless of spell uses", () => {
    expect(
      canRest(makeResources({ coins: 1, hp: 10, maxHp: 20, spellUses: { 1: 3 } }), { 1: 3 }),
    ).toBe(true);
  });

  it("is false at full HP with every spell already at max uses", () => {
    expect(
      canRest(makeResources({ coins: 1, hp: 20, maxHp: 20, spellUses: { 1: 3, 2: 2 } }), {
        1: 3,
        2: 2,
      }),
    ).toBe(false);
  });

  it("is true at full HP if any spell still has used-up uses to recover", () => {
    expect(
      canRest(makeResources({ coins: 1, hp: 20, maxHp: 20, spellUses: { 1: 1, 2: 2 } }), {
        1: 3,
        2: 2,
      }),
    ).toBe(true);
  });

  it("spends 1 coin, heals to max, and restores every spell to its max uses", () => {
    const resources = makeResources({ coins: 3, hp: 10, maxHp: 20, spellUses: { 1: 0, 2: 1 } });
    const next = rest(resources, { 1: 3, 2: 2 });
    expect(next.coins).toBe(2);
    expect(next.hp).toBe(20);
    expect(next.spellUses).toEqual({ 1: 3, 2: 2 });
  });
});

describe("canBuyTorch / buyTorch", () => {
  it("requires at least 1 coin and fewer than 10 torches", () => {
    expect(canBuyTorch(makeResources({ coins: 0, torches: 5 }))).toBe(false);
    expect(canBuyTorch(makeResources({ coins: 1, torches: 10 }))).toBe(false);
    expect(canBuyTorch(makeResources({ coins: 1, torches: 9 }))).toBe(true);
  });

  it("spends 1 coin and adds 1 torch, capped at 10", () => {
    const next = buyTorch(makeResources({ coins: 2, torches: 5 }));
    expect(next.coins).toBe(1);
    expect(next.torches).toBe(6);

    const capped = buyTorch(makeResources({ coins: 2, torches: 10 }));
    expect(capped.torches).toBe(10);
  });
});

describe("sellItem", () => {
  it("credits the item's worth in coins and removes it from the pack", () => {
    const resources = makeResources({
      coins: 0,
      heldItems: [
        { name: "Ornament", worth: 5 },
        { name: "Valuable jewel", worth: 70 },
      ],
    });
    const next = sellItem(resources, 0);
    expect(next.coins).toBe(5);
    expect(next.heldItems).toEqual([{ name: "Valuable jewel", worth: 70 }]);
  });

  it("is a no-op for an out-of-range index", () => {
    const resources = makeResources({ heldItems: [{ name: "Ornament", worth: 5 }] });
    const next = sellItem(resources, 3);
    expect(next).toEqual(resources);
  });

  it("Cat-Person: sells for double the item's worth", () => {
    const resources = makeResources({ coins: 0, heldItems: [{ name: "Ornament", worth: 5 }] });
    const next = sellItem(resources, 0, true);
    expect(next.coins).toBe(10);
  });
});

describe("canFixArmor / fixArmor", () => {
  it("requires at least 1 coin and a damaged piece", () => {
    const piece = { piece: "boots" as const, hp: 1, maxHp: 3 };
    expect(canFixArmor(makeResources({ coins: 0, armor: [piece] }), 0)).toBe(false);
    expect(canFixArmor(makeResources({ coins: 1, armor: [{ ...piece, hp: 3 }] }), 0)).toBe(false); // already full
    expect(canFixArmor(makeResources({ coins: 1, armor: [piece] }), 0)).toBe(true);
  });

  it("spends 1 coin and restores the piece to its max HP", () => {
    const resources = makeResources({
      coins: 2,
      armor: [
        { piece: "boots", hp: 1, maxHp: 3 },
        { piece: "helm", hp: 0, maxHp: 4 },
      ],
    });
    const next = fixArmor(resources, 1);
    expect(next.coins).toBe(1);
    expect(next.armor).toEqual([
      { piece: "boots", hp: 1, maxHp: 3 },
      { piece: "helm", hp: 4, maxHp: 4 },
    ]);
  });

  it("is a no-op for an out-of-range index", () => {
    const resources = makeResources({ coins: 2, armor: [{ piece: "boots", hp: 1, maxHp: 3 }] });
    const next = fixArmor(resources, 5);
    expect(next).toEqual(resources);
  });

  it("Blacksmith: costs 1 torch instead of 1 coin", () => {
    const piece = { piece: "boots" as const, hp: 1, maxHp: 3 };
    expect(canFixArmor(makeResources({ coins: 0, torches: 0, armor: [piece] }), 0, true)).toBe(
      false,
    );
    expect(canFixArmor(makeResources({ coins: 0, torches: 1, armor: [piece] }), 0, true)).toBe(
      true,
    );

    const resources = makeResources({ coins: 5, torches: 3, armor: [piece] });
    const next = fixArmor(resources, 0, true);
    expect(next.torches).toBe(2);
    expect(next.coins).toBe(5); // untouched
    expect(next.armor).toEqual([{ piece: "boots", hp: 3, maxHp: 3 }]);
  });
});

describe("wieldWeapon", () => {
  it("equips the chosen spare, pushing the previously-equipped weapon back into spareWeapons", () => {
    const resources = makeResources({
      weapon: { name: "Sword", formula: "1d6" },
      spareWeapons: [
        { name: "Dagger", formula: "1d6-1" },
        { name: "Halberd", formula: "1d6+3", twoHanded: true },
      ],
    });
    const next = wieldWeapon(resources, 1);
    expect(next.weapon).toEqual({ name: "Halberd", formula: "1d6+3", twoHanded: true });
    expect(next.spareWeapons).toEqual([
      { name: "Dagger", formula: "1d6-1" },
      { name: "Sword", formula: "1d6" },
    ]);
  });

  it("equips a spare with nothing previously equipped", () => {
    const resources = makeResources({
      weapon: null,
      spareWeapons: [{ name: "Dagger", formula: "1d6-1" }],
    });
    const next = wieldWeapon(resources, 0);
    expect(next.weapon).toEqual({ name: "Dagger", formula: "1d6-1" });
    expect(next.spareWeapons).toEqual([]);
  });

  it("is a no-op for an out-of-range index", () => {
    const resources = makeResources({ spareWeapons: [{ name: "Dagger", formula: "1d6-1" }] });
    const next = wieldWeapon(resources, 5);
    expect(next).toEqual(resources);
  });
});

describe("canCastSpell / castSpell", () => {
  it("only allows Heal (basic:1) and Light (basic:2), and only with uses remaining", () => {
    expect(canCastSpell(makeResources({ spellUses: { "basic:1": 1 } }), "basic", 1)).toBe(true);
    expect(canCastSpell(makeResources({ spellUses: { "basic:1": 0 } }), "basic", 1)).toBe(false);
    expect(canCastSpell(makeResources({ spellUses: { "basic:2": 1 } }), "basic", 2)).toBe(true);
    // Cold Ray/Lightning/Fireball/Teleport all need combat, which neither Town nor World has.
    expect(canCastSpell(makeResources({ spellUses: { "basic:4": 1 } }), "basic", 4)).toBe(false);
  });

  it("Heal recovers 5 HP, capped at maxHp, and spends a use", () => {
    const resources = makeResources({ hp: 10, maxHp: 20, spellUses: { "basic:1": 2 } });
    const next = castSpell(resources, "basic", 1);
    expect(next.hp).toBe(15);
    expect(next.spellUses).toEqual({ "basic:1": 1 });
  });

  it("Heal is capped at maxHp, not overhealing", () => {
    const resources = makeResources({ hp: 18, maxHp: 20, spellUses: { "basic:1": 1 } });
    const next = castSpell(resources, "basic", 1);
    expect(next.hp).toBe(20);
  });

  it("Light grants 1 torch, capped at 10, and spends a use", () => {
    const resources = makeResources({ torches: 5, spellUses: { "basic:2": 1 } });
    const next = castSpell(resources, "basic", 2);
    expect(next.torches).toBe(6);
    expect(next.spellUses).toEqual({ "basic:2": 0 });
  });

  it("Light is capped at 10 torches, still spending the use", () => {
    const resources = makeResources({ torches: 10, spellUses: { "basic:2": 1 } });
    const next = castSpell(resources, "basic", 2);
    expect(next.torches).toBe(10);
    expect(next.spellUses).toEqual({ "basic:2": 0 });
  });

  it("is a no-op with no uses remaining", () => {
    const resources = makeResources({ hp: 10, maxHp: 20, spellUses: { "basic:1": 0 } });
    const next = castSpell(resources, "basic", 1);
    expect(next).toEqual(resources);
  });

  it("is a no-op for a combat-only spell", () => {
    const resources = makeResources({ spellUses: { "basic:5": 1 } });
    const next = castSpell(resources, "basic", 5);
    expect(next).toEqual(resources);
  });
});

describe("canBuyProvision / buyProvision", () => {
  it("requires at least 1 coin and fewer than 20 provisions", () => {
    expect(canBuyProvision(makeResources({ coins: 0, provisions: 10 }))).toBe(false);
    expect(canBuyProvision(makeResources({ coins: 1, provisions: 20 }))).toBe(false);
    expect(canBuyProvision(makeResources({ coins: 1, provisions: 19 }))).toBe(true);
  });

  it("spends 1 coin and adds 1 provision, capped at 20", () => {
    const next = buyProvision(makeResources({ coins: 2, provisions: 10 }));
    expect(next.coins).toBe(1);
    expect(next.provisions).toBe(11);

    const capped = buyProvision(makeResources({ coins: 2, provisions: 20 }));
    expect(capped.provisions).toBe(20);
  });
});

describe("payTravelCost", () => {
  it("just spends provisions when there are enough", () => {
    const next = payTravelCost(makeResources({ provisions: 10, hp: 15 }), 3);
    expect(next.provisions).toBe(7);
    expect(next.hp).toBe(15);
  });

  it("any shortfall costs a flat 1 HP, however small", () => {
    const next = payTravelCost(makeResources({ provisions: 2, hp: 15 }), 3);
    expect(next.provisions).toBe(0);
    expect(next.hp).toBe(14); // 1 provision short -> 1 HP lost
  });

  it("a bigger shortfall still costs only 1 HP, not scaled to the terrain's cost", () => {
    const next = payTravelCost(makeResources({ provisions: 0, hp: 15 }), 3); // e.g. a Mountain move
    expect(next.provisions).toBe(0);
    expect(next.hp).toBe(14); // flat 1 HP, not 3
  });

  it("running out entirely still floors HP at 1, never killing the character", () => {
    const next = payTravelCost(makeResources({ provisions: 0, hp: 1 }), 3);
    expect(next.provisions).toBe(0);
    expect(next.hp).toBe(1);
  });
});

describe("Different Cultures: Human -- Remove Curse", () => {
  it("requires 200 coins and spends them, flavor-only otherwise", () => {
    expect(canRemoveCurse(makeResources({ coins: 199 }))).toBe(false);
    expect(canRemoveCurse(makeResources({ coins: 200 }))).toBe(true);
    const next = removeCurse(makeResources({ coins: 250 }));
    expect(next.coins).toBe(50);
  });
});

describe("Different Cultures: Dwarf -- Buy Lamp", () => {
  it("requires 40 coins and adds a flavor keepsake to the Pack", () => {
    expect(canBuyLamp(makeResources({ coins: 39 }))).toBe(false);
    const next = buyLamp(makeResources({ coins: 40 }));
    expect(next.coins).toBe(0);
    expect(next.heldItems).toEqual([{ name: "Dwarven Lamp", worth: 5 }]);
  });
});

describe("Different Cultures: Elf -- Buy Elven Boots / hasElvenBoots", () => {
  it("requires 60 coins and equips a real 2 HP boots piece", () => {
    expect(canBuyElvenBoots(makeResources({ coins: 59 }))).toBe(false);
    const next = buyElvenBoots(makeResources({ coins: 60 }));
    expect(next.coins).toBe(0);
    expect(next.armor).toEqual([{ piece: "boots", hp: 2, maxHp: 2, itemName: "Elven Boots" }]);
  });

  it("hasElvenBoots matches case-insensitively by itemName, same as monster-tag matching", () => {
    expect(hasElvenBoots(makeResources({ armor: [] }))).toBe(false);
    expect(
      hasElvenBoots(
        makeResources({ armor: [{ piece: "boots", hp: 2, maxHp: 2, itemName: "elven BOOTS" }] }),
      ),
    ).toBe(true);
    expect(hasElvenBoots(makeResources({ armor: [{ piece: "helm", hp: 4, maxHp: 4 }] }))).toBe(
      false,
    );
  });
});

describe("Different Cultures: Gnome -- Learn a Spell", () => {
  it("requires 80 coins and grants 1 use of a rolled spell", () => {
    expect(canLearnRandomSpell(makeResources({ coins: 79 }))).toBe(false);
    const next = learnRandomSpell(makeResources({ coins: 80, spellUses: {} }), sequenceDie([6])); // roll 6 -> Fireball, roll 6
    expect(next.coins).toBe(0);
    expect(next.spellUses).toEqual({ "basic:6": 1 });
  });

  it("stacks onto an existing use of the same spell", () => {
    const next = learnRandomSpell(
      makeResources({ coins: 80, spellUses: { "basic:6": 2 } }),
      sequenceDie([6]),
    );
    expect(next.spellUses).toEqual({ "basic:6": 3 });
  });
});

describe("Different Cultures: Goblin -- Verdosa Potion", () => {
  it("requires 30 coins, always spent regardless of outcome", () => {
    expect(canDrinkVerdosaPotion(makeResources({ coins: 29 }))).toBe(false);
    const { resources } = drinkVerdosaPotion(
      makeResources({ coins: 30, hp: 5, maxHp: 20 }),
      sequenceDie([2]),
    );
    expect(resources.coins).toBe(0);
  });

  it("heals to max HP on a roll of 3 or more", () => {
    const { resources, healed } = drinkVerdosaPotion(
      makeResources({ coins: 30, hp: 5, maxHp: 20 }),
      sequenceDie([3]),
    );
    expect(healed).toBe(true);
    expect(resources.hp).toBe(20);
  });

  it("leaves HP untouched (just itchy, flavor-only) on a roll below 3", () => {
    const { resources, healed } = drinkVerdosaPotion(
      makeResources({ coins: 30, hp: 5, maxHp: 20 }),
      sequenceDie([2]),
    );
    expect(healed).toBe(false);
    expect(resources.hp).toBe(5);
  });
});

describe("Different Cultures: Orc -- Buy Orc Gladio", () => {
  it("requires 70 coins and overwrites the equipped weapon", () => {
    expect(canBuyOrcGladio(makeResources({ coins: 69 }))).toBe(false);
    const next = buyOrcGladio(
      makeResources({ coins: 70, weapon: { name: "Rusty Sword", formula: "1d6-1" } }),
    );
    expect(next.coins).toBe(0);
    expect(next.weapon).toEqual({ name: "Orc Gladio", formula: "1d6+1" });
  });
});

describe("canHireBoat / hireBoat", () => {
  it("requires 1 coin and spends it", () => {
    expect(canHireBoat(makeResources({ coins: 0 }))).toBe(false);
    const next = hireBoat(makeResources({ coins: 3 }));
    expect(next.coins).toBe(2);
  });
});

describe("Getting Money: canHardWork / hardWork", () => {
  it("requires more than 1 maxHp, so it can never zero it out", () => {
    expect(canHardWork(makeResources({ maxHp: 1 }))).toBe(false);
    expect(canHardWork(makeResources({ maxHp: 2 }))).toBe(true);
  });

  it("permanently lowers maxHp by 1 and gains 1d6+1 coins", () => {
    const next = hardWork(makeResources({ maxHp: 20, hp: 20, coins: 3 }), sequenceDie([4]));
    expect(next.maxHp).toBe(19);
    expect(next.hp).toBe(19); // was already at the old max, clamped down with it
    expect(next.coins).toBe(3 + 4 + 1);
  });

  it("doesn't touch current hp if it was already below the new max", () => {
    const next = hardWork(makeResources({ maxHp: 20, hp: 5 }), sequenceDie([2]));
    expect(next.maxHp).toBe(19);
    expect(next.hp).toBe(5);
  });
});

describe("Getting Money: gamble", () => {
  it("spends 1 coin and wins 6 more on a roll of 6", () => {
    const result = gamble(makeResources({ coins: 3 }), sequenceDie([6]));
    expect(result.outcome).toBe("won");
    expect(result.resources.coins).toBe(3 - 1 + 6);
  });

  it("spends 1 coin and wins nothing on anything less than 6", () => {
    const result = gamble(makeResources({ coins: 3 }), sequenceDie([5]));
    expect(result.outcome).toBe("lost");
    expect(result.resources.coins).toBe(2);
  });

  it("bets your life when broke: a 6 survives and earns 5 coins", () => {
    const result = gamble(makeResources({ coins: 0 }), sequenceDie([6]));
    expect(result.outcome).toBe("survivedLifeBet");
    expect(result.resources.coins).toBe(5);
  });

  it("bets your life when broke: anything less than 6 is fatal, resources untouched", () => {
    const resources = makeResources({ coins: 0 });
    const result = gamble(resources, sequenceDie([1]));
    expect(result.outcome).toBe("diedLifeBet");
    expect(result.resources).toBe(resources);
  });
});

describe("Getting Money: resolveThugLife", () => {
  it("rolls 2d6 in a city", () => {
    // 2+2 = 4 -- killed. A third queued die (6) would change the outcome to "coins" if consumed,
    // so this also proves only 2 dice were rolled for the base check.
    const result = resolveThugLife(makeResources({ coins: 0 }), false, sequenceDie([2, 2, 6]));
    expect(result.outcome).toBe("killed");
  });

  it("rolls 3d6 in a fortress", () => {
    // 2+2+2 = 6 -- jail, not killed (would be killed on 2d6 alone).
    const result = resolveThugLife(makeResources({ hp: 10 }), true, sequenceDie([2, 2, 2, 1]));
    expect(result.outcome).toBe("fled");
  });

  it("2-4: killed outright, resources untouched", () => {
    const resources = makeResources({ coins: 5 });
    const result = resolveThugLife(resources, false, sequenceDie([1, 1]));
    expect(result).toEqual({ resources, died: true, banned: false, outcome: "killed" });
  });

  it("5-7: jail -- a survivable escape leaves you banned but alive", () => {
    const result = resolveThugLife(makeResources({ hp: 10 }), false, sequenceDie([3, 4, 2]));
    expect(result.died).toBe(false);
    expect(result.banned).toBe(true);
    expect(result.outcome).toBe("fled");
    expect(result.resources.hp).toBe(8);
  });

  it("5-7: jail -- a fatal escape roll kills you, resources untouched", () => {
    const resources = makeResources({ hp: 3 });
    const result = resolveThugLife(resources, false, sequenceDie([2, 3, 6]));
    expect(result).toEqual({ resources, died: true, banned: false, outcome: "diedEscaping" });
  });

  it("8/9/10/11-12: steal 2/5/7/10 coins", () => {
    expect(resolveThugLife(makeResources({ coins: 0 }), false, sequenceDie([4, 4])).amount).toBe(2); // 8
    expect(resolveThugLife(makeResources({ coins: 0 }), false, sequenceDie([4, 5])).amount).toBe(5); // 9
    expect(resolveThugLife(makeResources({ coins: 0 }), false, sequenceDie([5, 5])).amount).toBe(7); // 10
    expect(resolveThugLife(makeResources({ coins: 0 }), false, sequenceDie([5, 6])).amount).toBe(
      10,
    ); // 11
    expect(resolveThugLife(makeResources({ coins: 0 }), false, sequenceDie([6, 6])).amount).toBe(
      10,
    ); // 12
  });

  it("13-14 (fortress only): steal 20 coins", () => {
    const result = resolveThugLife(makeResources({ coins: 3 }), true, sequenceDie([4, 4, 5])); // 13
    expect(result.outcome).toBe("coins");
    expect(result.amount).toBe(20);
    expect(result.resources.coins).toBe(23);
  });

  it("15-18 (fortress only): a generic Treasure, not a dungeon-type-specific one", () => {
    const result = resolveThugLife(makeResources({ treasures: 1 }), true, sequenceDie([6, 6, 6])); // 18
    expect(result.outcome).toBe("treasure");
    expect(result.resources.treasures).toBe(2);
  });
});
