import { describe, expect, it } from "vitest";
import { buildBuilding, canBuildBuilding, qualifiesForBuilding } from "../buildings.ts";
import { hexKey, type HexTile, type WorldState } from "../hexState.ts";
import { createInitialMilestones, createInitialTravelStats, type AdventurerResources } from "../town.ts";
import { BUILDING_TABLE } from "../../data/buildings.ts";

function makeResources(overrides: Partial<AdventurerResources> = {}): AdventurerResources {
  return {
    torches: 5,
    hp: 20,
    maxHp: 20,
    coins: 5000,
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
    buildings: [],
    troops: 0,
    troopSources: [],
    travelStats: createInitialTravelStats(),
    ...overrides,
  };
}

const COORD = { q: 0, r: 0 };

function worldWithTile(tile: HexTile): WorldState {
  return {
    climate: "hot",
    home: COORD,
    player: COORD,
    tiles: { [hexKey(COORD)]: tile },
    hasBoat: false,
  };
}

describe("qualifiesForBuilding", () => {
  it("requires an empty location", () => {
    expect(qualifiesForBuilding({ terrain: "plain", location: null })).toBe(true);
    expect(qualifiesForBuilding({ terrain: "plain", location: "humanCity" })).toBe(false);
  });

  it("an already-built hex still qualifies, for its own upgrade path", () => {
    expect(qualifiesForBuilding({ terrain: "plain", location: null, building: "House" })).toBe(true);
  });
});

describe("canBuildBuilding", () => {
  it("requires enough coins", () => {
    const tile: HexTile = { terrain: "plain", location: null };
    expect(canBuildBuilding(makeResources({ coins: BUILDING_TABLE.House.cost }), tile, "House", "plain", "Human")).toBe(
      true,
    );
    expect(canBuildBuilding(makeResources({ coins: BUILDING_TABLE.House.cost - 1 }), tile, "House", "plain", "Human")).toBe(
      false,
    );
  });

  it("rejects a hex that already has a location", () => {
    const tile: HexTile = { terrain: "plain", location: "humanCity" };
    expect(canBuildBuilding(makeResources(), tile, "House", "plain", "Human")).toBe(false);
  });

  it("is false when the tile is undefined", () => {
    expect(canBuildBuilding(makeResources(), undefined, "House", "plain", "Human")).toBe(false);
  });

  it("gates Palace/Castle on Noble, City on Lord, Fortress on King", () => {
    const tile: HexTile = { terrain: "plain", location: null };
    const resources = makeResources({ coins: 10000 });
    expect(canBuildBuilding(resources, tile, "Palace", "plain", "Human")).toBe(false);
    expect(canBuildBuilding({ ...resources, advancedClasses: ["Noble"] }, tile, "Palace", "plain", "Human")).toBe(
      true,
    );
    expect(canBuildBuilding(resources, tile, "City", "plain", "Human")).toBe(false);
    expect(canBuildBuilding({ ...resources, advancedClasses: ["Lord"] }, tile, "City", "plain", "Human")).toBe(true);
    expect(canBuildBuilding(resources, tile, "Fortress", "plain", "Human")).toBe(false);
    expect(canBuildBuilding({ ...resources, advancedClasses: ["King"] }, tile, "Fortress", "plain", "Human")).toBe(
      true,
    );
  });

  it("only requires the cost difference on an already-built hex", () => {
    const tile: HexTile = { terrain: "plain", location: null, building: "House" };
    const diff = BUILDING_TABLE.Tower.cost - BUILDING_TABLE.House.cost;
    expect(canBuildBuilding(makeResources({ coins: diff - 1 }), tile, "Tower", "plain", "Human")).toBe(false);
    expect(canBuildBuilding(makeResources({ coins: diff }), tile, "Tower", "plain", "Human")).toBe(true);
  });

  it("doubles the cost off-Plains, exempting Dwarf/Mountain and Elf/Forest", () => {
    const tile: HexTile = { terrain: "mountain", location: null };
    const humanCoins = makeResources({ coins: BUILDING_TABLE.House.cost * 2 - 1 });
    expect(canBuildBuilding(humanCoins, tile, "House", "mountain", "Human")).toBe(false);
    const dwarfCoins = makeResources({ coins: BUILDING_TABLE.House.cost });
    expect(canBuildBuilding(dwarfCoins, tile, "House", "mountain", "Dwarf")).toBe(true);
  });
});

describe("buildBuilding", () => {
  it("spends the cost and stamps both resources.buildings and the world tile", () => {
    const resources = makeResources({ coins: 1000 });
    const world = worldWithTile({ terrain: "plain", location: null });
    const result = buildBuilding(resources, world, COORD, "House", "plain", "Human");
    expect(result.resources.coins).toBe(1000 - BUILDING_TABLE.House.cost);
    expect(result.resources.buildings).toEqual([{ hexKey: "0,0", kind: "House" }]);
    expect(result.world.tiles["0,0"]!.building).toBe("House");
  });

  it("replaces (not duplicates) this hex's own entry on an upgrade, charging only the difference", () => {
    const resources = makeResources({
      coins: 1000,
      buildings: [{ hexKey: "0,0", kind: "House" }],
    });
    const world = worldWithTile({ terrain: "plain", location: null, building: "House" });
    const result = buildBuilding(resources, world, COORD, "Tower", "plain", "Human");
    const diff = BUILDING_TABLE.Tower.cost - BUILDING_TABLE.House.cost;
    expect(result.resources.coins).toBe(1000 - diff);
    expect(result.resources.buildings).toEqual([{ hexKey: "0,0", kind: "Tower" }]);
    expect(result.world.tiles["0,0"]!.building).toBe("Tower");
  });

  it("leaves a second, separately-built hex's entry untouched", () => {
    const resources = makeResources({
      coins: 1000,
      buildings: [{ hexKey: "5,5", kind: "House" }],
    });
    const world = worldWithTile({ terrain: "plain", location: null });
    const result = buildBuilding(resources, world, COORD, "House", "plain", "Human");
    expect(result.resources.buildings).toEqual([
      { hexKey: "5,5", kind: "House" },
      { hexKey: "0,0", kind: "House" },
    ]);
  });

  it("is a no-op when canBuildBuilding would reject it", () => {
    const resources = makeResources({ coins: 0 });
    const world = worldWithTile({ terrain: "plain", location: null });
    const result = buildBuilding(resources, world, COORD, "House", "plain", "Human");
    expect(result).toEqual({ resources, world });
  });
});
