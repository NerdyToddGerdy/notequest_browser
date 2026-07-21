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

/** Animals (Expanded World, issue #26) -- domesticated companions trained in the wild, or (mounts
 * only) bought outright in a qualifying city. Keyed by `name` like `HirelingDef`/`AdvancedClassDef`
 * -- neither table's names collide with the other, so both are looked up through one shared
 * `ANIMAL_BY_NAME` map (`src/data/animals.ts`). No structured weapon/combat hookup: like Hirelings,
 * an owned animal never fights as a real combatant this pass (see CLAUDE.md's Animals note) --
 * `hp`/`damage` are still recorded for display/completeness even though nothing reads them yet. */
export interface AnimalDef {
  name: string;
  /** A couple of rows list two terrains ("Plain or Forest," "Forest or Tundra") -- training/buying
   * only requires the current hex to match *one* of these. */
  terrain: import("./hexTables.ts").Terrain[];
  /** The 1d6 threshold a training roll must meet or beat. Not used at all for buying a mount
   * outright (`mountCost` below) -- that always succeeds if affordable, no roll involved. */
  dif: number;
  hp: number;
  damage: number;
  /** Rulebook's own ability text, always shown even when flavor-only for now -- see
   * `src/engine/animals.ts` for which of these have a real mechanical effect today. */
  abilityText: string;
  isMount: boolean;
  /** Only set for the 8 Mounts -- the coin price to buy one outright in a qualifying city, instead
   * of (or in addition to) training it in the wild for provisions + a die roll. */
  mountCost?: number;
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

/** Advanced Classes (Expanded World, issue #23) -- purchasable with coins in a City/Fortress,
 * stacked on top of each other rather than rolled or chosen exclusively like Race/Class. Keyed by
 * `name` (a stable id) rather than a dice roll, since these are bought, not rolled. See
 * `src/engine/advancedClasses.ts` for which of these have a real, checkable requirement today. */
export interface AdvancedClassDef {
  name: string;
  cost: number;
  /** Rulebook's own requirement text, always shown regardless of whether this app can check it
   * yet -- see `src/engine/advancedClasses.ts`'s `isAdvancedClassTrackable()`. */
  requirementText: string;
  hpBonus: number;
  /** Rulebook's own ability text, always shown even when the ability itself is flavor-only for
   * now (same "documented, deliberate simplification" precedent as `bladeTrap`'s roll-of-2). */
  abilityText: string;
}

/** Hirelings (Expanded World, issue #25) -- paid companions hired for one dungeon trip at a time
 * (see `src/engine/hirelings.ts` for exactly how "one trip" is tracked). Keyed by `name`, like
 * `AdvancedClassDef` -- hired, not rolled. No structured weapon type: a Hireling never actually
 * fights as a combatant in this pass (see CLAUDE.md's Hirelings note for why), so equipment is
 * display-only text rather than a real `EquippedWeapon`. */
export interface HirelingDef {
  name: string;
  cost: number;
  hp: number;
  equipmentText: string;
  /** Rulebook's own "Extra Service" text, always shown even when flavor-only for now -- see
   * `src/engine/hirelings.ts` for which of these have a real mechanical effect today. */
  abilityText: string;
}
