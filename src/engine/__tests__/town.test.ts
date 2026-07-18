import { describe, expect, it } from "vitest";
import {
  buyProvision,
  buyTorch,
  canBuyProvision,
  canBuyTorch,
  canCastSpell,
  canFixArmor,
  canRest,
  castSpell,
  fixArmor,
  payTravelCost,
  rest,
  sellItem,
  wieldWeapon,
  type AdventurerResources,
} from "../town.ts";

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
    spellUses: { 1: 0 },
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
  it("only allows Heal (1) and Light (2), and only with uses remaining", () => {
    expect(canCastSpell(makeResources({ spellUses: { 1: 1 } }), 1)).toBe(true);
    expect(canCastSpell(makeResources({ spellUses: { 1: 0 } }), 1)).toBe(false);
    expect(canCastSpell(makeResources({ spellUses: { 2: 1 } }), 2)).toBe(true);
    // Cold Ray/Lightning/Fireball/Teleport all need combat, which neither Town nor World has.
    expect(canCastSpell(makeResources({ spellUses: { 4: 1 } }), 4)).toBe(false);
  });

  it("Heal recovers 5 HP, capped at maxHp, and spends a use", () => {
    const resources = makeResources({ hp: 10, maxHp: 20, spellUses: { 1: 2 } });
    const next = castSpell(resources, 1);
    expect(next.hp).toBe(15);
    expect(next.spellUses).toEqual({ 1: 1 });
  });

  it("Heal is capped at maxHp, not overhealing", () => {
    const resources = makeResources({ hp: 18, maxHp: 20, spellUses: { 1: 1 } });
    const next = castSpell(resources, 1);
    expect(next.hp).toBe(20);
  });

  it("Light grants 1 torch, capped at 10, and spends a use", () => {
    const resources = makeResources({ torches: 5, spellUses: { 2: 1 } });
    const next = castSpell(resources, 2);
    expect(next.torches).toBe(6);
    expect(next.spellUses).toEqual({ 2: 0 });
  });

  it("Light is capped at 10 torches, still spending the use", () => {
    const resources = makeResources({ torches: 10, spellUses: { 2: 1 } });
    const next = castSpell(resources, 2);
    expect(next.torches).toBe(10);
    expect(next.spellUses).toEqual({ 2: 0 });
  });

  it("is a no-op with no uses remaining", () => {
    const resources = makeResources({ hp: 10, maxHp: 20, spellUses: { 1: 0 } });
    const next = castSpell(resources, 1);
    expect(next).toEqual(resources);
  });

  it("is a no-op for a combat-only spell", () => {
    const resources = makeResources({ spellUses: { 5: 1 } });
    const next = castSpell(resources, 5);
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
