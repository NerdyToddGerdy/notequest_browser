export interface FixedSpellGrant {
  spellRoll: number;
  uses: number;
}

export interface RaceDef {
  roll: number;
  name: string;
  hp: number;
  ability: string;
  randomSpells?: number;
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
