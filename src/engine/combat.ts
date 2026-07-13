import type { MonsterCount, MonsterTemplate } from "../data/dungeonTables.ts";
import type { CombatMonsterState } from "./dungeonState.ts";
import { rollDie } from "./dice.ts";
import type { RNG } from "./rng.ts";

/** Fixed stat block from the Horde ability text: "an Orc (6 HP; Damage 3) enters the room." */
export const HORDE_ORC: Omit<CombatMonsterState, "id"> = {
  name: "Orc",
  hp: 6,
  maxHp: 6,
  damage: 3,
  abilities: [],
  bonusDamage: 0,
  deathtouchPending: false,
  paralyzePending: 0,
  skipNextAttack: false,
};

/** Fixed stat block from the Necromancy ability text: "a Skeleton (4 HP; Damage 1; Undead) appears." */
export const NECROMANCY_SKELETON: Omit<CombatMonsterState, "id"> = {
  name: "Skeleton",
  hp: 4,
  maxHp: 4,
  damage: 1,
  abilities: ["undead"],
  bonusDamage: 0,
  deathtouchPending: false,
  paralyzePending: 0,
  skipNextAttack: false,
};

function rollUpTo(sides: number, rng: RNG): number {
  return 1 + Math.floor(rng() * sides);
}

export function resolveMonsterCount(count: MonsterCount, rng: RNG = Math.random): number {
  if (typeof count === "number") return count;
  let total = 0;
  for (let i = 0; i < count.dice; i++) total += rollUpTo(count.sides, rng);
  return total;
}

/** Spawns one CombatMonsterState per instance the table's count resolves to. */
export function spawnMonsters(
  template: MonsterTemplate,
  makeId: () => number,
  rng: RNG = Math.random,
): CombatMonsterState[] {
  const n = resolveMonsterCount(template.count, rng);
  return Array.from({ length: n }, () => ({
    id: makeId(),
    name: template.name,
    hp: template.hp,
    maxHp: template.hp,
    damage: template.damage,
    abilities: template.abilities,
    bonusDamage: 0,
    deathtouchPending: false,
    paralyzePending: 0,
    skipNextAttack: false,
  }));
}

export function parseWeaponFormula(formula: string): { sides: number; modifier: number } {
  const match = /^(\d+)d(\d+)([+-]\d+)?$/.exec(formula.trim());
  if (!match) throw new Error(`Unrecognized weapon damage formula: ${formula}`);
  return { sides: Number(match[2]), modifier: match[3] ? Number(match[3]) : 0 };
}

/** Rolls a weapon's damage formula (e.g. "1d6+1"), clamped so damage never goes negative. */
export function rollWeaponDamage(formula: string, rng: RNG = Math.random): { rawRoll: number; total: number } {
  const { sides, modifier } = parseWeaponFormula(formula);
  const rawRoll = rollUpTo(sides, rng);
  return { rawRoll, total: Math.max(0, rawRoll + modifier) };
}

export type CombatEvent =
  | { kind: "explosive" }
  | { kind: "firebreath" }
  | { kind: "horde" }
  | { kind: "sorcery"; bonus: number }
  | { kind: "deathtouch" }
  | { kind: "necromancy" }
  | { kind: "regeneration"; amount: number }
  | { kind: "paralyze"; turns: number }
  | { kind: "weakness" }
  | { kind: "stoneskin" }
  | { kind: "intangible" };

export interface PlayerAttackResult {
  /** Damage actually applied to the monster's HP (0 if blocked, or moot if it exploded). */
  damageDealt: number;
  monsterDefeated: boolean;
  /** Explosive: damage dealt to the player when this monster detonates. */
  selfDestructDamageToPlayer: number;
  events: CombatEvent[];
}

/**
 * Stoneskin and Intangible describe "any damage taken," not just a weapon-roll outcome, so
 * both weapon attacks and spell damage run through this same filter.
 */
function applyDefensiveAbilities(
  monster: CombatMonsterState,
  damage: number,
): { damage: number; blocked: "stoneskin" | "intangible" | null } {
  if (monster.abilities.includes("stoneskin") && damage <= 3) {
    return { damage: 0, blocked: "stoneskin" };
  }
  if (monster.abilities.includes("intangible") && damage % 2 === 0) {
    return { damage: 0, blocked: "intangible" };
  }
  return { damage, blocked: null };
}

/**
 * Resolves one player attack against one monster. `rawRoll` is the unmodified
 * weapon die result (several abilities key off the raw roll, not final damage);
 * `weaponTotal` is the roll plus the weapon's modifier, already clamped to >= 0.
 */
export function resolvePlayerAttack(
  monster: CombatMonsterState,
  rawRoll: number,
  weaponTotal: number,
  rng: RNG = Math.random,
): PlayerAttackResult {
  if (rawRoll === 1 && monster.abilities.includes("explosive")) {
    return {
      damageDealt: monster.hp,
      monsterDefeated: true,
      selfDestructDamageToPlayer: monster.hp,
      events: [{ kind: "explosive" }],
    };
  }

  let damage = weaponTotal;
  const events: CombatEvent[] = [];

  if (rawRoll === 6 && monster.abilities.includes("weakness")) {
    damage *= 2;
    events.push({ kind: "weakness" });
  }
  const defended = applyDefensiveAbilities(monster, damage);
  damage = defended.damage;
  if (defended.blocked) events.push({ kind: defended.blocked });

  if (rawRoll === 1) {
    for (const ability of monster.abilities) {
      switch (ability) {
        case "firebreath":
          events.push({ kind: "firebreath" });
          break;
        case "horde":
          events.push({ kind: "horde" });
          break;
        case "sorcery":
          events.push({ kind: "sorcery", bonus: rollDie(rng) });
          break;
        case "deathtouch":
          events.push({ kind: "deathtouch" });
          break;
        case "necromancy":
          events.push({ kind: "necromancy" });
          break;
        case "regeneration":
          events.push({ kind: "regeneration", amount: 6 });
          break;
        case "paralyze":
          events.push({ kind: "paralyze", turns: rollDie(rng) });
          break;
        default:
          break;
      }
    }
  }

  const damageDealt = Math.min(damage, monster.hp);
  return { damageDealt, monsterDefeated: damageDealt >= monster.hp, selfDestructDamageToPlayer: 0, events };
}

export interface SpellDamageResult {
  damageDealt: number;
  monsterDefeated: boolean;
  blocked: "stoneskin" | "intangible" | null;
}

/**
 * Resolves a spell's fixed damage value (Cold Ray, Lightning, Fireball) against one monster.
 * Spell damage isn't a weapon "damage roll," so the roll-of-1/roll-of-6 abilities (Explosive,
 * Firebreath, Horde, Sorcery, Deathtouch, Necromancy, Regeneration, Paralyze, Weakness) never
 * trigger from it -- only the generic defensive abilities (Stoneskin, Intangible) apply.
 */
export function resolveSpellDamage(monster: CombatMonsterState, rawDamage: number): SpellDamageResult {
  const { damage, blocked } = applyDefensiveAbilities(monster, rawDamage);
  const damageDealt = Math.min(damage, monster.hp);
  return { damageDealt, monsterDefeated: damageDealt >= monster.hp, blocked };
}

/** Undead: after a monster with this ability is defeated, a roll of 1 revives it at 1 HP. */
export function checkUndeadRevival(monster: CombatMonsterState, rng: RNG = Math.random): boolean {
  if (!monster.abilities.includes("undead")) return false;
  return rollDie(rng) === 1;
}

export interface MonsterTurnResult {
  totalDamage: number;
  /** True if any monster's Deathtouch was armed -- the player dies outright regardless of HP. */
  deathtouchKill: boolean;
}

/** Sums every living monster's damage (including any queued Firebreath/Sorcery bonus) for one round. */
export function resolveMonsterTurn(monsters: CombatMonsterState[]): MonsterTurnResult {
  let totalDamage = 0;
  let deathtouchKill = false;
  for (const monster of monsters) {
    totalDamage += monster.damage + monster.bonusDamage;
    if (monster.deathtouchPending) deathtouchKill = true;
  }
  return { totalDamage, deathtouchKill };
}

export interface LootResult {
  coins: number;
  treasures: number;
  keys: number;
}

/** Loot: after the fight, roll once per Loot-tagged monster that was ultimately defeated. */
export function rollLoot(count: number, rng: RNG = Math.random): LootResult {
  const result: LootResult = { coins: 0, treasures: 0, keys: 0 };
  for (let i = 0; i < count; i++) {
    const roll = rollDie(rng);
    if (roll === 6) result.treasures += 1;
    else if (roll === 5) result.keys += 1;
    else result.coins += 1;
  }
  return result;
}
