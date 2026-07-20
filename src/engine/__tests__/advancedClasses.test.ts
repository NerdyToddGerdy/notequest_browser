import { describe, expect, it } from "vitest";
import { ADVANCED_CLASS_TABLE } from "../../data/advancedClasses.ts";
import type { CreatedCharacter } from "../../data/types.ts";
import type { GraveyardEntry } from "../graveyard.ts";
import type { AdventurerResources } from "../town.ts";
import {
  acquireAdvancedClass,
  canAcquireAdvancedClass,
  isAdvancedClassTrackable,
  meetsAdvancedClassRequirement,
  type AdvancedClassContext,
} from "../advancedClasses.ts";
import { sequenceDie } from "../../test/mulberry32.ts";

const CHARACTER: CreatedCharacter = {
  name: "Testerin",
  race: { roll: 7, name: "Human", hp: 12, ability: "None." },
  cls: { roll: 7, name: "Fighter", hpBonus: 4, ability: "None.", weapon: "Sword", weaponDamage: "1d6+1" },
  totalHp: 16,
  spells: [],
  fixedGrants: [],
  torches: 10,
  coins: 20,
};

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
    spellUses: {},
    monsterKills: 0,
    bossKills: 0,
    killsByName: {},
    killsByAbility: {},
    provisions: 10,
    advancedClasses: [],
    ...overrides,
  };
}

function makeCtx(overrides: Partial<AdventurerResources> = {}, graveyard: GraveyardEntry[] = []): AdvancedClassContext {
  return { character: CHARACTER, resources: makeResources(overrides), graveyard };
}

describe("table completeness", () => {
  it("every entry has a name, cost, requirement text, and ability text", () => {
    for (const [key, def] of Object.entries(ADVANCED_CLASS_TABLE)) {
      expect(def.name, key).toBeTruthy();
      expect(def.cost, key).toBeGreaterThan(0);
      expect(def.requirementText, key).toBeTruthy();
      expect(def.abilityText, key).toBeTruthy();
      expect(def.hpBonus, key).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("meetsAdvancedClassRequirement", () => {
  it("Ruthless: 10 Imps killed", () => {
    expect(meetsAdvancedClassRequirement("Ruthless", makeCtx({ killsByName: { imps: 9 } }))).toBe(false);
    expect(meetsAdvancedClassRequirement("Ruthless", makeCtx({ killsByName: { imps: 10 } }))).toBe(true);
  });

  it("Goblinator: 20 Goblins killed", () => {
    expect(meetsAdvancedClassRequirement("Goblinator", makeCtx({ killsByName: { goblins: 19 } }))).toBe(false);
    expect(meetsAdvancedClassRequirement("Goblinator", makeCtx({ killsByName: { goblins: 20 } }))).toBe(true);
  });

  it("Gravedigger: at least one prior character in the (world-scoped) Graveyard", () => {
    expect(meetsAdvancedClassRequirement("Gravedigger", makeCtx({}, []))).toBe(false);
    expect(
      meetsAdvancedClassRequirement(
        "Gravedigger",
        makeCtx({}, [{ name: "A Fallen Hero", dungeon: "The Crypt", causeOfDeath: "darkness" }]),
      ),
    ).toBe(true);
  });

  it("Orcslayer: killed an Orc King or Orc Leader", () => {
    expect(meetsAdvancedClassRequirement("Orcslayer", makeCtx({}))).toBe(false);
    expect(meetsAdvancedClassRequirement("Orcslayer", makeCtx({ killsByName: { "orc king": 1 } }))).toBe(true);
    expect(meetsAdvancedClassRequirement("Orcslayer", makeCtx({ killsByName: { "orc leader": 1 } }))).toBe(true);
  });

  it("Dragonslayer: slain a dragon", () => {
    expect(meetsAdvancedClassRequirement("Dragonslayer", makeCtx({ killsByName: { dragon: 1 } }))).toBe(true);
  });

  it("Guard: at least 3 monster kills", () => {
    expect(meetsAdvancedClassRequirement("Guard", makeCtx({ monsterKills: 2 }))).toBe(false);
    expect(meetsAdvancedClassRequirement("Guard", makeCtx({ monsterKills: 3 }))).toBe(true);
  });

  it("Ghostbuster: 10 Intangible kills", () => {
    expect(meetsAdvancedClassRequirement("Ghostbuster", makeCtx({ killsByAbility: { intangible: 9 } }))).toBe(false);
    expect(meetsAdvancedClassRequirement("Ghostbuster", makeCtx({ killsByAbility: { intangible: 10 } }))).toBe(true);
  });

  it("Cleric: approximated as having killed at least one Undead", () => {
    expect(meetsAdvancedClassRequirement("Cleric", makeCtx({ killsByAbility: { undead: 1 } }))).toBe(true);
    expect(meetsAdvancedClassRequirement("Cleric", makeCtx({}))).toBe(false);
  });

  it("Ambidextrous/Warrior/Champion: bossKills thresholds", () => {
    expect(meetsAdvancedClassRequirement("Warrior", makeCtx({ bossKills: 1 }))).toBe(true);
    expect(meetsAdvancedClassRequirement("Ambidextrous", makeCtx({ bossKills: 2 }))).toBe(true);
    expect(meetsAdvancedClassRequirement("Ambidextrous", makeCtx({ bossKills: 1 }))).toBe(false);
    expect(meetsAdvancedClassRequirement("Champion", makeCtx({ bossKills: 4 }))).toBe(true);
    expect(meetsAdvancedClassRequirement("Champion", makeCtx({ bossKills: 3 }))).toBe(false);
  });

  it("Multidextrous chains on already having Ambidextrous", () => {
    expect(meetsAdvancedClassRequirement("Multidextrous", makeCtx({ advancedClasses: [] }))).toBe(false);
    expect(
      meetsAdvancedClassRequirement("Multidextrous", makeCtx({ advancedClasses: ["Ambidextrous"] })),
    ).toBe(true);
  });

  it("Paladin chains on Cleric; Anti-Paladin chains on Paladin", () => {
    expect(meetsAdvancedClassRequirement("Paladin", makeCtx({ advancedClasses: ["Cleric"] }))).toBe(true);
    expect(meetsAdvancedClassRequirement("Paladin", makeCtx({ advancedClasses: [] }))).toBe(false);
    expect(
      meetsAdvancedClassRequirement("Anti-Paladin", makeCtx({ advancedClasses: ["Cleric", "Paladin"] })),
    ).toBe(true);
  });

  it("Mage: knows at least 3 Basic-table spells", () => {
    expect(
      meetsAdvancedClassRequirement(
        "Mage",
        makeCtx({ spellUses: { "basic:1": 1, "basic:2": 1, "basic:3": 0 } }),
      ),
    ).toBe(true);
    expect(meetsAdvancedClassRequirement("Mage", makeCtx({ spellUses: { "basic:1": 1 } }))).toBe(false);
  });

  it("Elementalist: knows both Fireball and Cold Ray", () => {
    expect(
      meetsAdvancedClassRequirement(
        "Elementalist",
        makeCtx({ spellUses: { "basic:6": 0, "basic:4": 0 } }), // Fireball, Cold Ray
      ),
    ).toBe(true);
    expect(meetsAdvancedClassRequirement("Elementalist", makeCtx({ spellUses: { "basic:6": 0 } }))).toBe(false);
  });

  it("Alchemist/Arcane: known-spell-count thresholds (any table)", () => {
    const fourSpells = { "basic:1": 0, "basic:2": 0, "nature:1": 0, "death:1": 0 };
    expect(meetsAdvancedClassRequirement("Alchemist", makeCtx({ spellUses: fourSpells }))).toBe(true);
    expect(meetsAdvancedClassRequirement("Arcane", makeCtx({ spellUses: fourSpells }))).toBe(false);
    expect(
      meetsAdvancedClassRequirement("Arcane", makeCtx({ spellUses: { ...fourSpells, "elemental:1": 0, "advanced:2": 0 } })),
    ).toBe(true);
  });

  it("a class with no requirement check at all is never met, regardless of state", () => {
    expect(isAdvancedClassTrackable("Avenger")).toBe(false);
    expect(meetsAdvancedClassRequirement("Avenger", makeCtx({ coins: 999999 }))).toBe(false);
  });
});

describe("canAcquireAdvancedClass", () => {
  it("requires enough coins, the requirement met, and not already owned", () => {
    const met = makeCtx({ coins: 50, monsterKills: 3 });
    expect(canAcquireAdvancedClass(met, "Guard")).toBe(true);

    const poor = makeCtx({ coins: 0, monsterKills: 3 });
    expect(canAcquireAdvancedClass(poor, "Guard")).toBe(false);

    const unmet = makeCtx({ coins: 50, monsterKills: 0 });
    expect(canAcquireAdvancedClass(unmet, "Guard")).toBe(false);

    const owned = makeCtx({ coins: 50, monsterKills: 3, advancedClasses: ["Guard"] });
    expect(canAcquireAdvancedClass(owned, "Guard")).toBe(false);
  });

  it("is false for an untrackable class even with every stat maxed out", () => {
    expect(canAcquireAdvancedClass(makeCtx({ coins: 999999 }), "Avenger")).toBe(false);
  });
});

describe("acquireAdvancedClass", () => {
  it("spends coins, stacks the class, and applies the HP bonus to both hp and maxHp", () => {
    const ctx = makeCtx({ coins: 100, monsterKills: 3, hp: 15, maxHp: 15 });
    const next = acquireAdvancedClass(ctx, "Guard");
    expect(next.coins).toBe(50); // Guard costs 50
    expect(next.advancedClasses).toEqual(["Guard"]);
    expect(next.hp).toBe(16); // Guard: +1 HP
    expect(next.maxHp).toBe(16);
  });

  it("is a no-op when the requirement isn't met", () => {
    const ctx = makeCtx({ coins: 100, monsterKills: 0 });
    const next = acquireAdvancedClass(ctx, "Guard");
    expect(next).toEqual(ctx.resources);
  });

  it("Cleric grants 2 fixed uses of Heal (basic:1)", () => {
    const ctx = makeCtx({ coins: 200, killsByAbility: { undead: 1 } });
    const next = acquireAdvancedClass(ctx, "Cleric");
    expect(next.spellUses["basic:1"]).toBe(2);
  });

  it("Paladin grants 3 fixed uses of Heal, stacking on top of any already granted", () => {
    const ctx = makeCtx({
      coins: 200,
      advancedClasses: ["Cleric"],
      spellUses: { "basic:1": 2 },
    });
    const next = acquireAdvancedClass(ctx, "Paladin");
    expect(next.spellUses["basic:1"]).toBe(5);
    expect(next.advancedClasses).toEqual(["Cleric", "Paladin"]);
  });

  it("Anti-Paladin grants 4 random Death Spells and zeroes out Heal uses", () => {
    const ctx = makeCtx({
      coins: 200,
      advancedClasses: ["Cleric", "Paladin"],
      spellUses: { "basic:1": 5 },
    });
    const rng = sequenceDie([1, 2, 3, 4]); // Death table rolls -- one use each
    const next = acquireAdvancedClass(ctx, "Anti-Paladin", rng);
    expect(next.spellUses["basic:1"]).toBe(0);
    expect(next.spellUses["death:1"]).toBe(1);
    expect(next.spellUses["death:2"]).toBe(1);
    expect(next.spellUses["death:3"]).toBe(1);
    expect(next.spellUses["death:4"]).toBe(1);
  });

  it("Mage grants 4 random Basic Spell uses", () => {
    const ctx = makeCtx({ coins: 200, spellUses: { "basic:1": 1, "basic:2": 1, "basic:3": 1 } });
    const rng = sequenceDie([1, 1, 2, 3]); // Heal x2, Light, Teleport
    const next = acquireAdvancedClass(ctx, "Mage", rng);
    expect(next.spellUses["basic:1"]).toBe(3); // 1 existing + 2 new Heal rolls
    expect(next.spellUses["basic:2"]).toBe(2);
    expect(next.spellUses["basic:3"]).toBe(2);
  });

  it("Elementalist grants 4 random Elemental Spell uses", () => {
    const ctx = makeCtx({ coins: 300, spellUses: { "basic:6": 0, "basic:4": 0 } });
    const rng = sequenceDie([1, 2, 3, 4]);
    const next = acquireAdvancedClass(ctx, "Elementalist", rng);
    expect(next.spellUses["elemental:1"]).toBe(1);
    expect(next.spellUses["elemental:2"]).toBe(1);
    expect(next.spellUses["elemental:3"]).toBe(1);
    expect(next.spellUses["elemental:4"]).toBe(1);
  });

  it("Arcane grants 4 random Advanced Spell uses (2d6 each)", () => {
    const ctx = makeCtx({
      coins: 500,
      spellUses: {
        "basic:1": 0,
        "basic:2": 0,
        "nature:1": 0,
        "death:1": 0,
        "elemental:1": 0,
        "advanced:2": 0,
      },
    });
    const rng = sequenceDie([5, 4, 3, 3, 2, 2, 6, 6]); // sums: 9, 6, 4, 12
    const next = acquireAdvancedClass(ctx, "Arcane", rng);
    expect(next.spellUses["advanced:9"]).toBe(1);
    expect(next.spellUses["advanced:6"]).toBe(1);
    expect(next.spellUses["advanced:4"]).toBe(1);
    expect(next.spellUses["advanced:12"]).toBe(1);
  });

  it("Ambidextrous/Warrior/Ruthless have no mechanical ability, only the HP bonus", () => {
    const ctx = makeCtx({ coins: 100, bossKills: 1 });
    const next = acquireAdvancedClass(ctx, "Warrior");
    expect(next.spellUses).toEqual({});
    expect(next.hp).toBe(ctx.resources.hp + 2);
  });
});
