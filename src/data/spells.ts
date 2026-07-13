import type { SpellDef } from "./types.ts";

/** Table: Spells (1d6) — "Basic Spells". Source: NoteQuest Core Book. */
export const SPELL_TABLE: Record<number, SpellDef> = {
  1: { roll: 1, name: "Heal", effect: "Heals 5 HP." },
  2: {
    roll: 2,
    name: "Light",
    effect: "Creates a globe of light worth a torch (does not use a hand).",
  },
  3: {
    roll: 3,
    name: "Teleport",
    effect: "You teleport to any empty room. Can be used to escape combat.",
  },
  4: {
    roll: 4,
    name: "Cold Ray",
    effect: "Deals 4 damage to one monster and it cannot attack next turn.",
  },
  5: { roll: 5, name: "Lightning", effect: "Deals 6 damage to one monster." },
  6: {
    roll: 6,
    name: "Fireball",
    effect: "Deals 5 damage to all monsters in the same room.",
  },
};
