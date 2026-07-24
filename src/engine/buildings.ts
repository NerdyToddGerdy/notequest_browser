import { buildingCost, buildingRequirementMet } from "../data/buildings.ts";
import type { BuildingKind } from "../data/types.ts";
import type { Terrain } from "../data/hexTables.ts";
import { hexKey, withBuilding, type HexCoord, type HexTile, type WorldState } from "./hexState.ts";
import type { OwnedBuilding } from "./dungeonState.ts";
import type { AdventurerResources } from "./town.ts";

/** Buildings (Expanded World, issue #27) -- purchased with coins on an empty hex, mirroring
 * `animals.ts`'s "self-contained engine module" precedent. An already-built hex still qualifies
 * (for its own upgrade path); only a hex with a rolled `location` (a City/Fortress/Ruins/etc.) is
 * excluded. */
export function qualifiesForBuilding(tile: HexTile): boolean {
  return tile.location === null;
}

/** The coin cost to build/upgrade `kind` here -- 0-floored against whatever's already on this hex
 * ("It is possible to build on top of another building, spending only the difference in cost"). */
function costFor(tile: HexTile, kind: BuildingKind, terrain: Terrain, raceName: string): number {
  const newCost = buildingCost(kind, terrain, raceName);
  const oldCost = tile.building ? buildingCost(tile.building, terrain, raceName) : 0;
  return Math.max(0, newCost - oldCost);
}

export function canBuildBuilding(
  resources: AdventurerResources,
  tile: HexTile | undefined,
  kind: BuildingKind,
  terrain: Terrain,
  raceName: string,
): boolean {
  if (!tile || !qualifiesForBuilding(tile)) return false;
  if (!buildingRequirementMet(kind, resources.advancedClasses)) return false;
  return resources.coins >= costFor(tile, kind, terrain, raceName);
}

/** Spends the (possibly upgrade-difference) cost, replaces or appends this hex's entry in
 * `resources.buildings`, and stamps `world.tiles[hexKey].building`. Returns both unchanged if
 * `canBuildBuilding()` would reject it, same "no-op on an invalid call" contract as
 * `acquireAdvancedClass`. */
export function buildBuilding(
  resources: AdventurerResources,
  world: WorldState,
  coord: HexCoord,
  kind: BuildingKind,
  terrain: Terrain,
  raceName: string,
): { resources: AdventurerResources; world: WorldState } {
  const tile = world.tiles[hexKey(coord)];
  if (!canBuildBuilding(resources, tile, kind, terrain, raceName)) return { resources, world };
  const cost = costFor(tile!, kind, terrain, raceName);
  const key = hexKey(coord);
  const existingIndex = resources.buildings.findIndex((b) => b.hexKey === key);
  const entry: OwnedBuilding = { hexKey: key, kind };
  const buildings =
    existingIndex >= 0
      ? resources.buildings.map((b, i) => (i === existingIndex ? entry : b))
      : [...resources.buildings, entry];
  return {
    resources: { ...resources, coins: resources.coins - cost, buildings },
    world: withBuilding(world, coord, kind),
  };
}
