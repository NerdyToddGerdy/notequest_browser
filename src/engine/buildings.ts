import { BUILDING_TABLE, buildingCost, buildingRequirementMet } from "../data/buildings.ts";
import type { BuildingKind } from "../data/types.ts";
import type { Terrain } from "../data/hexTables.ts";
import {
  hexKey,
  parseHexKey,
  withBuilding,
  type HexCoord,
  type HexTile,
  type WorldState,
} from "./hexState.ts";
import type { Consumable, HeldItem, OwnedBuilding } from "./dungeonState.ts";
import { maxHeldItemsFor, packUsedSlots, type AdventurerResources } from "./town.ts";
import { rollDie } from "./dice.ts";
import type { RNG } from "./rng.ts";

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

// -- Storage (issue #102, rules 1687-1689) -------------------------------------------------------
//
// "In a building you can store any number of items found in dungeons. However, whenever you leave a
// dungeon roll a die. If it drops a number greater than the building's Defense value, a random item
// has been stolen."
//
// Two things the rulebook settles that are worth stating, because both differ from what the issue
// assumed. Capacity is **unlimited** -- `defense` is the stat that scales across the table, not
// capacity, so a House holds as much as a Fortress and simply loses things far more often. And the
// theft roll is a plain 1d6 against Defense, which means a City (6) and a Fortress (12) can never
// be robbed at all: the top of the table buys certainty rather than volume.
//
// Storage lives on `HexTile` (see `HexTile.storedItems`) rather than on `OwnedBuilding`, since #121
// made `resources.buildings` a derived view of the map rather than a source of truth.

/** Everything stored at one hex, as a flat list for display and for picking a theft victim. */
export interface StoredContents {
  items: HeldItem[];
  consumables: Consumable[];
}

export function storedAt(world: WorldState, coord: HexCoord): StoredContents {
  const tile = world.tiles[hexKey(coord)];
  return { items: tile?.storedItems ?? [], consumables: tile?.storedConsumables ?? [] };
}

export function storedCount(contents: StoredContents): number {
  return contents.items.length + contents.consumables.length;
}

/** Storing is only possible standing on your own building -- there's no remote depositing. */
export function canUseStorage(world: WorldState, coord: HexCoord): boolean {
  return world.tiles[hexKey(coord)]?.building !== undefined;
}

function withStored(
  world: WorldState,
  coord: HexCoord,
  items: HeldItem[],
  consumables: Consumable[],
): WorldState {
  const key = hexKey(coord);
  const tile = world.tiles[key];
  if (!tile) return world;
  return {
    ...world,
    tiles: {
      ...world.tiles,
      [key]: { ...tile, storedItems: items, storedConsumables: consumables },
    },
  };
}

/** Moves one carried item into the building here. No capacity check -- "any number of items" -- so
 * the only thing that can reject this is not standing on a building, or a bad index. */
export function depositItem(
  resources: AdventurerResources,
  world: WorldState,
  coord: HexCoord,
  list: "heldItems" | "consumables",
  index: number,
): { resources: AdventurerResources; world: WorldState } {
  if (!canUseStorage(world, coord)) return { resources, world };
  const stored = storedAt(world, coord);
  if (list === "heldItems") {
    const item = resources.heldItems[index];
    if (!item) return { resources, world };
    return {
      resources: { ...resources, heldItems: resources.heldItems.filter((_, i) => i !== index) },
      world: withStored(world, coord, [...stored.items, item], stored.consumables),
    };
  }
  const potion = (resources.consumables ?? [])[index];
  if (!potion) return { resources, world };
  return {
    resources: {
      ...resources,
      consumables: (resources.consumables ?? []).filter((_, i) => i !== index),
    },
    world: withStored(world, coord, stored.items, [...stored.consumables, potion]),
  };
}

/** True while there's a free Pack slot to withdraw *into* -- the cap applies on the way out even
 * though it never applied on the way in, which is the whole point of a stash. */
export function canWithdraw(resources: AdventurerResources): boolean {
  return packUsedSlots(resources) < maxHeldItemsFor(resources.hireling, resources.animals);
}

export function withdrawItem(
  resources: AdventurerResources,
  world: WorldState,
  coord: HexCoord,
  list: "heldItems" | "consumables",
  index: number,
): { resources: AdventurerResources; world: WorldState } {
  if (!canUseStorage(world, coord) || !canWithdraw(resources)) return { resources, world };
  const stored = storedAt(world, coord);
  if (list === "heldItems") {
    const item = stored.items[index];
    if (!item) return { resources, world };
    return {
      resources: { ...resources, heldItems: [...resources.heldItems, item] },
      world: withStored(
        world,
        coord,
        stored.items.filter((_, i) => i !== index),
        stored.consumables,
      ),
    };
  }
  const potion = stored.consumables[index];
  if (!potion) return { resources, world };
  return {
    resources: { ...resources, consumables: [...(resources.consumables ?? []), potion] },
    world: withStored(
      world,
      coord,
      stored.items,
      stored.consumables.filter((_, i) => i !== index),
    ),
  };
}

/** What a theft roll took, for the caller's own notification -- `null` when nothing was stolen. */
export interface StorageTheft {
  hexKey: string;
  kind: BuildingKind;
  itemName: string;
  roll: number;
}

/**
 * "Whenever you leave a dungeon roll a die. If it drops a number greater than the building's
 * Defense value, a random item has been stolen."
 *
 * One roll **per building that actually holds something** -- each has its own Defense, so the rule
 * can only be read per-building. An empty building is skipped entirely rather than rolling for
 * nothing.
 *
 * Fired from `App.tsx`'s `handleReturnToTown`, the same funnel the Laboratory's mutation uses and
 * for the same reason: it is the one place a *living* character leaves a dungeon. A character who
 * dies down there doesn't come home to find the silver missing -- their successor inherits the
 * stash intact, which follows from contents being part of the estate.
 */
export function resolveStorageTheft(
  world: WorldState,
  rng: RNG = Math.random,
): { world: WorldState; thefts: StorageTheft[] } {
  let next = world;
  const thefts: StorageTheft[] = [];
  for (const [key, tile] of Object.entries(world.tiles)) {
    if (!tile.building) continue;
    const coord = parseHexKey(key);
    const stored = storedAt(next, coord);
    const total = storedCount(stored);
    if (total === 0) continue;

    const roll = rollDie(rng);
    if (roll <= BUILDING_TABLE[tile.building].defense) continue;

    // A random item across both lists together, so a stash of potions is exactly as exposed as a
    // stash of sellables rather than one list being quietly safe.
    const victim = Math.floor(rng() * total);
    if (victim < stored.items.length) {
      const taken = stored.items[victim]!;
      thefts.push({ hexKey: key, kind: tile.building, itemName: taken.name, roll });
      next = withStored(
        next,
        coord,
        stored.items.filter((_, i) => i !== victim),
        stored.consumables,
      );
    } else {
      const potionIndex = victim - stored.items.length;
      const taken = stored.consumables[potionIndex]!;
      thefts.push({ hexKey: key, kind: tile.building, itemName: taken.name, roll });
      next = withStored(
        next,
        coord,
        stored.items,
        stored.consumables.filter((_, i) => i !== potionIndex),
      );
    }
  }
  return { world: next, thefts };
}
