import { describe, expect, it } from "vitest";
import { HIRELING_ROSTERS, HUMAN_FORTRESS_HIRELINGS, hirelingsFor } from "../../data/hirelings.ts";
import {
  createInitialMilestones,
  createInitialTravelStats,
  type AdventurerResources,
} from "../town.ts";
import { canHireHireling, hireHireling } from "../hirelings.ts";
import { sequenceDie } from "../../test/mulberry32.ts";

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
    hireling: null,
    animals: [],
    milestones: createInitialMilestones(),
    travelStats: createInitialTravelStats(),
    ...overrides,
  };
}

describe("table completeness", () => {
  it("every roster entry has a name, cost, HP, equipment, and ability text", () => {
    const allEntries = [...Object.values(HIRELING_ROSTERS).flat(), ...HUMAN_FORTRESS_HIRELINGS];
    for (const def of allEntries) {
      expect(def.name, def.name).toBeTruthy();
      expect(def.cost, def.name).toBeGreaterThan(0);
      expect(def.hp, def.name).toBeGreaterThan(0);
      expect(def.equipmentText, def.name).toBeTruthy();
      expect(def.abilityText, def.name).toBeTruthy();
    }
  });
});

describe("hirelingsFor", () => {
  it("is empty for a null culture (Ruins)", () => {
    expect(hirelingsFor(null, false)).toEqual([]);
  });

  it("returns the base roster for a non-Fortress culture", () => {
    const roster = hirelingsFor("human", false);
    expect(roster.map((h) => h.name)).toEqual(["Torchbearer", "Mercenary"]);
  });

  it("appends the Human-Fortress-only tier only for human + isFortress", () => {
    const roster = hirelingsFor("human", true);
    expect(roster.map((h) => h.name)).toEqual([
      "Torchbearer",
      "Mercenary",
      "Jester",
      "Burglar",
      "Bodyguard",
      "Minstrel",
      "Rent Wizard",
      "War Veteran",
    ]);
  });

  it("doesn't append the Human-Fortress tier for any other culture, even at a Fortress", () => {
    expect(hirelingsFor("dwarven", true).map((h) => h.name)).toEqual(["Dwarf Miner", "Dwarf Soldier"]);
    expect(hirelingsFor("elven", true).map((h) => h.name)).toEqual(["Elf Ranger", "Elf Soldier"]);
    expect(hirelingsFor("gnome", true).map((h) => h.name)).toEqual(["Gnome Helper"]);
  });

  it("Goblin and Orc share the identical roster (one combined rulebook table)", () => {
    expect(hirelingsFor("goblin", false)).toEqual(hirelingsFor("orc", false));
    expect(hirelingsFor("goblin", false).map((h) => h.name)).toEqual([
      "Goblin Helper",
      "Orc Soldier",
      "Cargo Ogre",
    ]);
  });
});

describe("canHireHireling / hireHireling", () => {
  it("requires the name to be in the current roster", () => {
    expect(canHireHireling(makeResources(), "Dwarf Miner", "human", false)).toBe(false);
    expect(canHireHireling(makeResources(), "Torchbearer", "human", false)).toBe(true);
  });

  it("requires enough coins", () => {
    expect(canHireHireling(makeResources({ coins: 5 }), "Mercenary", "human", false)).toBe(false);
    expect(canHireHireling(makeResources({ coins: 30 }), "Mercenary", "human", false)).toBe(true);
  });

  it("spends the coin cost and sets hireling to the hired name", () => {
    const resources = makeResources({ coins: 100 });
    const next = hireHireling(resources, "Mercenary", "human", false);
    expect(next.coins).toBe(70);
    expect(next.hireling).toBe("Mercenary");
  });

  it("hiring a new one replaces whoever was already employed, no refund", () => {
    const resources = makeResources({ coins: 100, hireling: "Torchbearer" });
    const next = hireHireling(resources, "Mercenary", "human", false);
    expect(next.hireling).toBe("Mercenary");
    expect(next.coins).toBe(70);
  });

  it("is a no-op when unaffordable or not in the roster", () => {
    const poor = makeResources({ coins: 5 });
    expect(hireHireling(poor, "Mercenary", "human", false)).toEqual(poor);

    const wrongRoster = makeResources({ coins: 1000 });
    expect(hireHireling(wrongRoster, "Dwarf Miner", "human", false)).toEqual(wrongRoster);
  });

  it("Rent Wizard grants 4 random Basic Spell uses at hire time", () => {
    const resources = makeResources({ coins: 100 });
    const rng = sequenceDie([1, 1, 2, 3]); // Heal x2, Light, Teleport
    const next = hireHireling(resources, "Rent Wizard", "human", true, rng);
    expect(next.hireling).toBe("Rent Wizard");
    expect(next.spellUses["basic:1"]).toBe(2);
    expect(next.spellUses["basic:2"]).toBe(1);
    expect(next.spellUses["basic:3"]).toBe(1);
  });

  it("Elf Soldier grants 3 random Basic Spell uses at hire time", () => {
    const resources = makeResources({ coins: 100 });
    const rng = sequenceDie([4, 5, 6]);
    const next = hireHireling(resources, "Elf Soldier", "elven", false, rng);
    expect(next.spellUses["basic:4"]).toBe(1);
    expect(next.spellUses["basic:5"]).toBe(1);
    expect(next.spellUses["basic:6"]).toBe(1);
  });

  it("Gnome Helper grants 4 random Basic Spell uses at hire time", () => {
    const resources = makeResources({ coins: 100 });
    const rng = sequenceDie([1, 2, 3, 4]);
    const next = hireHireling(resources, "Gnome Helper", "gnome", false, rng);
    expect(next.spellUses["basic:1"]).toBe(1);
    expect(next.spellUses["basic:2"]).toBe(1);
    expect(next.spellUses["basic:3"]).toBe(1);
    expect(next.spellUses["basic:4"]).toBe(1);
  });

  it("Torchbearer/Mercenary have no mechanical ability, only the hire itself", () => {
    const resources = makeResources({ coins: 100 });
    const next = hireHireling(resources, "Torchbearer", "human", false);
    expect(next.spellUses).toEqual({});
    expect(next.hireling).toBe("Torchbearer");
  });
});
