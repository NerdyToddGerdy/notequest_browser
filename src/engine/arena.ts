import { ARENA_CHAMPION_TABLE } from "../data/arena.ts";
import {
  resolveMonsterTurn,
  resolvePlayerAttack,
  rollWeaponDamage,
  type CombatEvent,
} from "./combat.ts";
import type { CombatMonsterState } from "./dungeonState.ts";
import { rollDie } from "./dice.ts";
import type { RNG } from "./rng.ts";

/** "Fighting in The Arena" (`docs/game-rules-reference.md` lines 1036-1037, 1054-1071) -- reuses
 * `combat.ts`'s pure, dungeon-agnostic combat math (`resolvePlayerAttack`/`resolveMonsterTurn`
 * already operate on a bare `CombatMonsterState`, nothing DungeonState-specific) rather than
 * routing through `dungeonReducer.ts`'s `CombatState`, which is shaped around a dungeon segment
 * (`segId`), loot rolls, and armor-absorption choices Arena doesn't have. Deliberately simpler than
 * a dungeon fight: no armor-absorption choice (all damage hits `hp` directly -- the rulebook's
 * Arena section says nothing about it, unlike the Core Book's own explicit "your call"), no
 * spellcasting or race/class abilities (Town/World has no combat-spell infrastructure outside a
 * dungeon run to begin with), and no weapon `bonusEffect` from an equipped Magic Item (just the
 * base formula) -- same "documented, deliberate simplification" precedent as `bladeTrap`'s
 * flavor-only roll-of-2. Every Arena Champion's ability set (Deathtouch/Stoneskin/Poison/Weakness/
 * Explosive) is still handled correctly, since those are exactly what `resolvePlayerAttack` already
 * covers; Firebreath/Sorcery/Horde/Necromancy/Regeneration/Paralyze/Undead don't need wiring here
 * at all -- no Champion on the table has any of them.
 */
export interface ArenaState {
  champion: CombatMonsterState;
  outcome: "ongoing" | "victory" | "defeat";
}

/** "You never know who your opponent will be" -- 3d6 against Table: Arena Champion. */
export function startArena(rng: RNG = Math.random): ArenaState {
  let roll = 0;
  for (let i = 0; i < 3; i++) roll += rollDie(rng);
  const template = ARENA_CHAMPION_TABLE[roll]!;
  return {
    champion: {
      id: 1,
      name: template.name,
      hp: template.hp,
      maxHp: template.hp,
      damage: template.damage,
      abilities: template.abilities,
      bonusDamage: 0,
      deathtouchPending: false,
      paralyzePending: 0,
      skipNextAttack: false,
    },
    outcome: "ongoing",
  };
}

export interface ArenaRoundResult {
  state: ArenaState;
  /** The player's new HP after this round (attack + counter-attack, if any). */
  hp: number;
  /** True the moment `hp` reaches 0 -- "if you lose, your character dies." */
  died: boolean;
  events: CombatEvent[];
}

/** One full round: the player attacks with their equipped weapon, then -- if the champion is still
 * standing -- it counters immediately (Arena has no "noisy start"/monster-acts-first concept, so
 * the player always swings first, same as an ordinary un-ambushed dungeon room). A no-op once
 * `state.outcome` is no longer `"ongoing"`. */
export function resolveArenaRound(
  state: ArenaState,
  hp: number,
  weaponFormula: string,
  rng: RNG = Math.random,
): ArenaRoundResult {
  if (state.outcome !== "ongoing") return { state, hp, died: false, events: [] };

  const { rawRoll, total } = rollWeaponDamage(weaponFormula, rng);
  const atk = resolvePlayerAttack(state.champion, rawRoll, total, rng);
  let champion: CombatMonsterState = {
    ...state.champion,
    hp: Math.max(0, state.champion.hp - atk.damageDealt),
  };
  let newHp = hp - atk.selfDestructDamageToPlayer;

  // Explosive can defeat the champion and kill the player in the very same blast -- death is
  // checked first regardless (mirroring dungeonReducer.ts's PLAYER_ATTACK case: "the explosion
  // kills you instantly" fires even when the monster is also defeated by the same hit).
  if (newHp <= 0) {
    return { state: { champion, outcome: "defeat" }, hp: 0, died: true, events: atk.events };
  }
  if (atk.monsterDefeated) {
    return { state: { champion, outcome: "victory" }, hp: newHp, died: false, events: atk.events };
  }

  // The only ability event that carries into the champion's own counter-attack this round --
  // see the module doc comment for why Firebreath/Sorcery/Paralyze aren't handled here too.
  if (atk.events.some((e) => e.kind === "deathtouch")) {
    champion = { ...champion, deathtouchPending: true };
  }

  const counter = resolveMonsterTurn([champion]);
  champion = { ...champion, deathtouchPending: false }; // consumed, whether it killed or not
  if (counter.deathtouchKill) {
    return { state: { champion, outcome: "defeat" }, hp: 0, died: true, events: atk.events };
  }
  newHp = Math.max(0, newHp - counter.totalDamage);
  const outcome = newHp <= 0 ? "defeat" : "ongoing";
  return { state: { champion, outcome }, hp: newHp, died: newHp <= 0, events: atk.events };
}
