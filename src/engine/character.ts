import { EXOTIC_RACE_TABLE, MONSTROUS_RACE_TABLE, RACE_TABLE, UNCOMMON_RACE_TABLE } from "../data/races.ts";
import { CLASS_TABLE } from "../data/classes.ts";
import {
  ADVANCED_SPELL_TABLE,
  DEATH_SPELL_TABLE,
  ELEMENTAL_SPELL_TABLE,
  NATURE_SPELL_TABLE,
  SPELL_TABLE,
} from "../data/spells.ts";
import { FIRST_NAME_TABLE, LAST_NAME_TABLE } from "../data/names.ts";
import type { ClassDef, FixedSpellGrant, RaceDef, SpellDef, SpellTableKey } from "../data/types.ts";
import { rollDie, roll2d6 } from "./dice.ts";
import type { RNG } from "./rng.ts";

export interface DiceRollResult<T> {
  dice: number[];
  entry: T;
}

export function rollRace(rng: RNG = Math.random): DiceRollResult<RaceDef> {
  const [a, b] = roll2d6(rng);
  const entry = RACE_TABLE[a + b];
  if (!entry) throw new Error(`No race defined for roll ${a + b}`);
  return { dice: [a, b], entry };
}

/** "New Races" (issue #22) -- which table Character Creation is currently rolling on, chosen
 * instead of the Core Book's own 2d6 table ("Instead of rolling a race on the base table, you can
 * choose one of these tables"). Prohibited Races is deliberately not included -- see races.ts. */
export type RaceTableKey = "core" | "uncommon" | "exotic" | "monstrous";

const RACE_TABLE_BY_KEY: Record<Exclude<RaceTableKey, "core">, Record<number, RaceDef>> = {
  uncommon: UNCOMMON_RACE_TABLE,
  exotic: EXOTIC_RACE_TABLE,
  monstrous: MONSTROUS_RACE_TABLE,
};

/** Rolls against whichever table the player picked -- each of the three non-Core tables is its
 * own self-contained 1d6 lookup, distinct from `rollRace()`'s 2d6 sum. Half-Human ("Roll a new
 * race and use the advantage of that") resolves right here, at roll time: rerolls on the Core
 * table and merges that race's ability text/spell grants onto Half-Human's own name and HP, so the
 * rest of the app only ever sees one coherent `RaceDef` rather than needing to track "a Half-Human
 * pretending to be a Dwarf" separately everywhere a race matters. The bonus roll's dice are
 * appended to the returned `dice` array so the UI can still show every die that contributed. */
export function rollRaceFromTable(table: RaceTableKey, rng: RNG = Math.random): DiceRollResult<RaceDef> {
  if (table === "core") return rollRace(rng);
  const roll = rollDie(rng);
  const entry = RACE_TABLE_BY_KEY[table][roll];
  if (!entry) throw new Error(`No race defined for ${table} roll ${roll}`);
  if (entry.name === "Half-Human") {
    const inherited = rollRace(rng);
    return {
      dice: [roll, ...inherited.dice],
      entry: {
        ...entry,
        ability: `Roll a new race and use the advantage of that. (Rolled ${inherited.entry.name}: ${inherited.entry.ability})`,
        randomSpells: inherited.entry.randomSpells,
        fixedSpell: inherited.entry.fixedSpell,
      },
    };
  }
  return { dice: [roll], entry };
}

export function rollClass(rng: RNG = Math.random): DiceRollResult<ClassDef> {
  const [a, b] = roll2d6(rng);
  const entry = CLASS_TABLE[a + b];
  if (!entry) throw new Error(`No class defined for roll ${a + b}`);
  return { dice: [a, b], entry };
}

/** Every New Spells table, keyed for lookup by whichever table a `SpellDef`/`FixedSpellGrant`
 * says it's from -- exported so the UI can resolve a fixed grant's own spell text (`CharacterSheet`,
 * `CharacterCreationScreen`) without needing its own copy of this mapping. */
export const SPELL_TABLE_BY_KEY: Record<SpellTableKey, Record<number, SpellDef>> = {
  basic: SPELL_TABLE,
  nature: NATURE_SPELL_TABLE,
  death: DEATH_SPELL_TABLE,
  elemental: ELEMENTAL_SPELL_TABLE,
  advanced: ADVANCED_SPELL_TABLE,
};

/** Every spell-identity field in this codebase (`DungeonState.spellUses`, `FixedSpellGrant`) is
 * keyed by this composite string rather than a bare roll number, since "New Spells" (issue #24)
 * means the same 1-6 (or 2-12) can now mean a different spell depending which table it's from. */
export function spellKey(table: SpellTableKey, roll: number): string {
  return `${table}:${roll}`;
}

/** Inverse of `spellKey()` -- splits a `spellUses` key back into its table and roll, so the UI
 * (`CombatPanel`, `CharacterSheet`) can look up the actual `SpellDef` via `SPELL_TABLE_BY_KEY`
 * without parsing the string itself. */
export function parseSpellKey(key: string): { table: SpellTableKey; roll: number } {
  const [table, rollText] = key.split(":");
  return { table: table as SpellTableKey, roll: Number(rollText) };
}

export function rollSpell(rng: RNG = Math.random): DiceRollResult<SpellDef> {
  return rollSpellFromTable("basic", rng);
}

/** "New Spells" (issue #24) -- rolls against whichever table something granted access to. Never a
 * player choice the way Race tables are (see CLAUDE.md's New Spells note): access always comes
 * from a race ability, an Advanced Class, or a Magic Item. Advanced alone is 2d6 (summed, same
 * shape as `rollRace()`/`rollClass()`); every other table is a flat 1d6. */
export function rollSpellFromTable(table: SpellTableKey, rng: RNG = Math.random): DiceRollResult<SpellDef> {
  if (table === "advanced") {
    const [a, b] = roll2d6(rng);
    const entry = ADVANCED_SPELL_TABLE[a + b];
    if (!entry) throw new Error(`No spell defined for advanced roll ${a + b}`);
    return { dice: [a, b], entry };
  }
  const roll = rollDie(rng);
  const entry = SPELL_TABLE_BY_KEY[table][roll];
  if (!entry) throw new Error(`No spell defined for ${table} roll ${roll}`);
  return { dice: [roll], entry };
}

/** Not a rulebook mechanic (issue #40) -- one die each for a first and last name, per-race where a
 * table exists (`FIRST_NAME_TABLE`/`LAST_NAME_TABLE`, keyed by exact `RaceDef.name`), falling back
 * to the shared `"default"` bucket for a race without its own yet. */
export function rollName(raceName: string, rng: RNG = Math.random): DiceRollResult<string> {
  const firstRoll = rollDie(rng);
  const lastRoll = rollDie(rng);
  const firstTable = FIRST_NAME_TABLE[raceName] ?? FIRST_NAME_TABLE.default!;
  const lastTable = LAST_NAME_TABLE[raceName] ?? LAST_NAME_TABLE.default!;
  const first = firstTable[firstRoll];
  const last = lastTable[lastRoll];
  if (!first || !last) throw new Error(`No name defined for ${raceName} rolls ${firstRoll}/${lastRoll}`);
  return { dice: [firstRoll, lastRoll], entry: `${first} ${last}` };
}

export interface SpellRequirements {
  /** How many random spells are owed, keyed by which table they're rolled from. Almost always a
   * single entry in practice (only one race/class pair is ever active), but a class's own
   * random-Basic grant (Scholar/Noble) can coexist with a race's grant from a *different* table
   * (Corvino's "5 random Advanced Spells," issue #22) -- hence keyed by table rather than one flat
   * count. */
  randomSlotsByTable: Partial<Record<SpellTableKey, number>>;
  fixedGrants: FixedSpellGrant[];
}

/** Random spell rolls owed and any spells granted outright, given a race/class pair. Classes only
 * ever grant random Basic spells (`ClassDef` has no table field of its own); a race's own
 * `randomSpellsTable` defaults to "basic" too, so this degrades to the pre-#24 single-table
 * behavior whenever nothing grants from elsewhere. */
export function computeSpellRequirements(
  race: RaceDef | null,
  cls: ClassDef | null,
): SpellRequirements {
  const randomSlotsByTable: Partial<Record<SpellTableKey, number>> = {};
  if (race?.randomSpells) {
    const table = race.randomSpellsTable ?? "basic";
    randomSlotsByTable[table] = (randomSlotsByTable[table] ?? 0) + race.randomSpells;
  }
  if (cls?.randomSpells) {
    randomSlotsByTable.basic = (randomSlotsByTable.basic ?? 0) + cls.randomSpells;
  }
  const fixedGrants: FixedSpellGrant[] = [];
  if (race?.fixedSpell) fixedGrants.push(race.fixedSpell);
  return { randomSlotsByTable, fixedGrants };
}

export function computeTotalHp(race: RaceDef, cls: ClassDef): number {
  return race.hp + cls.hpBonus;
}

/** Total uses per spell (keyed by `spellKey()`'s `table:roll` composite, not a bare roll number --
 * see `SpellTableKey`'s own doc comment), combining fixed grants and randomly rolled spells. */
export function computeSpellUses(
  spells: SpellDef[],
  fixedGrants: FixedSpellGrant[],
): Record<string, number> {
  const uses: Record<string, number> = {};
  for (const grant of fixedGrants) {
    const key = spellKey(grant.table, grant.spellRoll);
    uses[key] = (uses[key] ?? 0) + grant.uses;
  }
  for (const spell of spells) {
    const key = spellKey(spell.table, spell.roll);
    uses[key] = (uses[key] ?? 0) + 1;
  }
  return uses;
}
