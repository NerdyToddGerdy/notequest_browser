import type { BuildingDef, BuildingKind } from "./types.ts";
import type { Terrain } from "./hexTables.ts";

/** Buildings (Expanded World, issue #27, `docs/game-rules-reference.md` lines 1668-1692) -- "There
 * comes a time in a hero's life when he must retire his sword..." Authored straight from
 * "Table: Buildings"; `defense` is real data (Warfare, issue #28, needs it) but unused mechanically
 * by anything in this pass. */
export const BUILDING_TABLE: Record<BuildingKind, BuildingDef> = {
  House: { name: "House", kind: "House", cost: 200, requirementText: "None.", defense: 2, tax: 0 },
  Tower: { name: "Tower", kind: "Tower", cost: 400, requirementText: "None.", defense: 4, tax: 0 },
  Palace: {
    name: "Palace",
    kind: "Palace",
    cost: 600,
    requirementText: "Be a Noble.",
    defense: 4,
    tax: 150,
  },
  Castle: {
    name: "Castle",
    kind: "Castle",
    cost: 600,
    requirementText: "Be a Noble.",
    defense: 5,
    tax: 100,
  },
  City: {
    name: "City",
    kind: "City",
    cost: 1000,
    requirementText: "Be a Lord.",
    defense: 6,
    tax: 200,
  },
  Fortress: {
    name: "Fortress",
    kind: "Fortress",
    cost: 3000,
    requirementText: "Be a King.",
    defense: 12,
    tax: 300,
  },
};

/** Rulebook row order, for consistent UI listing (not a strict tier order -- Palace and Castle are
 * lateral alternatives at the same cost/requirement, not one-before-the-other). */
export const BUILDING_ORDER: BuildingKind[] = [
  "House",
  "Tower",
  "Palace",
  "Castle",
  "City",
  "Fortress",
];

/** "Buildings on Plains have no change in cost, but buildings made on other lands cost twice as
 * much. Dwarves do not suffer this increase if it is in mountains and Elves do not suffer this
 * increase if it is in forests." A plain string-match one-liner, same shape as `hexTables.ts`'s
 * own `hasWaterWalk()`. */
function buildingCostExempt(raceName: string, terrain: Terrain): boolean {
  return (
    (raceName === "Dwarf" && terrain === "mountain") || (raceName === "Elf" && terrain === "forest")
  );
}

export function buildingCost(kind: BuildingKind, terrain: Terrain, raceName: string): number {
  const base = BUILDING_TABLE[kind].cost;
  return terrain === "plain" || buildingCostExempt(raceName, terrain) ? base : base * 2;
}

/** Sums each owned building's "Collect Taxes" value -- takes bare `BuildingKind`s rather than full
 * `OwnedBuilding` records so this stays a pure data-file function with no dependency on
 * `engine/dungeonState.ts`'s runtime type. */
export function buildingTaxTotal(kinds: BuildingKind[]): number {
  return kinds.reduce((total, kind) => total + BUILDING_TABLE[kind].tax, 0);
}

/** House/Tower need nothing; Palace/Castle need the Noble title; City needs Lord; Fortress needs
 * King -- matches `ADVANCED_CLASS_TABLE`'s own `requirementText` for each title exactly. */
export function buildingRequirementMet(kind: BuildingKind, advancedClasses: string[]): boolean {
  switch (kind) {
    case "Palace":
    case "Castle":
      return advancedClasses.includes("Noble");
    case "City":
      return advancedClasses.includes("Lord");
    case "Fortress":
      return advancedClasses.includes("King");
    default:
      return true;
  }
}
