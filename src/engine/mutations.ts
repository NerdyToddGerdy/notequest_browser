import {
  MUTATION_IDS,
  MUTATION_TABLE,
  type MutationColumn,
  type MutationEntry,
} from "../data/mutations.ts";
import { rollDie } from "./dice.ts";
import type { RNG } from "./rng.ts";
import type { AdventurerResources } from "./town.ts";

/** Laboratory's Special Rule (issue #30): "any hero or creature that leaves this dungeon will
 * mutate." Its own module rather than part of `town.ts` because it fires on *leaving a dungeon* --
 * a moment `App.tsx` owns and neither the dungeon reducer nor Town does -- and because an outcome can
 * kill the character outright, which only App can act on. */

export interface MutationResult {
  resources: AdventurerResources;
  /** Fatal 1 and 2 -- the caller writes the Graveyard entry and clears the session. */
  died: boolean;
  /** Every entry rolled, in order. Longer than one only when the Common column redirected. */
  rolled: MutationEntry[];
  /** The dice, so the UI can animate what was actually rolled. */
  dice: number[];
  message: string;
}

/** Walks the table without applying anything: rolls once on the Common column and follows its two
 * redirects. Bounded at three entries by the table's own shape -- Common can send you to Rare or
 * Fatal, and neither of those redirects further.
 *
 * Split out from `rollMutation` because the Laboratory's Mutation Potion rolls on this same table
 * from inside `dungeonReducer.ts`, which has a `DungeonState` draft and no `AdventurerResources` at
 * all -- so the table walk is shared and each caller applies the terminal entry to its own shape. */
export function rollMutationEntry(rng: RNG = Math.random): {
  entry: MutationEntry;
  rolled: MutationEntry[];
  dice: number[];
} {
  const rolled: MutationEntry[] = [];
  const dice: number[] = [];
  let column: MutationColumn = "common";

  for (let step = 0; step < 3; step++) {
    const roll = rollDie(rng);
    dice.push(roll);
    const entry: MutationEntry = MUTATION_TABLE[column][roll]!;
    rolled.push(entry);
    if (entry.effect.kind !== "reroll") break;
    column = entry.effect.column;
  }

  return { entry: rolled[rolled.length - 1]!, rolled, dice };
}

/** Rolls a mutation and applies it to an `AdventurerResources` -- the leaving-the-dungeon path, which
 * `App.tsx` owns. */
export function rollMutation(
  resources: AdventurerResources,
  rng: RNG = Math.random,
): MutationResult {
  const { entry, rolled, dice } = rollMutationEntry(rng);
  return { ...applyMutation(entry, resources), rolled, dice };
}

function applyMutation(
  entry: MutationEntry,
  resources: AdventurerResources,
): { resources: AdventurerResources; died: boolean; message: string } {
  const effect = entry.effect;
  // Recorded for every non-fatal outcome, flavor included: `CharacterSheet` lists them, and the
  // mechanical ones are read back by id (see MUTATION_IDS).
  const remembered = { ...resources, mutations: [...resources.mutations, entry.id] };

  switch (effect.kind) {
    case "death":
      return { resources, died: true, message: entry.text };

    case "maxHp": {
      // A penalty can't reduce you below 1 -- the same floor every other maxHp cost uses (Hard Work).
      const maxHp = Math.max(1, resources.maxHp + effect.amount);
      return {
        resources: { ...remembered, maxHp, hp: Math.min(resources.hp, maxHp) },
        died: false,
        message: entry.text,
      };
    }

    case "noArmor":
      // Ogre's own restriction, arrived at by mutation. Armour already worn is *kept* rather than
      // stripped: the rule says you cannot wear armour, and confiscating what's equipped would be a
      // harsher reading than the text supports -- the same call `COLLECT_REMAINS` makes about leaving
      // a fallen character's armour behind instead of force-selling it (#83).
      return { resources: remembered, died: false, message: entry.text };

    case "reroll":
      // Unreachable: `rollMutation` follows redirects and only ever applies a terminal entry.
      return { resources: remembered, died: false, message: entry.text };

    case "flavor":
    case "zombie":
    case "poisonImmune":
    case "horns":
    case "noBoots":
      // All read back by id at their own use sites rather than changing anything now.
      return { resources: remembered, died: false, message: entry.text };
  }
}

export function hasMutation(resources: AdventurerResources, id: string): boolean {
  return resources.mutations.includes(id);
}

/** "You come back to life with half your maximum hit points. If you die again, you come back with
 * half of that, and so on." Returns the HP to revive on, or null if the character has no zombie
 * mutation or has been ground down past reviving.
 *
 * The halving compounds off `zombieRevivals`, not off current maxHp, so it can't be reset by
 * anything that restores HP -- and it bottoms out rather than looping at 1 forever: once half would
 * round to 0, the character is finally dead. */
export function zombieRevivalHp(resources: AdventurerResources): number | null {
  if (!hasMutation(resources, MUTATION_IDS.zombie)) return null;
  const hp = Math.floor(resources.maxHp / 2 ** (resources.zombieRevivals + 1));
  return hp >= 1 ? hp : null;
}

export function applyZombieRevival(
  resources: AdventurerResources,
  hp: number,
): AdventurerResources {
  return { ...resources, hp, zombieRevivals: resources.zombieRevivals + 1 };
}
