/** Laboratory's Special Rule (issue #30, rules 2325-2336): "Any hero or creature that leaves this
 * dungeon will mutate. Roll a die and compare with the 'Common Mutation' column."
 *
 * The first effect in the game that fires on *leaving* a dungeon rather than inside one. Three
 * columns, and the Common column is mostly a gateway: a 1 sends you to Fatal, a 6 to Rare, so four
 * of six Common results are harmless and the dangerous ones are reached indirectly.
 */
export type MutationColumn = "common" | "rare" | "fatal";

export type MutationEffect =
  /** Common 1 / Common 6 -- "[Roll a Fatal Mutation]" / "[Roll a Rare Mutation]". */
  | { kind: "reroll"; column: MutationColumn }
  /** Cosmetic. Recorded and displayed, but nothing mechanical -- a poodle's tail is a poodle's tail. */
  | { kind: "flavor" }
  | { kind: "maxHp"; amount: number }
  /** "You melt into a goo and die." / "You explode into thousands of pieces." */
  | { kind: "death" }
  /** "Your skin rots and you become a zombie. You come back to life with half your maximum hit
   * points. If you die again, you come back with half of that, and so on." */
  | { kind: "zombie" }
  /** "Blood turns green (Immune to Poison)" -- the same effect Pirate's own ability grants. */
  | { kind: "poisonImmune" }
  /** "Horns sprout from the head (1d6 Damage)" -- the same shape as Rinoceroid's horn attack. */
  | { kind: "horns" }
  /** "Bubbles sprout all over the body (cannot wear armor)" -- Ogre's restriction, from a mutation. */
  | { kind: "noArmor" }
  /** "One more toe sprouts (cannot wear boots)" -- a single-slot version of the same idea. */
  | { kind: "noBoots" };

export interface MutationEntry {
  /** Stable identity, so `AdventurerResources.mutations` survives a reload as a plain string list. */
  id: string;
  text: string;
  effect: MutationEffect;
}

export const MUTATION_TABLE: Record<MutationColumn, Record<number, MutationEntry>> = {
  common: {
    1: {
      id: "common-fatal",
      text: "Something has gone badly wrong.",
      effect: { kind: "reroll", column: "fatal" },
    },
    2: { id: "hairless", text: "All hairs on your body fall out.", effect: { kind: "flavor" } },
    3: { id: "beard", text: "A huge beard grows on your face.", effect: { kind: "flavor" } },
    4: { id: "recolored", text: "Your hair and fur change color.", effect: { kind: "flavor" } },
    5: { id: "sex-change", text: "You change sex.", effect: { kind: "flavor" } },
    6: {
      id: "common-rare",
      text: "Something stranger is happening.",
      effect: { kind: "reroll", column: "rare" },
    },
  },
  rare: {
    1: { id: "poodle-tail", text: "A poodle's tail appears.", effect: { kind: "flavor" } },
    2: { id: "navel-eye", text: "An eye sprouts in your navel.", effect: { kind: "flavor" } },
    3: {
      id: "stone-skin",
      text: "Your skin becomes thick as stone (+4 HP).",
      effect: { kind: "maxHp", amount: 4 },
    },
    4: {
      id: "horns",
      text: "Horns sprout from your head (1d6 Damage).",
      effect: { kind: "horns" },
    },
    5: {
      id: "green-blood",
      text: "Your blood turns green (Immune to Poison).",
      effect: { kind: "poisonImmune" },
    },
    // "Sprouts an extra arm on a shoulder" -- there is no hand economy to give an arm to (issue #100).
    6: {
      id: "extra-arm",
      text: "An extra arm sprouts from a shoulder.",
      effect: { kind: "flavor" },
    },
  },
  fatal: {
    1: { id: "goo", text: "You melt into a goo and die.", effect: { kind: "death" } },
    2: { id: "burst", text: "You explode into thousands of pieces.", effect: { kind: "death" } },
    3: {
      id: "zombie",
      text: "Your skin rots and you become a zombie.",
      effect: { kind: "zombie" },
    },
    4: {
      id: "weakened",
      text: "You get very weak (-6 HP).",
      effect: { kind: "maxHp", amount: -6 },
    },
    5: {
      id: "bubbles",
      text: "Bubbles sprout all over your body (cannot wear armor).",
      effect: { kind: "noArmor" },
    },
    6: {
      id: "extra-toe",
      text: "One more toe sprouts (cannot wear boots).",
      effect: { kind: "noBoots" },
    },
  },
};

/** Mutation ids whose effect is checked elsewhere in the engine, exported so those checks name a
 * constant rather than a bare string literal. */
export const MUTATION_IDS = {
  zombie: "zombie",
  poisonImmune: "green-blood",
  horns: "horns",
  noArmor: "bubbles",
  noBoots: "extra-toe",
} as const;

/** Every mutation keyed by its own id, so a recorded mutation can be described back to the player
 * (`CharacterSheet`) without knowing which column it came from. */
export const MUTATION_BY_ID: Record<string, MutationEntry> = Object.fromEntries(
  Object.values(MUTATION_TABLE).flatMap((column) =>
    Object.values(column).map((entry) => [entry.id, entry]),
  ),
);
