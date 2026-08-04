import { describe, expect, it } from "vitest";

import { BUILDING_TABLE } from "../../data/buildings.ts";
import { fixedDie, sequenceDie } from "../../test/mulberry32.ts";
import {
  canUseStorage,
  canWithdraw,
  depositItem,
  resolveStorageTheft,
  storedAt,
  storedCount,
  withdrawItem,
} from "../buildings.ts";
import { hexKey, withoutBuilding, type HexCoord, type WorldState } from "../hexState.ts";
import {
  createInitialMilestones,
  createInitialTravelStats,
  type AdventurerResources,
} from "../town.ts";

/**
 * Buildings' storage (issue #102, rules 1687-1689): "In a building you can store any number of items
 * found in dungeons. However, whenever you leave a dungeon roll a die. If it drops a number greater
 * than the building's Defense value, a random item has been stolen."
 */

const HOME: HexCoord = { q: 0, r: 0 };

function makeWorld(building?: "House" | "Castle" | "City" | "Fortress"): WorldState {
  return {
    climate: "hot",
    home: HOME,
    player: HOME,
    hasBoat: false,
    bannedHexes: [],
    tiles: {
      [hexKey(HOME)]: { terrain: "plain", location: null, ...(building ? { building } : {}) },
    },
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
    consumables: [],
    armor: [],
    spareArmor: [],
    weapon: null,
    spareWeapons: [],
    spellUses: {},
    maxSpellUses: {},
    provisions: 10,
    monsterKills: 0,
    bossKills: 0,
    killsByName: {},
    killsByAbility: {},
    curiosities: {},
    advancedClasses: [],
    hireling: null,
    hirelingHp: null,
    animals: [],
    milestones: createInitialMilestones(),
    buildings: [],
    survivedRunIds: [],
    troops: 0,
    troopSources: [],
    travelStats: createInitialTravelStats(),
    flyActive: false,
    catatonic: false,
    mutations: [],
    zombieRevivals: 0,
    nextDungeonDamageBonus: 0,
    armLost: false,
    ...overrides,
  };
}

const SWORD = { name: "Sword of Fire", worth: 12 };
const POTION = { name: "Health Potion", text: "Heals you.", effect: { kind: "healAll" as const } };

describe("canUseStorage", () => {
  it("needs a building on the hex -- there is no remote depositing", () => {
    expect(canUseStorage(makeWorld("House"), HOME)).toBe(true);
    expect(canUseStorage(makeWorld(), HOME)).toBe(false);
  });
});

describe("depositing", () => {
  it("moves a carried item into the building", () => {
    const { resources, world } = depositItem(
      makeResources({ heldItems: [SWORD] }),
      makeWorld("House"),
      HOME,
      "heldItems",
      0,
    );

    expect(resources.heldItems).toEqual([]);
    expect(storedAt(world, HOME).items).toEqual([SWORD]);
  });

  it("moves a potion in too, since both compete for the same Pack slots (issue #110)", () => {
    const { resources, world } = depositItem(
      makeResources({ consumables: [POTION] }),
      makeWorld("House"),
      HOME,
      "consumables",
      0,
    );

    expect(resources.consumables).toEqual([]);
    expect(storedAt(world, HOME).consumables).toEqual([POTION]);
  });

  it("is uncapped -- 'any number of items', so a House holds as much as a Fortress", () => {
    let resources = makeResources({
      heldItems: Array.from({ length: 25 }, (_, i) => ({ name: `Trinket ${i}`, worth: 1 })),
    });
    let world = makeWorld("House");
    while (resources.heldItems.length > 0) {
      ({ resources, world } = depositItem(resources, world, HOME, "heldItems", 0));
    }
    expect(storedCount(storedAt(world, HOME))).toBe(25);
  });

  it("no-ops on a hex with no building", () => {
    const before = makeResources({ heldItems: [SWORD] });
    const { resources, world } = depositItem(before, makeWorld(), HOME, "heldItems", 0);
    expect(resources.heldItems).toEqual([SWORD]);
    expect(storedAt(world, HOME).items).toEqual([]);
  });
});

describe("withdrawing", () => {
  it("moves a stored item back into the Pack", () => {
    const stocked = depositItem(
      makeResources({ heldItems: [SWORD] }),
      makeWorld("House"),
      HOME,
      "heldItems",
      0,
    );
    const { resources, world } = withdrawItem(
      stocked.resources,
      stocked.world,
      HOME,
      "heldItems",
      0,
    );

    expect(resources.heldItems).toEqual([SWORD]);
    expect(storedAt(world, HOME).items).toEqual([]);
  });

  it("respects the Pack cap on the way out, even though storing ignored it on the way in", () => {
    const full = Array.from({ length: 10 }, (_, i) => ({ name: `Item ${i}`, worth: 1 }));
    const stocked = depositItem(
      makeResources({ heldItems: [...full, SWORD] }),
      makeWorld("House"),
      HOME,
      "heldItems",
      10, // the Sword, leaving a full pack behind
    );
    expect(canWithdraw(stocked.resources)).toBe(false);

    const { resources, world } = withdrawItem(
      stocked.resources,
      stocked.world,
      HOME,
      "heldItems",
      0,
    );
    expect(resources.heldItems).toHaveLength(10); // unchanged
    expect(storedAt(world, HOME).items).toEqual([SWORD]); // still in the vault
  });
});

describe("the theft roll", () => {
  /** A House (Defense 2) holding one Sword. */
  function stockedHouse() {
    return depositItem(
      makeResources({ heldItems: [SWORD] }),
      makeWorld("House"),
      HOME,
      "heldItems",
      0,
    ).world;
  }

  it("steals on a roll greater than Defense", () => {
    // House Defense 2; a 3 is greater, so the Sword goes.
    const { world, thefts } = resolveStorageTheft(stockedHouse(), fixedDie(3));

    expect(thefts).toHaveLength(1);
    expect(thefts[0]!.itemName).toBe("Sword of Fire");
    expect(storedAt(world, HOME).items).toEqual([]);
  });

  it("spares the stash on a roll equal to Defense -- 'greater than', not 'at least'", () => {
    const { world, thefts } = resolveStorageTheft(stockedHouse(), fixedDie(2));

    expect(thefts).toEqual([]);
    expect(storedAt(world, HOME).items).toEqual([SWORD]);
  });

  it("never robs a City or a Fortress, since 1d6 cannot exceed Defense 6", () => {
    for (const kind of ["City", "Fortress"] as const) {
      const stocked = depositItem(
        makeResources({ heldItems: [SWORD] }),
        makeWorld(kind),
        HOME,
        "heldItems",
        0,
      ).world;
      // Even the best possible roll for a thief.
      const { thefts } = resolveStorageTheft(stocked, fixedDie(6));
      expect(thefts).toEqual([]);
      expect(BUILDING_TABLE[kind].defense).toBeGreaterThanOrEqual(6);
    }
  });

  it("skips an empty building entirely rather than rolling for nothing", () => {
    const { thefts } = resolveStorageTheft(makeWorld("House"), fixedDie(6));
    expect(thefts).toEqual([]);
  });

  it("can take a stored potion, so a stash of potions is no safer than one of sellables", () => {
    const stocked = depositItem(
      makeResources({ consumables: [POTION] }),
      makeWorld("House"),
      HOME,
      "consumables",
      0,
    ).world;
    // rollDie -> 6 (theft), then rng() picks the victim; only one item either way.
    const { world, thefts } = resolveStorageTheft(stocked, sequenceDie([6, 1]));

    expect(thefts).toHaveLength(1);
    expect(thefts[0]!.itemName).toBe("Health Potion");
    expect(storedAt(world, HOME).consumables).toEqual([]);
  });
});

describe("a razed building takes its contents with it", () => {
  it("clears storage when a Declared Enemy destroys the place (issue #28's withoutBuilding)", () => {
    const stocked = depositItem(
      makeResources({ heldItems: [SWORD], consumables: [POTION] }),
      makeWorld("House"),
      HOME,
      "heldItems",
      0,
    );
    const withPotion = depositItem(stocked.resources, stocked.world, HOME, "consumables", 0);
    expect(storedCount(storedAt(withPotion.world, HOME))).toBe(2);

    const razed = withoutBuilding(withPotion.world, HOME);

    expect(razed.tiles[hexKey(HOME)]!.building).toBeUndefined();
    expect(storedCount(storedAt(razed, HOME))).toBe(0);
  });
});

describe("storage outlives its builder", () => {
  it("lives on the world tile, so a new character inherits the vault with the estate", () => {
    // The point of putting this on HexTile rather than on the per-character `resources.buildings`
    // view (which #121 made derived): the world outlives every character, and so does the vault.
    const { world } = depositItem(
      makeResources({ heldItems: [SWORD] }),
      makeWorld("Castle"),
      HOME,
      "heldItems",
      0,
    );
    expect(world.tiles[hexKey(HOME)]!.storedItems).toEqual([SWORD]);
  });
});
