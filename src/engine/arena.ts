import { ARENA_CHAMPION_TABLE } from "../data/arena.ts";
import { rollWeaponDamage } from "./combat.ts";
import type { CombatMonsterState, CombatState } from "./dungeonState.ts";
import { rollDie } from "./dice.ts";
import { eventFightRound, type FighterIdentity } from "./events.ts";
import { createCombatState } from "./fight.ts";
import type { RNG } from "./rng.ts";
import type { AdventurerResources } from "./town.ts";

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
/** The Arena runs the same shared core as every other fight (issue #120). Its *scoping* stays a
 * deliberate choice rather than an accident of implementation: the rulebook's Arena section says
 * nothing about armor absorption, and there is no Hireling concept in the pit -- but the character's
 * own attack bonuses, weapon effects, spells and survival abilities are theirs, and there was never
 * a reason those went missing. Unlike a wilderness Event, the Arena is opt-in, so it keeps its
 * "you fight alone" shape. */
export interface ArenaState {
  combat: CombatState;
  outcome: "ongoing" | "victory" | "defeat";
}

/** "You never know who your opponent will be" -- 3d6 against Table: Arena Champion. */
export function startArena(rng: RNG = Math.random): ArenaState {
  let roll = 0;
  for (let i = 0; i < 3; i++) roll += rollDie(rng);
  const template = ARENA_CHAMPION_TABLE[roll]!;
  return {
    combat: createCombatState({
      monsters: [
        {
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
          silencedTurns: 0,
        },
      ],
      // No Hireling: "you fight alone" is the Arena's own shape, kept deliberately.
      hireling: null,
    }),
    outcome: "ongoing",
  };
}

export interface ArenaRoundResult {
  resources: AdventurerResources;
  state: ArenaState;
  died: boolean;
  log: string[];
}

/** One round. Unlike an Event, the Arena rolls its own weapon die -- `TownScreen` renders the fight
 * un-animated, so there's no die on screen whose value has to match. */
export function resolveArenaRound(
  resources: AdventurerResources,
  who: FighterIdentity,
  state: ArenaState,
  weaponFormula: string,
  rng: RNG = Math.random,
): ArenaRoundResult {
  if (state.outcome !== "ongoing") {
    return { resources, state, died: false, log: [] };
  }
  const { rawRoll } = rollWeaponDamage(weaponFormula, rng);
  const fight = eventFightRound(resources, who, state.combat, 1, rawRoll, weaponFormula, rng);
  return {
    resources: fight.resources,
    state: { combat: fight.combat, outcome: fight.combat.outcome },
    died: fight.died,
    log: fight.log,
  };
}

/** The champion, for the UI -- `combat.monsters` is empty once it falls, so this is the last known
 * one either way. */
export function arenaChampion(state: ArenaState): CombatMonsterState | null {
  return state.combat.monsters[0] ?? null;
}
