import { ANIMAL_BY_NAME, MOUNT_TABLE } from "../data/animals.ts";
import type { AnimalDef } from "../data/types.ts";
import type { Terrain } from "../data/hexTables.ts";
import { rollDie } from "./dice.ts";
import type { RNG } from "./rng.ts";
import type { AdventurerResources } from "./town.ts";

/** Animals (Expanded World, issue #26) -- domesticated companions trained in the wild, or (mounts
 * only) bought outright in a qualifying city. Mirrors `hirelings.ts`'s precedent of a
 * self-contained engine module. Unlike Hirelings, a trained/bought animal persists permanently
 * once acquired (the same "acquire once, keep forever" shape `advancedClasses.ts` already
 * established), not per dungeon trip -- see CLAUDE.md's Animals note. */

/** "You cannot have more than 3 animals." */
export const MAX_ANIMALS = 3;

/** The one owned entry (if any) that's a Mount -- construction guarantees there's never more than
 * one, since `canTrainAnimal`/`canBuyMount` both reject a second. */
export function activeMount(animals: string[]): AnimalDef | null {
  for (const name of animals) {
    const def = MOUNT_TABLE[name];
    if (def) return def;
  }
  return null;
}

function hasRoomForAnotherAnimal(resources: AdventurerResources, animal: AnimalDef): boolean {
  if (resources.animals.length >= MAX_ANIMALS) return false;
  if (animal.isMount && activeMount(resources.animals)) return false;
  return true;
}

/** "Spend 4 provisions and roll a die. If the number is equal to or greater than the animal's
 * 'Dif,' you managed to train it." Mounts cost 8 provisions to train instead of 4 -- "training them
 * requires 8 provisions." */
export function canTrainAnimal(resources: AdventurerResources, animal: AnimalDef): boolean {
  const cost = animal.isMount ? 8 : 4;
  return resources.provisions >= cost && hasRoomForAnotherAnimal(resources, animal);
}

export interface TrainAnimalResult {
  resources: AdventurerResources;
  trained: boolean;
}

/** Spends the provisions regardless of outcome (the same "pay the cost, then roll" shape
 * Gamble/Thug Life already established) -- only a successful roll actually adds the animal. */
export function trainAnimal(
  resources: AdventurerResources,
  animal: AnimalDef,
  rng: RNG = Math.random,
): TrainAnimalResult {
  if (!canTrainAnimal(resources, animal)) return { resources, trained: false };
  const cost = animal.isMount ? 8 : 4;
  const spent = { ...resources, provisions: resources.provisions - cost };
  const trained = rollDie(rng) >= animal.dif;
  if (!trained) return { resources: spent, trained: false };
  return { resources: { ...spent, animals: [...spent.animals, animal.name] }, trained: true };
}

/** "Buy mounts in a city that is on the appropriate terrain" -- always succeeds if affordable, no
 * roll involved, unlike training. */
export function canBuyMount(resources: AdventurerResources, mount: AnimalDef): boolean {
  return resources.coins >= (mount.mountCost ?? Infinity) && hasRoomForAnotherAnimal(resources, mount);
}

export function buyMount(resources: AdventurerResources, mount: AnimalDef): AdventurerResources {
  if (!canBuyMount(resources, mount)) return resources;
  return {
    ...resources,
    coins: resources.coins - mount.mountCost!,
    animals: [...resources.animals, mount.name],
  };
}

/** The per-terrain provision cap (Owl/Goat/Horse/Camel/Llama/Giant Wolf/Raptor) or unconditional
 * override (Griffin) from every owned animal, cheapest wins -- `null` if none apply. Griffin's "1
 * provision for any land" is checked first and short-circuits, since it's unconditional and always
 * at least as good as any terrain-specific cap. */
export function animalTravelCostOverride(animals: string[], terrain: Terrain): number | null {
  if (animals.includes("Griffin")) return 1;
  let cheapest: number | null = null;
  for (const name of animals) {
    const def = ANIMAL_BY_NAME[name];
    if (!def) continue;
    const cap = perTerrainCap(name, terrain);
    if (cap != null && (cheapest == null || cap < cheapest)) cheapest = cap;
  }
  return cheapest;
}

function perTerrainCap(name: string, terrain: Terrain): number | null {
  switch (name) {
    case "Owl":
    case "Giant Wolf":
      return terrain === "forest" ? 1 : null;
    case "Goat":
    case "Llama":
      return terrain === "mountain" ? 2 : null;
    // Horse's real ability is "for 1 provision you can move across 2 Plains" -- approximated here
    // as a flat 1-provision Plains cost (same shape as every other mount's per-hex cap), rather
    // than tracking an every-other-hex-free counter this codebase has no precedent for.
    case "Horse":
      return terrain === "plain" ? 1 : null;
    case "Camel":
      return terrain === "desert" ? 1 : null;
    case "Raptor":
      return terrain === "swamp" ? 1 : null;
    default:
      return null;
  }
}

/** Mammoth: "You spend 1 extra provision per hex" -- an unconditional penalty, not a discount, so
 * it's kept separate from `animalTravelCostOverride()`'s "cheapest cap wins" shape. */
export function animalTravelCostPenalty(animals: string[]): number {
  return animals.includes("Mammoth") ? 1 : 0;
}

/** Dog: "In the dungeon, it doesn't allow you to Move in Silence." */
export function hasDog(animals: string[]): boolean {
  return animals.includes("Dog");
}
