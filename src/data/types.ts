/** "New Spells" (Expanded World, issue #24) added four tables beyond the Core Book's own Basic
 * Spells -- each rolls its own 1-6 (or 2-12 for Advanced) independently, so a bare `roll` number
 * alone no longer uniquely identifies a spell (Nature's roll 1 "Natural Cure" and Basic's roll 1
 * "Heal" would otherwise collide). Every spell-identity field in this codebase (`SpellDef`,
 * `FixedSpellGrant`, `CAST_SPELL`'s action payload, `DungeonState.spellUses`) carries a `table`
 * alongside its `roll` for exactly this reason -- see `character.ts`'s `spellKey()`. */
export type SpellTableKey = "basic" | "nature" | "death" | "elemental" | "advanced";

export interface FixedSpellGrant {
  table: SpellTableKey;
  spellRoll: number;
  uses: number;
}

export interface RaceDef {
  roll: number;
  name: string;
  hp: number;
  ability: string;
  randomSpells?: number;
  /** Which table `randomSpells` rolls against -- defaults to "basic" (the Core Book's own tables
   * never specify otherwise). Corvino (Exotic, issue #22) is the one race that grants random spells
   * from a different table ("5 random Advanced Spells"). */
  randomSpellsTable?: SpellTableKey;
  fixedSpell?: FixedSpellGrant;
}

export interface ClassDef {
  roll: number;
  name: string;
  hpBonus: number;
  ability: string;
  weapon: string;
  weaponDamage: string;
  randomSpells?: number;
}

export interface SpellDef {
  table: SpellTableKey;
  roll: number;
  name: string;
  effect: string;
}

/** The finished result of character creation, handed off to the dungeon screen. */
export interface CreatedCharacter {
  name: string;
  race: RaceDef;
  cls: ClassDef;
  totalHp: number;
  spells: SpellDef[];
  fixedGrants: FixedSpellGrant[];
  torches: number;
  coins: number;
}
