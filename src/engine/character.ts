import { EXOTIC_RACE_TABLE, MONSTROUS_RACE_TABLE, RACE_TABLE, UNCOMMON_RACE_TABLE } from "../data/races.ts";
import { CLASS_TABLE } from "../data/classes.ts";
import { SPELL_TABLE } from "../data/spells.ts";
import { FIRST_NAME_TABLE, LAST_NAME_TABLE } from "../data/names.ts";
import type { ClassDef, FixedSpellGrant, RaceDef, SpellDef } from "../data/types.ts";
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

export function rollSpell(rng: RNG = Math.random): DiceRollResult<SpellDef> {
  const a = rollDie(rng);
  const entry = SPELL_TABLE[a];
  if (!entry) throw new Error(`No spell defined for roll ${a}`);
  return { dice: [a], entry };
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
  randomSlots: number;
  fixedGrants: FixedSpellGrant[];
}

/** Total random Basic Spell rolls owed and any spells granted outright, given a race/class pair. */
export function computeSpellRequirements(
  race: RaceDef | null,
  cls: ClassDef | null,
): SpellRequirements {
  const randomSlots = (race?.randomSpells ?? 0) + (cls?.randomSpells ?? 0);
  const fixedGrants: FixedSpellGrant[] = [];
  if (race?.fixedSpell) fixedGrants.push(race.fixedSpell);
  return { randomSlots, fixedGrants };
}

export function computeTotalHp(race: RaceDef, cls: ClassDef): number {
  return race.hp + cls.hpBonus;
}

/** Total uses per spell (keyed by its 1d6 table roll), combining fixed grants and randomly rolled spells. */
export function computeSpellUses(spells: SpellDef[], fixedGrants: FixedSpellGrant[]): Record<number, number> {
  const uses: Record<number, number> = {};
  for (const grant of fixedGrants) {
    uses[grant.spellRoll] = (uses[grant.spellRoll] ?? 0) + grant.uses;
  }
  for (const spell of spells) {
    uses[spell.roll] = (uses[spell.roll] ?? 0) + 1;
  }
  return uses;
}
