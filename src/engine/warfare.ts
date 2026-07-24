import { CITY_OR_FORTRESS, isFortressLocation } from "../data/hexTables.ts";
import { politicalAffinityTarget, type CityCulture } from "../data/affinity.ts";
import { BUILDING_TABLE } from "../data/buildings.ts";
import { TROOP_COST, stormingLootPayout } from "../data/warfare.ts";
import type { BuildingKind } from "../data/types.ts";
import {
  hexDistance,
  hexKey,
  parseHexKey,
  politicalStatusFor,
  withPoliticalStatus,
  withRazedToRuins,
  withoutBuilding,
  type HexCoord,
  type HexTile,
  type WorldState,
} from "./hexState.ts";
import { rollDie } from "./dice.ts";
import type { RNG } from "./rng.ts";
import type { AdventurerResources } from "./town.ts";

/** Warfare (Expanded World, issue #28) -- mirrors `politics.ts`'s "self-contained engine module"
 * shape. Reuses `politics.ts`'s Political Affinity table (for Annex and the "who's an enemy"
 * signal) and #27's `BUILDING_TABLE` Defense values directly -- the rulebook's own Warfare Defense
 * numbers (City 6, Fortress 12) already match `BUILDING_TABLE.City.defense`/`.Fortress.defense`
 * exactly. */

function isTroopSourceTier(kind: BuildingKind): boolean {
  return kind === "Castle" || kind === "City" || kind === "Fortress";
}

/** "You can only recruit troops in a Castle, City, or Fortress... You can recruit troops from
 * vassal or conquered Cities and Fortresses" -- either the player's own built Castle/City/Fortress
 * (House/Tower can't muster troops) or a hex they've made a Vassal, capped at one *currently
 * unspent* troop per source (an attack always spends every recruited troop at once, freeing every
 * source to recruit again afterward -- see `resolveAttack()`). */
export function canRecruitTroop(
  resources: AdventurerResources,
  world: WorldState,
  coord: HexCoord,
  tile: HexTile | undefined,
): boolean {
  if (!tile) return false;
  const ownQualifyingBuilding = !!tile.building && isTroopSourceTier(tile.building);
  const isVassal = politicalStatusFor(world, coord) === "vassal";
  if (!ownQualifyingBuilding && !isVassal) return false;
  if (resources.troopSources.includes(hexKey(coord))) return false;
  return resources.coins >= TROOP_COST;
}

/** Spends the coins, adds one troop, and marks this hex's source as spent for now. No-ops (same
 * "invalid call is a no-op" contract as `buildBuilding()`) if `canRecruitTroop()` would reject it. */
export function recruitTroop(
  resources: AdventurerResources,
  world: WorldState,
  coord: HexCoord,
  tile: HexTile | undefined,
): AdventurerResources {
  if (!canRecruitTroop(resources, world, coord, tile)) return resources;
  return {
    ...resources,
    coins: resources.coins - TROOP_COST,
    troops: resources.troops + 1,
    troopSources: [...resources.troopSources, hexKey(coord)],
  };
}

/** Any City/Fortress hex is a valid war target except the player's own Vassal ("declare war on
 * others" broadly, not restricted to only already-hostile hexes -- but attacking your own Vassal
 * has nothing to gain). */
export function canAttack(world: WorldState, coord: HexCoord, tile: HexTile | undefined): boolean {
  if (!tile || tile.location === null || !CITY_OR_FORTRESS.has(tile.location)) return false;
  return politicalStatusFor(world, coord) !== "vassal";
}

export interface AttackOutcome {
  resources: AdventurerResources;
  world: WorldState;
  status: "won" | "lost" | "lost-death";
  /** Declared Enemies (issue #28): every one of the player's own buildings destroyed by an
   * enemy's retaliation this same attack -- resolved regardless of `status`, since the rulebook's
   * own trigger is "whenever you attack a building," not "whenever you win." Usually empty. */
  retaliation: { hexKey: string; kind: BuildingKind }[];
}

/** "Move your character to the City or Fortress you want to attack, taking with you all the
 * troops you recruit" -- always spends every recruited troop at once (no partial-commitment UI).
 * Rolls `troops` dice (+1 more if `joinBattle`), sums, and compares to the target's Defense;
 * `joinBattle` risks the character's life on a natural 1 *only if the battle is lost*. Also
 * resolves Declared Enemies retaliation against the player's own buildings, synchronously, exactly
 * as the rulebook's own "whenever you attack a building, roll a die for each enemy..." phrasing
 * implies (not a separate periodic/world-tick system). */
export function resolveAttack(
  resources: AdventurerResources,
  world: WorldState,
  coord: HexCoord,
  isFortressTarget: boolean,
  joinBattle: boolean,
  rng: RNG = Math.random,
): AttackOutcome {
  let sum = 0;
  for (let i = 0; i < resources.troops; i++) sum += rollDie(rng);
  let characterRoll: number | null = null;
  if (joinBattle) {
    characterRoll = rollDie(rng);
    sum += characterRoll;
  }
  const defense = isFortressTarget ? BUILDING_TABLE.Fortress.defense : BUILDING_TABLE.City.defense;
  const won = sum >= defense;
  const characterDied = joinBattle && characterRoll === 1 && !won;

  // Troops are always fully spent by the attempt, win or lose -- every source frees up again.
  let nextResources: AdventurerResources = { ...resources, troops: 0, troopSources: [] };
  let nextWorld = world;
  const retaliation: AttackOutcome["retaliation"] = [];

  if (nextResources.buildings.length > 0) {
    const targetKey = hexKey(coord);
    const enemyHexKeys = Object.entries(world.politicalStatus ?? {})
      .filter(([key, status]) => status === "enemy" && key !== targetKey)
      .map(([key]) => key);
    for (const enemyKey of enemyHexKeys) {
      const enemyCoord = parseHexKey(enemyKey);
      const enemyCheck = rollDie(rng);
      if (enemyCheck >= 4) continue; // "4 or more, nothing happens"
      const troopsSent = enemyCheck; // "between 1 and 3" -- that many troops
      // "attack your building that is closest to him (in case of doubt he will attack the
      // building with less defense)."
      const chosen = [...nextResources.buildings].sort((a, b) => {
        const distA = hexDistance(parseHexKey(a.hexKey), enemyCoord);
        const distB = hexDistance(parseHexKey(b.hexKey), enemyCoord);
        if (distA !== distB) return distA - distB;
        return BUILDING_TABLE[a.kind].defense - BUILDING_TABLE[b.kind].defense;
      })[0]!;
      let enemySum = 0;
      for (let i = 0; i < troopsSent; i++) enemySum += rollDie(rng);
      if (enemySum >= BUILDING_TABLE[chosen.kind].defense) {
        nextResources = {
          ...nextResources,
          buildings: nextResources.buildings.filter((b) => b.hexKey !== chosen.hexKey),
        };
        nextWorld = withoutBuilding(nextWorld, parseHexKey(chosen.hexKey));
        retaliation.push({ hexKey: chosen.hexKey, kind: chosen.kind });
      }
    }
  }

  return {
    resources: nextResources,
    world: nextWorld,
    status: characterDied ? "lost-death" : won ? "won" : "lost",
    retaliation,
  };
}

export interface StormingOutcome {
  resources: AdventurerResources;
  world: WorldState;
  annexed: boolean;
}

/** "Storming the Castle": Annex re-rolls Political Affinity at +2, granting Vassal status
 * unconditionally on success ("gain all the advantages of having a vassal") -- unlike the peaceful
 * path (`politics.ts`'s `resolvePoliticalAffinity()`), this deliberately skips the Lord/King-
 * within-3-hexes eligibility check, since a military conquest doesn't need it. A failed Annex
 * falls straight through to Loot, per "you'll only have the option of looting the place" -- no
 * dead end, no extra click. Loot always razes to Ruins and pays out a flat amount. */
export function resolveStorming(
  resources: AdventurerResources,
  world: WorldState,
  raceName: string,
  coord: HexCoord,
  culture: CityCulture,
  choice: "annex" | "loot",
  rng: RNG = Math.random,
): StormingOutcome {
  if (choice === "annex") {
    const roll = rollDie(rng) + rollDie(rng) + 2;
    if (roll >= politicalAffinityTarget(raceName, culture)) {
      return {
        resources: {
          ...resources,
          milestones: {
            ...resources.milestones,
            vassalCount: resources.milestones.vassalCount + 1,
          },
        },
        world: withPoliticalStatus(world, coord, "vassal"),
        annexed: true,
      };
    }
  }
  const tile = world.tiles[hexKey(coord)];
  const isFortressTarget = !!tile?.location && isFortressLocation(tile.location);
  return {
    resources: { ...resources, coins: resources.coins + stormingLootPayout(isFortressTarget) },
    world: withRazedToRuins(world, coord),
    annexed: false,
  };
}
