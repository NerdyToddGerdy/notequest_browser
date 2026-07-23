import { describe, expect, it } from "vitest";
import { DOMESTICATED_ANIMAL_TABLE, MOUNT_TABLE } from "../../data/animals.ts";
import {
  createInitialMilestones,
  createInitialTravelStats,
  type AdventurerResources,
} from "../town.ts";
import {
  activeMount,
  animalTravelCostOverride,
  animalTravelCostPenalty,
  buyMount,
  canBuyMount,
  canTrainAnimal,
  hasDog,
  MAX_ANIMALS,
  trainAnimal,
} from "../animals.ts";
import { fixedDie } from "../../test/mulberry32.ts";

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
    maxSpellUses: {},
    monsterKills: 0,
    bossKills: 0,
    killsByName: {},
    killsByAbility: {},
    provisions: 20,
    advancedClasses: [],
    hireling: null,
    animals: [],
    milestones: createInitialMilestones(),
    travelStats: createInitialTravelStats(),
    ...overrides,
  };
}

describe("table completeness", () => {
  it("every entry has a name, terrain, Dif, HP, damage, and ability text", () => {
    const allEntries = [...Object.values(DOMESTICATED_ANIMAL_TABLE), ...Object.values(MOUNT_TABLE)];
    for (const def of allEntries) {
      expect(def.name, def.name).toBeTruthy();
      expect(def.dif, def.name).toBeGreaterThan(0);
      expect(def.hp, def.name).toBeGreaterThan(0);
      expect(def.damage, def.name).toBeGreaterThan(0);
      expect(def.abilityText, def.name).toBeTruthy();
    }
  });

  it("only Mounts carry a mountCost", () => {
    for (const def of Object.values(DOMESTICATED_ANIMAL_TABLE)) {
      expect(def.isMount, def.name).toBe(false);
      expect(def.mountCost, def.name).toBeUndefined();
    }
    for (const def of Object.values(MOUNT_TABLE)) {
      expect(def.isMount, def.name).toBe(true);
      expect(def.mountCost, def.name).toBeGreaterThan(0);
    }
  });
});

describe("activeMount", () => {
  it("returns null when no owned animal is a Mount", () => {
    expect(activeMount(["Cat", "Dog"])).toBeNull();
  });

  it("returns the one Mount def among owned animals", () => {
    expect(activeMount(["Cat", "Horse"])?.name).toBe("Horse");
  });
});

describe("canTrainAnimal / trainAnimal", () => {
  it("requires enough provisions (4 for an animal, 8 for a mount)", () => {
    const owl = DOMESTICATED_ANIMAL_TABLE.Owl!;
    expect(canTrainAnimal(makeResources({ provisions: 3 }), owl)).toBe(false);
    expect(canTrainAnimal(makeResources({ provisions: 4 }), owl)).toBe(true);

    const horse = MOUNT_TABLE.Horse!;
    expect(canTrainAnimal(makeResources({ provisions: 7 }), horse)).toBe(false);
    expect(canTrainAnimal(makeResources({ provisions: 8 }), horse)).toBe(true);
  });

  it("is capped at MAX_ANIMALS", () => {
    const owl = DOMESTICATED_ANIMAL_TABLE.Owl!;
    const full = makeResources({ animals: ["Cat", "Dog", "Wolf"] });
    expect(full.animals.length).toBe(MAX_ANIMALS);
    expect(canTrainAnimal(full, owl)).toBe(false);
  });

  it("rejects a second Mount even with room to spare", () => {
    const camel = MOUNT_TABLE.Camel!;
    expect(canTrainAnimal(makeResources({ animals: ["Horse"] }), camel)).toBe(false);
    expect(canTrainAnimal(makeResources({ animals: ["Cat"] }), camel)).toBe(true);
  });

  it("spends provisions regardless of outcome, only adding the animal on success", () => {
    const dog = DOMESTICATED_ANIMAL_TABLE.Dog!; // Dif 2
    const failed = trainAnimal(makeResources({ provisions: 10 }), dog, fixedDie(1));
    expect(failed.trained).toBe(false);
    expect(failed.resources.provisions).toBe(6); // still spent
    expect(failed.resources.animals).toEqual([]);

    const succeeded = trainAnimal(makeResources({ provisions: 10 }), dog, fixedDie(2));
    expect(succeeded.trained).toBe(true);
    expect(succeeded.resources.provisions).toBe(6);
    expect(succeeded.resources.animals).toEqual(["Dog"]);
  });

  it("is a no-op (no provisions spent) when the gate itself is rejected", () => {
    const owl = DOMESTICATED_ANIMAL_TABLE.Owl!;
    const resources = makeResources({ provisions: 2 });
    const result = trainAnimal(resources, owl);
    expect(result).toEqual({ resources, trained: false });
  });
});

describe("canBuyMount / buyMount", () => {
  it("requires enough coins and room (no second Mount)", () => {
    const horse = MOUNT_TABLE.Horse!; // 50 coins
    expect(canBuyMount(makeResources({ coins: 49 }), horse)).toBe(false);
    expect(canBuyMount(makeResources({ coins: 50 }), horse)).toBe(true);
    expect(canBuyMount(makeResources({ coins: 1000, animals: ["Camel"] }), horse)).toBe(false);
  });

  it("spends coins and adds the mount, no roll involved", () => {
    const horse = MOUNT_TABLE.Horse!;
    const next = buyMount(makeResources({ coins: 100 }), horse);
    expect(next.coins).toBe(50);
    expect(next.animals).toEqual(["Horse"]);
  });

  it("is a no-op when unaffordable", () => {
    const horse = MOUNT_TABLE.Horse!;
    const resources = makeResources({ coins: 10 });
    expect(buyMount(resources, horse)).toEqual(resources);
  });
});

describe("animalTravelCostOverride", () => {
  it("is null when nothing owned applies to this terrain", () => {
    expect(animalTravelCostOverride(["Cat"], "forest")).toBeNull();
    expect(animalTravelCostOverride(["Owl"], "mountain")).toBeNull();
  });

  it("applies Owl/Giant Wolf's forest cap, Goat/Llama's mountain cap, Camel's desert cap, Raptor's swamp cap", () => {
    expect(animalTravelCostOverride(["Owl"], "forest")).toBe(1);
    expect(animalTravelCostOverride(["Giant Wolf"], "forest")).toBe(1);
    expect(animalTravelCostOverride(["Goat"], "mountain")).toBe(2);
    expect(animalTravelCostOverride(["Llama"], "mountain")).toBe(2);
    expect(animalTravelCostOverride(["Camel"], "desert")).toBe(1);
    expect(animalTravelCostOverride(["Raptor"], "swamp")).toBe(1);
  });

  it("approximates Horse's 'move across 2 Plains for 1 provision' as a flat 1-provision Plains cost", () => {
    expect(animalTravelCostOverride(["Horse"], "plain")).toBe(1);
  });

  it("Griffin's unconditional override wins regardless of terrain, even over a cheaper-seeming combo", () => {
    expect(animalTravelCostOverride(["Griffin"], "swamp")).toBe(1);
    expect(animalTravelCostOverride(["Griffin"], "plain")).toBe(1);
  });

  it("the cheapest applicable override wins when multiple owned animals apply to the same terrain", () => {
    // Owl (pet) and Giant Wolf (mount) can coexist; both cap Forest at 1 -- still just 1, not stacked.
    expect(animalTravelCostOverride(["Owl", "Giant Wolf"], "forest")).toBe(1);
  });
});

describe("animalTravelCostPenalty", () => {
  it("is 0 without Mammoth, 1 with it", () => {
    expect(animalTravelCostPenalty(["Cat", "Horse"])).toBe(0);
    expect(animalTravelCostPenalty(["Mammoth"])).toBe(1);
  });
});

describe("hasDog", () => {
  it("checks for Dog specifically", () => {
    expect(hasDog(["Cat", "Wolf"])).toBe(false);
    expect(hasDog(["Dog"])).toBe(true);
  });
});
