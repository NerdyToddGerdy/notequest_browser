import type { SpellDef } from "./types.ts";

/** Table: Spells (1d6) — "Basic Spells". Source: NoteQuest Core Book. */
export const SPELL_TABLE: Record<number, SpellDef> = {
  1: { table: "basic", roll: 1, name: "Heal", effect: "Heals 5 HP." },
  2: {
    table: "basic",
    roll: 2,
    name: "Light",
    effect: "Creates a globe of light worth a torch (does not use a hand).",
  },
  3: {
    table: "basic",
    roll: 3,
    name: "Teleport",
    effect: "You teleport to any empty room. Can be used to escape combat.",
  },
  4: {
    table: "basic",
    roll: 4,
    name: "Cold Ray",
    effect: "Deals 4 damage to one monster and it cannot attack next turn.",
  },
  5: { table: "basic", roll: 5, name: "Lightning", effect: "Deals 6 damage to one monster." },
  6: {
    table: "basic",
    roll: 6,
    name: "Fireball",
    effect: "Deals 5 damage to all monsters in the same room.",
  },
};

/** "New Spells" (Expanded World, `docs/game-rules-reference.md` lines 1518-1567, issue #24) --
 * three more 1d6 tables plus a 2d6 Advanced table, none of them player-chosen the way race tables
 * are: access is always *granted* by something else (a race ability, an Advanced Class, or a Magic
 * Item), never rolled freely at Character Creation. See CLAUDE.md's New Spells note for exactly
 * which effects are mechanically real vs. flavor-only for now -- several reference systems this
 * codebase doesn't have (an ally-in-combat concept for every Summon spell, deferred-to-victory
 * triggers for Absorb Soul/Fire of the Dead, the not-yet-built Events on Travel/Portals systems),
 * and resolve as flavor-only text rather than inventing rules, same "documented, deliberate
 * simplification" precedent as `bladeTrap`'s roll-of-2 or `WeaponEntry.twoHanded`. */
export const NATURE_SPELL_TABLE: Record<number, SpellDef> = {
  1: { table: "nature", roll: 1, name: "Natural Cure", effect: "Recovers 12 HP." },
  2: {
    table: "nature",
    roll: 2,
    name: "Vimes",
    effect: "Leaves a monster without attacking for 1d6 turns.",
  },
  3: {
    table: "nature",
    roll: 3,
    name: "Camouflage",
    effect: "Can ignore an Event generated in a forest or swamp territory.",
  },
  4: { table: "nature", roll: 4, name: "Create Food", effect: "Creates 2d6 Provisions." },
  5: {
    table: "nature",
    roll: 5,
    name: "Summon Wolf",
    effect: "Summons a Wolf (4 HP; Damage 2) to help you until the end of the fight.",
  },
  6: {
    table: "nature",
    roll: 6,
    name: "Insect Rain",
    effect: "Attack that deals 7 damage to all opponents.",
  },
};

export const DEATH_SPELL_TABLE: Record<number, SpellDef> = {
  1: {
    table: "death",
    roll: 1,
    name: "Ethereal Body",
    effect: "Until the end of the fight, all damage you take is reduced by 1 point.",
  },
  2: {
    table: "death",
    roll: 2,
    name: "Absorb Soul",
    effect: "After a fight, recover 5 HP for each monster killed.",
  },
  3: {
    table: "death",
    roll: 3,
    name: "Banish the Dead",
    effect: "Destroy any Undead that are in the same area as you.",
  },
  4: {
    table: "death",
    roll: 4,
    name: "Fire of the Dead",
    effect: "After a fight, you get 2 torches for every monster killed.",
  },
  5: {
    table: "death",
    roll: 5,
    name: "Summon Skeleton",
    effect: "Summons a Skeleton (4 HP; Damage 1; Undead) that stays until you exit the dungeon.",
  },
  6: {
    table: "death",
    roll: 6,
    name: "Awakening",
    effect: "Summons 1d6 Skeletons (4 HP; Damage 1; Undead) to aid you until the end of combat.",
  },
};

export const ELEMENTAL_SPELL_TABLE: Record<number, SpellDef> = {
  1: {
    table: "elemental",
    roll: 1,
    name: "Summon Elemental",
    effect: "Summons an Elemental (3 HP; Damage 2) to aid you until the end of the fight.",
  },
  2: {
    table: "elemental",
    roll: 2,
    name: "Stone Armor",
    effect: "Creates a piece of armor with 5 HP. It destroys itself after you leave the dungeon.",
  },
  3: {
    table: "elemental",
    roll: 3,
    name: "Cold Ray",
    effect: "Deals 4 damage to one monster and it cannot attack next turn.",
  },
  4: { table: "elemental", roll: 4, name: "Lightning", effect: "Deals 6 damage to one monster." },
  5: {
    table: "elemental",
    roll: 5,
    name: "Fireball",
    effect: "Deals 5 damage to all monsters in the same room.",
  },
  6: {
    table: "elemental",
    roll: 6,
    name: "Collapse",
    effect: "A dungeon room is completely destroyed with everything inside.",
  },
};

/** 2d6, unlike every other table here -- keyed by dice sum (2-12) same as `RACE_TABLE`/`CLASS_TABLE`. */
export const ADVANCED_SPELL_TABLE: Record<number, SpellDef> = {
  2: {
    table: "advanced",
    roll: 2,
    name: "Insect Rain",
    effect: "Attack that deals 7 damage to all opponents.",
  },
  3: {
    table: "advanced",
    roll: 3,
    name: "Open Portal",
    effect: "You can open a temporary Portal. You don't know where it's going.",
  },
  4: { table: "advanced", roll: 4, name: "Create Food", effect: "Creates 2d6 Provisions." },
  5: {
    table: "advanced",
    roll: 5,
    name: "Paralyze",
    effect: "Leave all monsters in a room without attacking for 2 turns.",
  },
  6: {
    table: "advanced",
    roll: 6,
    name: "Fly",
    effect: "Can move through any land without spending any Provision and activate Event.",
  },
  7: {
    table: "advanced",
    roll: 7,
    name: "Reload Mana",
    effect: "Recovers 1 use of another spell.",
  },
  8: {
    table: "advanced",
    roll: 8,
    name: "Magic Shield",
    effect: "Once created, it can absorb 4 damage points. Can cast more than one.",
  },
  9: {
    table: "advanced",
    roll: 9,
    name: "Stone Armor",
    effect: "Creates a piece of armor with 5 HP. It destroys itself after you leave the dungeon.",
  },
  10: { table: "advanced", roll: 10, name: "Magic Blast", effect: "Attack that deals 12 damage." },
  11: {
    table: "advanced",
    roll: 11,
    name: "Summon Elemental",
    effect: "Summons an Elemental (3 HP; Damage 2) to aid you until the end of the fight.",
  },
  12: {
    table: "advanced",
    roll: 12,
    name: "Ethereal Body",
    effect: "Until the end of the fight, all damage you take is reduced by 1 point.",
  },
};
