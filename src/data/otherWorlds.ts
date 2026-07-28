import type { EventBand, EventEffect } from "./events.ts";
import type { LocationKind, RealmTerrain, Terrain } from "./hexTables.ts";
import type { MonsterTemplate } from "./dungeonTables.ts";
import type { OtherWorldKey } from "./portals.ts";

/** "Other Worlds" (`docs/game-rules-reference.md` lines 1119-1290, issue #105 / #21 stage 2) -- the
 * four realms a portal can drop you into. Each is *"a new map, using the tables below"*: its own
 * Terrain (1d6), Location (1d6) and Event (2d6) tables, sharing none of the overworld's data.
 *
 * Scoped to survival (confirmed with the user): terrain, locations, events, hazards, per-world
 * rewards and portals home are all real. Dungeons, Buildings, Politics, Warfare, Ask and Animal
 * training are overworld-only — you are a visitor here. That's why these tables need no
 * dungeon-type row and why `RealmTerrain` is a separate union from `OverworldTerrain`.
 */
export interface RealmDef {
  key: OtherWorldKey;
  name: string;
  /** "You start on a Plain" / "on a Swamp" / "on a Caramel Plain." */
  startTerrain: Terrain;
  /** Rolled 1d6 for each newly-revealed hex. Unlike the overworld's tables this doesn't depend on
   * the neighbouring hex's own terrain -- the rulebook's realm tables are flat 1d6 lookups.
   *
   * Note these are `Terrain`, not `RealmTerrain`: three of the four realms reuse ordinary Mountain/
   * Plain/Water/Swamp for their mundane hexes and only name the *hostile* ones (Magma, Sea of Blood,
   * Forest of Impaled, Plain of Thorns) -- Candy World is the only one whose every terrain is its
   * own. Reusing the overworld's names is the rulebook's own choice, and it means travel cost and
   * passability already work for them. */
  terrain: Record<number, Terrain>;
  /** Rolled 1d6 per revealed hex. Note these are *unconditional*: unlike the overworld, where a
   * separate 1d6 must first come up 6 for a location to exist at all, the realm tables list a
   * result for every roll -- several of which are the realm's own "nothing here" row. */
  location: Record<number, LocationKind>;
  /** 2d6 on entering a hex, same band structure as the overworld's Events on Travel (#91): a total
   * of 7 or more is "Nothing happens...". */
  event: Record<number, RealmEventRow>;
  /** Shown once, on arrival. */
  arrivalFlavor: string;
}

export interface RealmEventRow {
  text: string;
  /** Exactly one of `monsters`/`effect` is set, same shape as the overworld's `EventRow`. */
  monsters?: MonsterTemplate;
  effect?: RealmEventEffect;
}

/** The overworld's own effects, plus the two shapes only a realm produces. */
export type RealmEventEffect =
  | EventEffect
  /** Underworld's roll of 6: "You have found the soul of an ancient dead adventurer. If you want to
   * help him, roll 1d6. If it's 6 his soul will follow you and resurrect when he returns to the
   * world of the living." A companion with a delayed payoff, unlike anything else in the game. */
  | { kind: "ancientSoul" }
  /** Pesadelum's "Temporal distortion (move to random 1 hex)" -- an *adjacent* hop, unlike the
   * overworld Storm's map-wide `moveToRandomHex`. */
  | { kind: "moveToRandomAdjacent"; damage?: number }
  /** Forest of the Impaled's roll-of-1: "you are catatonic." Read as losing your next move
   * (confirmed with the user) -- see `realms.ts`'s `realmTerrainHazard()`. */
  | { kind: "catatonic" };

/** What standing on a given realm terrain costs you, applied on arrival (issue #105).
 * `moveToRandomAdjacent` doubles as Sea of Blood's "you take 3 damage and move to a random adjacent
 * hex" -- the same effect Pesadelum's Temporal distortion event produces, reused rather than
 * modelled twice. */
export const REALM_TERRAIN_HAZARD: Partial<Record<RealmTerrain, RealmEventEffect>> = {
  /** "If you enter this hex, you take 6d6 damage. There are no locations here." */
  magma: { kind: "loseHp", amount: 0 }, // amount is rolled -- see `realmTerrainHazard()`
  /** "If you land here you take 3 damage and move to a random adjacent hex." */
  seaOfBlood: { kind: "moveToRandomAdjacent", damage: 3 },
  /** "Take 1 damage when entering this terrain." */
  plainOfThorns: { kind: "loseHp", amount: 1 },
  // Forest of the Impaled's "roll a die, on a 1 you are catatonic" isn't a flat effect -- it needs
  // its own roll, so it's handled in `realmTerrainHazard()` rather than listed here.
};

const NOTHING_HAPPENS: RealmEventRow = { text: "Nothing happens..." };

// --- Hell ----------------------------------------------------------------------------------------

const HELL: RealmDef = {
  key: "hell",
  name: "Hell",
  startTerrain: "plain",
  terrain: { 1: "magma", 2: "magma", 3: "mountain", 4: "plain", 5: "plain", 6: "plain" },
  location: {
    1: "demonCity",
    2: "demonCity",
    3: "demonCity",
    4: "portal",
    5: "portal",
    6: "cityOfSurvivors",
  },
  event: {
    2: {
      text: "An Infernal Baron blocks your path.",
      monsters: { name: "Infernal Baron", hp: 60, damage: 9, abilities: [], count: 1 },
    },
    3: {
      text: "A Demon Lord strides out of the heat.",
      monsters: { name: "Demon Lord", hp: 30, damage: 8, abilities: [], count: 1 },
    },
    4: {
      text: "A Demon finds you.",
      monsters: { name: "Demon", hp: 10, damage: 3, abilities: [], count: 1 },
    },
    5: {
      text: "Imps swarm out of the cracks.",
      monsters: {
        name: "Imps",
        singularName: "Imp",
        hp: 2,
        damage: 1,
        abilities: [],
        count: { dice: 2, sides: 6 },
      },
    },
    6: { text: "Fire rains from the sky.", effect: { kind: "loseHp", amount: 3 } },
  },
  arrivalFlavor: "The air is ash and the ground is warm. This is Hell.",
};

// --- Underworld ----------------------------------------------------------------------------------

const UNDERWORLD: RealmDef = {
  key: "underworld",
  name: "the Underworld",
  startTerrain: "swamp",
  terrain: { 1: "water", 2: "water", 3: "mountain", 4: "swamp", 5: "swamp", 6: "swamp" },
  location: {
    1: "denseFog",
    2: "denseFog",
    3: "denseFog",
    4: "denseFog",
    5: "portal",
    6: "portal",
  },
  event: {
    2: {
      text: "The Death itself has noticed you.",
      monsters: { name: "The Death", hp: 30, damage: 3, abilities: ["deathtouch"], count: 1 },
    },
    3: {
      text: "A Ghost drifts through you.",
      monsters: { name: "Ghost", hp: 4, damage: 3, abilities: ["intangible"], count: 1 },
    },
    4: {
      text: "A lesser Ghost bars the way.",
      monsters: { name: "Ghost", hp: 2, damage: 2, abilities: ["intangible"], count: 1 },
    },
    5: { text: "An ominous fog rolls in.", effect: { kind: "loseProvisions", amount: 1 } },
    6: {
      text: "You have found the soul of an ancient dead adventurer.",
      effect: { kind: "ancientSoul" },
    },
  },
  arrivalFlavor: "Cold, and quieter than anywhere has a right to be. This is the Underworld.",
};

// --- Pesadelum -----------------------------------------------------------------------------------

const PESADELUM: RealmDef = {
  key: "pesadelum",
  name: "Pesadelum",
  // "You start on a Plain" -- and the only plain on Pesadelum's own table is the Plain of Thorns.
  startTerrain: "plainOfThorns",
  terrain: {
    1: "seaOfBlood",
    2: "forestOfImpaled",
    3: "plainOfThorns",
    4: "plainOfThorns",
    5: "mountain",
    6: "mountain",
  },
  location: {
    1: "goblinFortress",
    2: "goblinCity",
    3: "ruins",
    4: "abandonedHouse",
    5: "portal",
    6: "cityOfSurvivors",
  },
  event: {
    // The Dracolich's "D8" is the only dice-based monster damage in the rulebook; every
    // MonsterTemplate here carries a flat number, so it's averaged up to 4 (a documented
    // simplification, same tier as `bladeTrap`'s flavor-only roll-of-2).
    2: {
      text: "A Dracolich uncoils in front of you.",
      monsters: { name: "Dracolich", hp: 30, damage: 4, abilities: ["necromancy"], count: 1 },
    },
    3: {
      text: "A Tentacle erupts from the ground.",
      monsters: { name: "Tentacle", hp: 20, damage: 3, abilities: ["regeneration"], count: 1 },
    },
    4: {
      text: "Goblins boil out of the thorns.",
      monsters: {
        name: "Goblins",
        singularName: "Goblin",
        hp: 3,
        damage: 1,
        abilities: ["explosive"],
        count: { dice: 1, sides: 6 },
      },
    },
    5: {
      text: "A temporal distortion folds the ground under you.",
      effect: { kind: "moveToRandomAdjacent" },
    },
    6: {
      text: "A temporal distortion folds the ground under you.",
      effect: { kind: "moveToRandomAdjacent" },
    },
  },
  arrivalFlavor: "Everything here is almost familiar, and worse for it. This is Pesadelum.",
};

// --- Candy World ---------------------------------------------------------------------------------

const CANDY_WORLD: RealmDef = {
  key: "candyWorld",
  name: "Candy World",
  startTerrain: "caramelPlain",
  terrain: {
    1: "milkShakeSea",
    2: "milkShakeSea",
    3: "lollipopForest",
    4: "marshmallowMountain",
    5: "caramelPlain",
    6: "caramelPlain",
  },
  location: {
    1: "mandolateFortress",
    2: "chocolateCity",
    3: "chocolateCity",
    4: "peanuts",
    5: "peanuts",
    6: "portal",
  },
  event: {
    2: {
      text: "A Caking rolls toward you.",
      monsters: { name: "Caking", hp: 10, damage: 4, abilities: ["regeneration"], count: 1 },
    },
    3: {
      text: "A Candy Apple Soldier salutes, then charges.",
      monsters: { name: "Candy Apple Soldier", hp: 10, damage: 2, abilities: [], count: 1 },
    },
    4: {
      text: "A Marshminion bounces into your path.",
      monsters: { name: "Marshminion", hp: 4, damage: 2, abilities: [], count: 1 },
    },
    5: {
      text: "A Marshminion bounces into your path.",
      monsters: { name: "Marshminion", hp: 4, damage: 2, abilities: [], count: 1 },
    },
    6: {
      text: "Icing rain, and it gets everywhere.",
      effect: { kind: "loseProvisions", amount: 1 },
    },
  },
  arrivalFlavor: "It smells like a birthday. Something here still wants to kill you.",
};

export const REALMS: Record<OtherWorldKey, RealmDef> = {
  hell: HELL,
  underworld: UNDERWORLD,
  pesadelum: PESADELUM,
  candyWorld: CANDY_WORLD,
};

/** "If you defeat a monster, roll a treasure" (Candy World only). The rulebook prints rows 2-6 and
 * simply stops -- there is no 7-12 entry. Read as "nothing," matching every other 7+ row in these
 * worlds' own Event tables rather than inventing five rewards the book doesn't grant. */
export const CANDY_TREASURE_TABLE: Record<
  number,
  {
    text: string;
    coins?: number;
    healAll?: boolean;
    palaceTreasure?: boolean;
    armorHp?: number;
    armorName?: string;
  }
> = {
  2: { text: "100 chocolate coins (worth 1 coin).", coins: 1 },
  3: { text: "Strawberry Flavor Life Potion — recovers all HP.", healAll: true },
  4: { text: "An Easter Egg — roll a treasure from a Palace.", palaceTreasure: true },
  5: { text: "Marshmellow Boots (5 HP).", armorHp: 5, armorName: "Marshmellow Boots" },
  6: { text: "Gum Bullet Helmet (9 HP).", armorHp: 9, armorName: "Gum Bullet Helmet" },
};

/** Which realm Event totals mean "nothing happens" -- everything from 7 up, in every realm. */
export function realmEventRow(realm: RealmDef, total: number): RealmEventRow {
  return realm.event[total] ?? NOTHING_HAPPENS;
}

export function realmEventBand(total: number): EventBand | null {
  return total >= 7 ? null : ((total <= 2 ? 2 : total <= 4 ? 34 : 56) as EventBand);
}
