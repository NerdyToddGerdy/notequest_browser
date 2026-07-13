import type { RaceDef } from "./types.ts";

/** Table: Race (2d6). Source: NoteQuest Core Book, "Creating Your Adventurer". */
export const RACE_TABLE: Record<number, RaceDef> = {
  2: {
    roll: 2,
    name: "Slimemen",
    hp: 10,
    ability: "If you engulf the body of an enemy, you regain all HP.",
  },
  3: {
    roll: 3,
    name: "Lightbugster",
    hp: 16,
    ability: "You start with 3 uses of the Light spell.",
    fixedSpell: { spellRoll: 2, uses: 3 },
  },
  4: {
    roll: 4,
    name: "Pixie",
    hp: 8,
    ability: "You start the game with 5 random Basic Spells.",
    randomSpells: 5,
  },
  5: {
    roll: 5,
    name: "Gnome",
    hp: 14,
    ability: "You start the game with 3 random Basic Spells.",
    randomSpells: 3,
  },
  6: {
    roll: 6,
    name: "Elf",
    hp: 16,
    ability: "You start the game with 1 random Basic Spell.",
    randomSpells: 1,
  },
  7: {
    roll: 7,
    name: "Human",
    hp: 20,
    ability: "None.",
  },
  8: {
    roll: 8,
    name: "Dwarf",
    hp: 18,
    ability: "When you roll to Find Secret Passages, roll two dice and discard the lowest.",
  },
  9: {
    roll: 9,
    name: "Halfling",
    hp: 16,
    ability:
      "When you roll to Move Silently, roll two dice and discard the lowest (except in the Boss!).",
  },
  10: {
    roll: 10,
    name: "Cat-Person",
    hp: 19,
    ability: "You can sell equipment in the town for twice the price.",
  },
  11: {
    roll: 11,
    name: "Rinoceroid",
    hp: 24,
    ability: "You can attack with your horn (Damage 1d6).",
  },
  12: {
    roll: 12,
    name: "Dragonkin",
    hp: 30,
    ability: "You start with 3 uses of the Fireball spell.",
    fixedSpell: { spellRoll: 6, uses: 3 },
  },
};
