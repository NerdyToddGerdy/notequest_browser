import { CITY_OR_FORTRESS } from "../data/hexTables.ts";
import { politicalAffinityTarget, type CityCulture } from "../data/affinity.ts";
import { rollDie } from "./dice.ts";
import type { RNG } from "./rng.ts";
import {
  hexDistance,
  parseHexKey,
  politicalStatusFor,
  withPoliticalStatus,
  type HexCoord,
  type HexTile,
  type WorldState,
} from "./hexState.ts";
import type { AdventurerResources } from "./town.ts";

/** Politics (Expanded World, issue #27) -- rolling on the Political Affinity table at any City/
 * Fortress hex, mirroring `arena.ts`'s "self-contained engine module" precedent. Not folded into
 * `hexReducer.ts`: unlike MOVE/HIRE_BOAT/ASK_FOR_DUNGEON (which only ever touch `WorldState`), this
 * needs to read/update `AdventurerResources` too (Lord/King's Vassal-eligibility check, the
 * `talkedToKing`/`vassalCount` milestones), the same reason Thug Life is resolved in
 * `WorldScreen.tsx` rather than through the hex reducer. */

export type PoliticalStatus = "ally" | "vassal" | "enemy";

/** A City/Fortress hex with no resolved status yet -- once set, a hex's Political Affinity outcome
 * is permanent ("a dungeon's beaten status never resets" is the closest existing precedent). */
export function canAttemptPoliticalAffinity(
  world: WorldState,
  coord: HexCoord,
  tile: HexTile | undefined,
): boolean {
  return (
    !!tile &&
    tile.location !== null &&
    CITY_OR_FORTRESS.has(tile.location) &&
    politicalStatusFor(world, coord) === null
  );
}

/** "If you are a Lord and that city is within 3 hexes of your building, passing this test you have
 * made him your Vassal." The rulebook only spells out the Lord-plus-City case explicitly; King's
 * equivalent range for Emperor's "3 vassals" requirement is filled in by direct analogy here
 * (any owned Castle/City/Fortress within range, held by either title) -- a documented scoping
 * call, same tier as Cleric's "faced an undead" approximation. A Fortress hex itself is never
 * eligible (the rulebook's vassal language is specifically about Cities under a King), so a
 * successful roll there can only ever become an ally. */
function isEligibleForVassal(
  resources: AdventurerResources,
  coord: HexCoord,
  isFortressHex: boolean,
): boolean {
  if (isFortressHex) return false;
  if (!resources.advancedClasses.includes("Lord") && !resources.advancedClasses.includes("King")) {
    return false;
  }
  return resources.buildings.some(
    (b) =>
      (b.kind === "Castle" || b.kind === "City" || b.kind === "Fortress") &&
      hexDistance(parseHexKey(b.hexKey), coord) <= 3,
  );
}

export interface PoliticalAffinityOutcome {
  resources: AdventurerResources;
  world: WorldState;
  status: PoliticalStatus;
  roll: number;
  target: number;
}

/** Rolls 2d6 against the target hex culture's Political Affinity number. Success -> ally (or
 * Vassal, see `isEligibleForVassal`); failure -> a permanent enemy (Warfare's own "Declared
 * Enemies" consequence, issue #28, is out of scope -- this just records the label). Sets
 * `talkedToKing` whenever `isFortressHex`, regardless of outcome (Noble's requirement is "talked
 * to" the King, not "befriended" him). */
export function resolvePoliticalAffinity(
  resources: AdventurerResources,
  world: WorldState,
  raceName: string,
  coord: HexCoord,
  culture: CityCulture,
  isFortressHex: boolean,
  rng: RNG = Math.random,
): PoliticalAffinityOutcome {
  const roll = rollDie(rng) + rollDie(rng);
  const target = politicalAffinityTarget(raceName, culture);
  const status: PoliticalStatus =
    roll >= target ? (isEligibleForVassal(resources, coord, isFortressHex) ? "vassal" : "ally") : "enemy";

  let milestones = resources.milestones;
  if (isFortressHex) milestones = { ...milestones, talkedToKing: true };
  if (status === "vassal") milestones = { ...milestones, vassalCount: milestones.vassalCount + 1 };

  return {
    resources: { ...resources, milestones },
    world: withPoliticalStatus(world, coord, status),
    status,
    roll,
    target,
  };
}
