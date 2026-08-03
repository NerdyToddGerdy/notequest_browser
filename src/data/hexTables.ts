export type HotTerrain = "plain" | "mountain" | "forest" | "swamp" | "desert" | "water";
export type ColdTerrain = "plain" | "mountain" | "forest" | "glacier" | "tundra" | "water";
/** The eight terrains the ordinary hexcrawl generates. Kept as its own name (rather than letting
 * `Terrain` mean this) so the overworld-only tables below -- `EVENT_TABLE`, `DUNGEON_TYPE_BY_TERRAIN`
 * -- stay exhaustive over exactly the terrains they can actually see, instead of growing
 * meaningless rows for Magma and Caramel Plain when the Other Worlds (issue #105) widened
 * `Terrain`. */
export type OverworldTerrain = HotTerrain | ColdTerrain;

/** Terrain that only exists inside one of the four Other Worlds (issue #105). Each realm draws from
 * its own 1d6 table (`src/data/otherWorlds.ts`) rather than the Hot/Cold terrain tables, and several
 * of these hurt you just for standing on them -- see `REALM_TERRAIN_HAZARD`. */
export type RealmTerrain =
  | "magma"
  | "seaOfBlood"
  | "forestOfImpaled"
  | "plainOfThorns"
  | "milkShakeSea"
  | "lollipopForest"
  | "marshmallowMountain"
  | "caramelPlain";

export type Terrain = OverworldTerrain | RealmTerrain;
export type Climate = "hot" | "cold";

/** Table: Terrain (Hot climate) (1d6) -- rolled against the *current* hex's own terrain. */
export const HOT_TERRAIN_TABLE: Record<number, Record<HotTerrain, HotTerrain>> = {
  1: {
    plain: "water",
    mountain: "desert",
    forest: "water",
    swamp: "water",
    desert: "desert",
    water: "water",
  },
  2: {
    plain: "mountain",
    mountain: "mountain",
    forest: "swamp",
    swamp: "water",
    desert: "desert",
    water: "water",
  },
  3: {
    plain: "forest",
    mountain: "mountain",
    forest: "mountain",
    swamp: "forest",
    desert: "swamp",
    water: "water",
  },
  4: {
    plain: "plain",
    mountain: "forest",
    forest: "forest",
    swamp: "forest",
    desert: "swamp",
    water: "mountain",
  },
  5: {
    plain: "plain",
    mountain: "forest",
    forest: "forest",
    swamp: "swamp",
    desert: "mountain",
    water: "swamp",
  },
  6: {
    plain: "plain",
    mountain: "plain",
    forest: "plain",
    swamp: "swamp",
    desert: "mountain",
    water: "plain",
  },
};

/** Table: Terrain (Cold climate) (1d6) -- an alternate table for cold/glacial continents. */
export const COLD_TERRAIN_TABLE: Record<number, Record<ColdTerrain, ColdTerrain>> = {
  1: {
    plain: "water",
    mountain: "tundra",
    forest: "water",
    glacier: "water",
    tundra: "water",
    water: "water",
  },
  2: {
    plain: "glacier",
    mountain: "mountain",
    forest: "glacier",
    glacier: "water",
    tundra: "tundra",
    water: "water",
  },
  3: {
    plain: "mountain",
    mountain: "mountain",
    forest: "mountain",
    glacier: "water",
    tundra: "tundra",
    water: "water",
  },
  4: {
    plain: "forest",
    mountain: "forest",
    forest: "forest",
    glacier: "glacier",
    tundra: "tundra",
    water: "water",
  },
  5: {
    plain: "tundra",
    mountain: "forest",
    forest: "forest",
    glacier: "mountain",
    tundra: "glacier",
    water: "water",
  },
  6: {
    plain: "plain",
    mountain: "plain",
    forest: "forest",
    glacier: "glacier",
    tundra: "mountain",
    water: "plain",
  },
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
  | "nothing"
  // Other Worlds (issue #105) -- these only ever appear inside a realm, rolled from that realm's
  // own Location table rather than `LOCATION_TABLE`.
  /** Hell, "like the Orc City" -- hostile, but a city. */
  | "demonCity"
  /** Hell and Pesadelum, "like Human City" -- the one refuge in either place. */
  | "cityOfSurvivors"
  /** Underworld: "cannot pass through" -- but unlike Rocks, "you can spend 1 provision to wait for
   * it to dissipate," so it's *conditionally* impassable. */
  | "denseFog"
  /** Pesadelum: "Abandoned House (find 1d6-1 coins)." */
  | "abandonedHouse"
  /** Pesadelum's own Goblin Fortress -- the overworld's Location table never rolls one. */
  | "goblinFortress"
  /** Candy World, both hostile. */
  | "chocolateCity"
  | "mandolateFortress"
  /** Candy World: "Nothing. Just peanuts on the floor." */
  | "peanuts";

export type Land =
  "plain" | "mountain" | "forest" | "water" | "swamp" | "desert" | "glacier" | "tundra";

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
  // Other Worlds (issue #105): "Demon City (like the Orc City)", "City of Survivors (like Human
  // City)", Pesadelum's Goblin Fortress, and Candy World's own two. Included so `TownScreen` still
  // renders -- Rest and Buy are what make a realm survivable at all. The overworld-only City
  // Actions (Ask/Politics/Recruit/Attack/Hire Boat) are gated separately, by realm.
  "demonCity",
  "cityOfSurvivors",
  "goblinFortress",
  "chocolateCity",
  "mandolateFortress",
]);

/** "In the city you can discover dungeons" / "Ruins: Explore as if it were a dungeon." City,
 * Fortress, and Ruins all offer the same minimal "enter a Core dungeon" action in v1 -- see
 * CLAUDE.md's Hexploring the World note for why this stays this thin. */
export function locationHasDungeon(loc: LocationKind | null): boolean {
  return loc === "ruins" || (loc !== null && CITY_OR_FORTRESS.has(loc));
}

/** True for the four playable Fortress locations (Orc/Human/Dwarven/Elven) -- Goblin and Gnome only
 * ever roll a City per "Table: Location," never a Fortress. "Getting Money" (issue #58) needs this
 * to distinguish Hard Work (City-only) and Arena (Fortress-only) from the rest of "Cities and
 * Fortresses," which the rulebook applies to both uniformly. */
export function isFortressLocation(loc: LocationKind | null | undefined): boolean {
  // Tolerates `undefined`, not just `null`: `nextTerrain()` documents that a hex's terrain is trusted
  // to belong to its world's own climate set, and that invariant holds for every generated world --
  // but a hand-built or hand-edited `WorldState` mixing e.g. a glacier tile into a hot world makes
  // the terrain lookup miss, and every downstream lookup with it. Better a false answer than a crash
  // in a helper this widely called (issue #98 added a call inside hex generation itself).
  return !!loc && loc.endsWith("Fortress");
}

/** "It is not possible to move on water without a boat" / "Rocks: It is not possible to pass
 * here." `hasBoat` (see `WorldState.hasBoat`, set by the "Hire Boat" City Action) lifts the water
 * restriction specifically -- "you travel normally" on water once hired, no exception for Rocks. */
export function isImpassable(
  terrain: Terrain,
  location: LocationKind | null,
  hasBoat = false,
): boolean {
  return (terrain === "water" && !hasBoat) || location === "rocks";
}

/** Display names for each terrain -- lives here beside the terrain tables rather than in a component,
 * since both `HexInspector` (a hex's own description) and `WorldScreen` (Portals' destination picker,
 * issue #21) label terrain. */
export const TERRAIN_LABEL: Record<Terrain, string> = {
  plain: "Plain",
  mountain: "Mountain",
  forest: "Forest",
  swamp: "Swamp",
  desert: "Desert",
  water: "Water",
  glacier: "Glacier",
  tundra: "Tundra",
  // Other Worlds (issue #105).
  magma: "Magma",
  seaOfBlood: "Sea of Blood",
  forestOfImpaled: "Forest of the Impaled",
  plainOfThorns: "Plain of Thorns",
  milkShakeSea: "Milk Shake Sea",
  lollipopForest: "Lollipop Forest",
  marshmallowMountain: "Marshmallow Mountain",
  caramelPlain: "Caramel Plain",
};

/** Terrain you cannot cross without a boat -- the overworld's Water plus the two Other-World seas
 * (issue #105), which are water by another name. Kept as a set rather than a string comparison so
 * `isImpassable()` and the boat-clearing rule in `hexReducer` can't drift apart. */
export const WATER_TERRAIN: ReadonlySet<Terrain> = new Set<Terrain>([
  "water",
  "seaOfBlood",
  "milkShakeSea",
]);

const OVERWORLD_TERRAINS: ReadonlySet<string> = new Set<OverworldTerrain>([
  "plain",
  "mountain",
  "forest",
  "swamp",
  "desert",
  "water",
  "glacier",
  "tundra",
]);

const HOT_TERRAINS: ReadonlySet<string> = new Set<HotTerrain>([
  "plain",
  "mountain",
  "forest",
  "swamp",
  "desert",
  "water",
]);

const COLD_TERRAINS: ReadonlySet<string> = new Set<ColdTerrain>([
  "plain",
  "mountain",
  "forest",
  "glacier",
  "tundra",
  "water",
]);

/** Climate transitions (issue #107): whether a terrain is a legal *parent* for the given climate's
 * table -- i.e. whether that table has a column for it. Needed because a single world can now
 * contain both bands, so `nextTerrain()` can be handed a `swamp` parent while resolving a cold
 * neighbour, which `COLD_TERRAIN_TABLE` has no column for at all.
 *
 * The four shared members (`plain`/`mountain`/`forest`/`water`) are legal in both, which is exactly
 * what makes a transition possible without inventing any new terrain or table rows -- only
 * `swamp`/`desert` (hot-only) and `glacier`/`tundra` (cold-only) are exclusive. */
export function terrainBelongsToClimate(terrain: Terrain, climate: Climate): boolean {
  return climate === "hot" ? HOT_TERRAINS.has(terrain) : COLD_TERRAINS.has(terrain);
}

/** Narrows a `Terrain` to the eight the ordinary hexcrawl generates. The overworld-only tables
 * (`DUNGEON_TYPE_BY_TERRAIN`, `EVENT_TABLE`) are keyed by `OverworldTerrain`, so every site that
 * might now be looking at an Other World's hex (issue #105) has to say which case it's in rather
 * than index blindly -- the compiler makes those sites impossible to miss, which is the point. */
export function isOverworldTerrain(terrain: Terrain): terrain is OverworldTerrain {
  return OVERWORLD_TERRAINS.has(terrain);
}

/** "Plains take 1 day (1 provision); Mountains take 3 days (3 provisions); any other land type
 * takes 2 days (2 provisions)." */
export function travelCost(terrain: Terrain): number {
  if (terrain === "plain") return 1;
  if (terrain === "mountain") return 3;
  return 2;
}

/** Patovsky/Sharkin (New Races, issue #22): "You can walk in water territories." Checked alongside
 * `WorldState.hasBoat` wherever water passability matters (`WorldScreen.tsx`'s `canTravelTo()`,
 * `hexReducer.ts`'s `MOVE` case). Patovsky's *other* clause ("and can skip travel events" -- Sharkin
 * has no such clause) is now real too, but lives with the rest of the Events machinery in
 * `events.ts`'s `eventSkipReason()` rather than here (issue #91). */
export function hasWaterWalk(raceName: string): boolean {
  return raceName === "Patovsky" || raceName === "Sharkin";
}

/** Pandakhan/Centaur (New Races, issue #22): "Spend twice as much provisions" / "Spend half of
 * your provisions when moving around the map." Applied on top of `travelCost()`'s base terrain
 * cost by `WorldScreen.tsx`'s `handleTravel()`, same layering Elven Boots' forest override already
 * uses. Centaur's half rounds up (`Math.ceil`) so a move never costs 0 provisions outright. */
export function travelCostMultiplier(raceName: string): number {
  if (raceName === "Pandakhan") return 2;
  if (raceName === "Centaur") return 0.5;
  return 1;
}

/** "Table: Dungeon Type (1d6, by terrain)" (`docs/game-rules-reference.md` lines 990-999) -- values
 * are `DUNGEON_TYPES` roll numbers (`src/data/dungeonTypes.ts`), i.e. what a `ROLL_DUNGEON` action's
 * `typeRoll` would be, not a parallel table of its own. The rulebook's real table references 8
 * dungeon types beyond the Core 6 -- Citadel/Pyramid/Ziggurat/Necropolis shipped in issue #30 and
 * now use their real roll numbers (7/8/9/10 in `DUNGEON_TYPES`, see `dungeonTypes.ts`) below; Mine/
 * Cave is still unbuilt (tracked as the rest of #30) and stays substituted with the
 * closest thematic match among the types that exist, same "documented, deliberate simplification"
 * precedent as `bladeTrap`'s roll-of-2 flavor-only outcome or `WeaponEntry.twoHanded`: Cave
 * (a tunneled stronghold) -> Prison (6). Laboratory is real as of the same issue and uses its own
 * roll number (12). Mine now maps to **Sewers** (11)
 * instead, which is a far closer match -- both are tunnel complexes -- now that Sewers exists.
 * Sewers also has its own rulebook route that this table doesn't cover: "every fortress has a sewer
 * complex," a sub-roll on entering a Fortress (issue #99, still unbuilt). `water` and `glacier` rows are
 * unreachable in practice today (no City/Fortress/Ruins ever rolls on water per `LOCATION_TABLE`;
 * `glacier` only exists in the still-unused `COLD_TERRAIN_TABLE`) but are filled in for
 * `Record<Terrain, ...>`'s type completeness rather than left to throw. */
/** The four terrains a Ruins hex can generate on, per `LOCATION_TABLE` -- exactly the four columns
 * the Ruins table prints, which is why it needs no Swamp/Desert/Water/Glacier rows. */
export type RuinsTerrain = "plain" | "mountain" | "forest" | "tundra";

const RUINS_TERRAINS: ReadonlySet<string> = new Set<RuinsTerrain>([
  "plain",
  "mountain",
  "forest",
  "tundra",
]);

export function isRuinsTerrain(terrain: Terrain): terrain is RuinsTerrain {
  return RUINS_TERRAINS.has(terrain);
}

/** Issue #98: the two dungeons the Ruins table marks with an asterisk -- "once you put one on your
 * map it can't appear again; if rolled again, roll again."
 *
 * Tracked by the **notional rulebook type**, not by whatever type is actually built. Neither Entrails
 * nor Mega Dungeon exists yet (both are #30's), so a roll of 12 currently builds a thematic
 * substitute -- and attaching the once-per-world rule to the *substitute* would be flatly wrong,
 * silently locking a common type out of the whole world. Keying it to the name means the rule is
 * honored today and stays correct the moment those types are real. */
export type UniqueDungeonKey = "entrails" | "megaDungeon";

/** "Table: Dungeon Type (2d6, by ruins terrain)" (`docs/game-rules-reference.md` lines 1078-1088,
 * issue #98) -- a Ruins hex has its own table, genuinely different from the 1d6
 * `DUNGEON_TYPE_BY_TERRAIN` every other hex uses: 2d6, banded rows, and a different type spread.
 *
 * Values are `DUNGEON_TYPES` roll numbers, same as `DUNGEON_TYPE_BY_TERRAIN`. Five of its cells name
 * types #30 hasn't built, substituted with the closest thematic match among those that exist -- the
 * same documented approach that table already uses: Cave (a tunnel complex) -> Sewers (11), Mine ->
 * Sewers (11). Laboratory needs no substitute anymore -- it's real (12) as of the same issue.
 * `unique` marks the asterisked cells. */
export interface RuinsDungeonResult {
  typeRoll: number;
  unique?: UniqueDungeonKey;
}

export const RUINS_DUNGEON_TYPE: Record<RuinsTerrain, Record<number, RuinsDungeonResult>> = {
  //  2-4 Cave->Sewers | 5-7 as printed | 8-9 Laboratory / Citadel / Ziggurat | 10-11 | 12 unique
  plain: {
    2: { typeRoll: 11 },
    3: { typeRoll: 11 },
    4: { typeRoll: 11 },
    5: { typeRoll: 1 },
    6: { typeRoll: 1 },
    7: { typeRoll: 1 },
    8: { typeRoll: 12 },
    9: { typeRoll: 12 },
    10: { typeRoll: 8 },
    11: { typeRoll: 8 },
    12: { typeRoll: 8, unique: "entrails" },
  },
  mountain: {
    2: { typeRoll: 11 },
    3: { typeRoll: 11 },
    4: { typeRoll: 11 },
    5: { typeRoll: 2 },
    6: { typeRoll: 2 },
    7: { typeRoll: 2 },
    8: { typeRoll: 7 },
    9: { typeRoll: 7 },
    10: { typeRoll: 11 },
    11: { typeRoll: 11 },
    12: { typeRoll: 7, unique: "megaDungeon" },
  },
  forest: {
    2: { typeRoll: 11 },
    3: { typeRoll: 11 },
    4: { typeRoll: 11 },
    5: { typeRoll: 3 },
    6: { typeRoll: 3 },
    7: { typeRoll: 3 },
    8: { typeRoll: 12 },
    9: { typeRoll: 12 },
    10: { typeRoll: 9 },
    11: { typeRoll: 9 },
    12: { typeRoll: 9, unique: "entrails" },
  },
  tundra: {
    2: { typeRoll: 11 },
    3: { typeRoll: 11 },
    4: { typeRoll: 11 },
    5: { typeRoll: 6 },
    6: { typeRoll: 6 },
    7: { typeRoll: 6 },
    8: { typeRoll: 9 },
    9: { typeRoll: 9 },
    10: { typeRoll: 10 },
    11: { typeRoll: 10 },
    12: { typeRoll: 10, unique: "megaDungeon" },
  },
};

export const DUNGEON_TYPE_BY_TERRAIN: Record<OverworldTerrain, Record<number, number>> = {
  plain: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 }, // Palace, Crypt, Tomb, Sanctuary, Temple, Prison
  mountain: { 1: 2, 2: 4, 3: 6, 4: 7, 5: 11, 6: 6 }, // Crypt, Sanctuary, Prison, Citadel, Mine->Sewers, Cave->Prison
  forest: { 1: 3, 2: 5, 3: 1, 4: 5, 5: 12, 6: 6 }, // Tomb, Temple, Palace, Temple, Laboratory, Cave->Prison
  swamp: { 1: 2, 2: 3, 3: 4, 4: 5, 5: 11, 6: 10 }, // Crypt, Tomb, Sanctuary, Temple, Sewers, Necropolis
  desert: { 1: 6, 2: 1, 3: 4, 4: 5, 5: 8, 6: 8 }, // Prison, Palace, Sanctuary, Temple, Pyramid, Pyramid
  tundra: { 1: 6, 2: 1, 3: 2, 4: 3, 5: 9, 6: 9 }, // Prison, Palace, Crypt, Tomb, Ziggurat, Ziggurat
  water: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 }, // unreachable -- no dungeon-bearing location ever rolls on water
  glacier: { 1: 6, 2: 1, 3: 2, 4: 3, 5: 9, 6: 9 }, // unreachable while climate is hardcoded "hot" -- mirrors tundra's row
};
