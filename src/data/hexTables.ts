export type HotTerrain = "plain" | "mountain" | "forest" | "swamp" | "desert" | "water";
export type ColdTerrain = "plain" | "mountain" | "forest" | "glacier" | "tundra" | "water";
export type Terrain = HotTerrain | ColdTerrain;
export type Climate = "hot" | "cold";

/** Table: Terrain (Hot climate) (1d6) -- rolled against the *current* hex's own terrain. */
export const HOT_TERRAIN_TABLE: Record<number, Record<HotTerrain, HotTerrain>> = {
  1: { plain: "water", mountain: "desert", forest: "water", swamp: "water", desert: "desert", water: "water" },
  2: { plain: "mountain", mountain: "mountain", forest: "swamp", swamp: "water", desert: "desert", water: "water" },
  3: { plain: "forest", mountain: "mountain", forest: "mountain", swamp: "forest", desert: "swamp", water: "water" },
  4: { plain: "plain", mountain: "forest", forest: "forest", swamp: "forest", desert: "swamp", water: "mountain" },
  5: { plain: "plain", mountain: "forest", forest: "forest", swamp: "swamp", desert: "mountain", water: "swamp" },
  6: { plain: "plain", mountain: "plain", forest: "plain", swamp: "swamp", desert: "mountain", water: "plain" },
};

/** Table: Terrain (Cold climate) (1d6) -- an alternate table for cold/glacial continents. */
export const COLD_TERRAIN_TABLE: Record<number, Record<ColdTerrain, ColdTerrain>> = {
  1: { plain: "water", mountain: "tundra", forest: "water", glacier: "water", tundra: "water", water: "water" },
  2: { plain: "glacier", mountain: "mountain", forest: "glacier", glacier: "water", tundra: "tundra", water: "water" },
  3: { plain: "mountain", mountain: "mountain", forest: "mountain", glacier: "water", tundra: "tundra", water: "water" },
  4: { plain: "forest", mountain: "forest", forest: "forest", glacier: "glacier", tundra: "tundra", water: "water" },
  5: { plain: "tundra", mountain: "forest", forest: "forest", glacier: "mountain", tundra: "glacier", water: "water" },
  6: { plain: "plain", mountain: "plain", forest: "forest", glacier: "glacier", tundra: "mountain", water: "plain" },
};

/** Every outcome of the Location table (1d6, by land type) -- kept in full even though only a
 * handful are interactive in v1 (see `CITY_OR_FORTRESS`/`locationHasDungeon`); the rest render as
 * inert flavor (Reef/Portal/Oasis/Volcano/Thin Ice belong to later issues -- Underwater Caves,
 * Portal travel, etc.). */
export type LocationKind =
  | "orcCity"
  | "orcFortress"
  | "goblinCity"
  | "humanCity"
  | "humanFortress"
  | "dwarvenCity"
  | "dwarvenFortress"
  | "elvenCity"
  | "elvenFortress"
  | "gnomeCity"
  | "ruins"
  | "rocks"
  | "volcano"
  | "oasis"
  | "portal"
  | "reef"
  | "thinIce"
  | "nothing";

export type Land = "plain" | "mountain" | "forest" | "water" | "swamp" | "desert" | "glacier" | "tundra";

/** Table: Location (1d6, by land) -- only rolled if the "is there a location" check (1d6, a 6)
 * already succeeded. */
export const LOCATION_TABLE: Record<number, Record<Land, LocationKind>> = {
  1: {
    plain: "orcCity",
    mountain: "orcFortress",
    forest: "goblinCity",
    water: "rocks",
    swamp: "orcCity",
    desert: "orcCity",
    glacier: "thinIce",
    tundra: "orcCity",
  },
  2: {
    plain: "goblinCity",
    mountain: "orcCity",
    forest: "goblinCity",
    water: "rocks",
    swamp: "goblinCity",
    desert: "oasis",
    glacier: "thinIce",
    tundra: "ruins",
  },
  3: {
    plain: "ruins",
    mountain: "ruins",
    forest: "ruins",
    water: "nothing",
    swamp: "portal",
    desert: "oasis",
    glacier: "thinIce",
    tundra: "ruins",
  },
  4: {
    plain: "humanCity",
    mountain: "volcano",
    forest: "gnomeCity",
    water: "nothing",
    swamp: "portal",
    desert: "oasis",
    glacier: "portal",
    tundra: "ruins",
  },
  5: {
    plain: "humanCity",
    mountain: "dwarvenCity",
    forest: "elvenCity",
    water: "reef",
    swamp: "portal",
    desert: "portal",
    glacier: "portal",
    tundra: "portal",
  },
  6: {
    plain: "humanFortress",
    mountain: "dwarvenFortress",
    forest: "elvenFortress",
    water: "reef",
    swamp: "humanCity",
    desert: "humanCity",
    glacier: "portal",
    tundra: "humanCity",
  },
};

export const CITY_OR_FORTRESS: ReadonlySet<LocationKind> = new Set([
  "orcCity",
  "orcFortress",
  "goblinCity",
  "humanCity",
  "humanFortress",
  "dwarvenCity",
  "dwarvenFortress",
  "elvenCity",
  "elvenFortress",
  "gnomeCity",
]);

/** "In the city you can discover dungeons" / "Ruins: Explore as if it were a dungeon." City,
 * Fortress, and Ruins all offer the same minimal "enter a Core dungeon" action in v1 -- see
 * CLAUDE.md's Hexploring the World note for why this stays this thin. */
export function locationHasDungeon(loc: LocationKind | null): boolean {
  return loc === "ruins" || (loc !== null && CITY_OR_FORTRESS.has(loc));
}

/** "It is not possible to move on water without a boat" (no boats yet) / "Rocks: It is not
 * possible to pass here." */
export function isImpassable(terrain: Terrain, location: LocationKind | null): boolean {
  return terrain === "water" || location === "rocks";
}

/** "Plains take 1 day (1 provision); Mountains take 3 days (3 provisions); any other land type
 * takes 2 days (2 provisions)." */
export function travelCost(terrain: Terrain): number {
  if (terrain === "plain") return 1;
  if (terrain === "mountain") return 3;
  return 2;
}
