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

/** "New Races" (Expanded World, `docs/game-rules-reference.md` lines 1302-1388, issue #22) -- four
 * 1d6 tables the player can choose instead of rolling on the Core Book's own 2d6 `RACE_TABLE`
 * above ("Instead of rolling a race on the base table, you can choose one of these tables").
 * Prohibited Races (a fifth, explicitly non-canonical "ideas from a Facebook group... use at your
 * own risk" joke table of 36 entries, 1d6-group/1d6-row) is deliberately left out of this pass --
 * see CLAUDE.md's New Races note for why.
 *
 * A few rows across these tables re-list a race that's already in `RACE_TABLE` verbatim
 * (Lightbugster/Pixie/Slimemen/Cat-Person in Uncommon, Rinoceroid in Exotic, Dragonkin in
 * Monstrous) -- those reuse the existing entry directly under this table's own 1d6 roll number,
 * rather than re-authoring identical data a second time.
 *
 * Several abilities here reference systems this codebase doesn't have yet (an Advanced Spells
 * table -- issue #24 -- for Pumpkinkin/Corvino; a real self-destruct-in-combat mechanic for
 * Goblin, ambiguous besides on whether it also hurts the Goblin; provisions existing inside a
 * dungeon run at all, for Fungoid's "at any time" heal; an armor/potion/scroll restriction system
 * for Ogre) -- those resolve as flavor-only text for now, the same "documented, deliberate
 * simplification" precedent as `bladeTrap`'s roll-of-2 or `WeaponEntry.twoHanded`, rather than
 * inventing rules the rulebook doesn't fully specify. See CLAUDE.md for exactly which abilities
 * here *are* mechanically real (water-walking, travel-cost multipliers, Ogre's +2 damage,
 * Half-Human's roll-time race merge) and which aren't yet. */
export const UNCOMMON_RACE_TABLE: Record<number, RaceDef> = {
  1: { ...RACE_TABLE[3]!, roll: 1 }, // Lightbugster
  2: { ...RACE_TABLE[4]!, roll: 2 }, // Pixie
  3: { ...RACE_TABLE[2]!, roll: 3 }, // Slimemen
  4: {
    roll: 4,
    name: "Pumpkinkin",
    hp: 16,
    ability: "You start with 3 uses of the Vimes spell.",
  },
  5: { ...RACE_TABLE[10]!, roll: 5 }, // Cat-Person
  6: {
    roll: 6,
    name: "Half-Human",
    hp: 20,
    ability: "Roll a new race and use the advantage of that.",
  },
};

export const EXOTIC_RACE_TABLE: Record<number, RaceDef> = {
  1: { ...RACE_TABLE[11]!, roll: 1 }, // Rinoceroid
  2: {
    roll: 2,
    name: "Samambro",
    hp: 10,
    ability: "When you die, roll a die. If it's 3 or more, you come back to life with 1 HP.",
  },
  3: {
    roll: 3,
    name: "Corvino",
    hp: 14,
    ability: "You start the game with 5 random Advanced Spells.",
  },
  4: {
    roll: 4,
    name: "Patovsky",
    hp: 15,
    ability: "You can walk in water territories and can skip travel events.",
  },
  5: {
    roll: 5,
    name: "Pandakhan",
    hp: 30,
    ability: "Spend twice as much provisions.",
  },
  6: {
    roll: 6,
    name: "Sharkin",
    hp: 18,
    ability: "You can walk in water territories.",
  },
};

export const MONSTROUS_RACE_TABLE: Record<number, RaceDef> = {
  1: {
    roll: 1,
    name: "Goblin",
    hp: 3,
    ability: "If you roll 1 on the damage die, you explode. Dealing 5 damage to everyone in the room.",
  },
  2: {
    roll: 2,
    name: "Orc",
    hp: 21,
    ability: "None.",
  },
  3: {
    roll: 3,
    name: "Centaur",
    hp: 19,
    ability: "Spend half of your provisions when moving around the map.",
  },
  4: {
    roll: 4,
    name: "Fungoid",
    hp: 10,
    ability: "At any time, spend 1 provision and heal 1d6 HP.",
  },
  5: {
    roll: 5,
    name: "Ogre",
    hp: 40,
    ability: "Cannot use potions, scrolls or wear armor. Deals +2 damage.",
  },
  6: { ...RACE_TABLE[12]!, roll: 6 }, // Dragonkin
};
