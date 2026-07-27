import { EVENT_TABLE, eventBandFor, type EventBand, type EventEffect, type EventRow } from "../data/events.ts";
import type { Terrain } from "../data/hexTables.ts";
import { HIRELING_BY_NAME } from "../data/hirelings.ts";
import { SPELL_TABLE_BY_KEY, spellKey } from "./character.ts";
import {
  parseWeaponFormula,
  resolveMonsterTurn,
  resolvePlayerAttack,
  rollLoot,
  spawnMonsters,
  type CombatEvent,
} from "./combat.ts";
import { rollDie } from "./dice.ts";
import type { CombatMonsterState } from "./dungeonState.ts";
import type { RNG } from "./rng.ts";
import type { AdventurerResources } from "./town.ts";

/** "Events on Travel" (`docs/game-rules-reference.md` lines 908-926, issue #91) -- the last unbuilt
 * piece of Hexploring the World (#19). Deliberately its own engine module rather than part of
 * `hexReducer.ts`: an Event can touch `AdventurerResources` (provisions/HP/coins), `WorldState`
 * (Storm's relocation), *and* kill the character, so no single existing reducer owns it -- the same
 * reason Thug Life and Warfare resolve in `WorldScreen.tsx` off pure engine functions instead.
 *
 * Monster Events reuse `combat.ts`'s pure functions directly rather than `dungeonReducer.ts`'s
 * `CombatState`, exactly as `arena.ts` does and for the same reasons (no segment, no loot-per-
 * segment bookkeeping, no armor-absorption choice). The differences from Arena, both forced by the
 * table itself: an Event can field *several* monsters (4 Pirates, 2 Orcs, 1d6 Goblins), so this
 * needs a target choice and filters `resolveMonsterTurn()` to the living; and several rows are
 * Loot-tagged, so victory pays out through the same `rollLoot()` a dungeon fight uses.
 *
 * Same documented simplifications as Arena: no armor absorption (all damage hits `hp`), no
 * spellcasting mid-fight, no race/class attack bonuses, and no equipped-weapon `bonusEffect` --
 * just the base weapon formula. Ability coverage is complete for what the table actually contains
 * (Firebreath/Regeneration/Explosive/Loot); Horde/Necromancy/Sorcery/Deathtouch/Paralyze/Poison/
 * Stoneskin/Intangible/Weakness/Undead appear on no Event row, so they're not wired here, the same
 * call `arena.ts` documents for its own Champion table.
 */

/** The result of the 2d6 check made on entering a location-less hex. `dice` carries the two raw
 * values (not just their total) so the UI can animate the actual dice rolled, the same way every
 * other multi-die roll in this app does -- deriving a plausible pair from the total instead would
 * show the player dice they didn't roll. */
export type TravelEventRoll =
  /** An ability suppressed the roll outright -- no dice, no Event. */
  | { kind: "skipped"; reason: string }
  /** "If it's 7 or more, nothing happened." */
  | { kind: "none"; total: number; dice: [number, number] }
  | { kind: "event"; total: number; dice: [number, number]; terrain: Terrain; band: EventBand; row: EventRow };

/** Patovsky (race, `races.ts`) and Elf Ranger (hireling) both simply never have Events. Checked
 * before any dice are rolled, so an Event is never even generated for them.
 *
 * Fly's own "...and activate Event" clause is *not* handled here -- `WorldScreen.tsx` skips calling
 * this function entirely on a Fly move, since Fly's skip is a property of that one move rather than
 * of the character (see `rollTravelEvent`'s call site and CLAUDE.md's Fly note for the reading). */
export function eventSkipReason(resources: AdventurerResources, raceName: string): string | null {
  if (raceName === "Patovsky") return "You slip through unnoticed, as your kind always do.";
  if (resources.hireling === "Elf Ranger") {
    return "Your Elf Ranger reads the land ahead and guides you clear of trouble.";
  }
  return null;
}

/** "Whenever you enter a hex that doesn't have a location, roll 2d6." The caller is responsible for
 * only invoking this on a location-less hex -- `HexTile.location === null` -- since this module has
 * no `WorldState` to check it against. Nothing is spent or applied here; resolution is deferred so
 * Camouflage/Star Stone can still intervene (see `ignoreEvent`/`rerollEvent`). */
export function rollTravelEvent(
  resources: AdventurerResources,
  raceName: string,
  terrain: Terrain,
  rng: RNG = Math.random,
): TravelEventRoll {
  const skip = eventSkipReason(resources, raceName);
  if (skip) return { kind: "skipped", reason: skip };

  const dice: [number, number] = [rollDie(rng), rollDie(rng)];
  const total = dice[0] + dice[1];
  const band = eventBandFor(total);
  if (band === null) return { kind: "none", total, dice };
  return { kind: "event", total, dice, terrain, band, row: EVENT_TABLE[terrain][band] };
}

const CAMOUFLAGE_KEY = spellKey("nature", 3);

/** Camouflage (Nature 3): "Can ignore an Event generated in a forest or swamp territory." One of
 * #61's deferred spells, deliberately kept off the shared `CAST_SPELL`/`KNOWN_CASTABLE_SPELL_NAMES`
 * pipeline for the same reason Fly is: that pipeline's "Cast" button also renders inside a dungeon,
 * where an Event can't exist. Instead it's offered only on the pending-Event panel itself, which is
 * also the only moment the choice is meaningful -- unlike every other spell, this one is cast
 * *in response to* a specific rolled outcome, not proactively. */
export function canIgnoreEvent(resources: AdventurerResources, terrain: Terrain): boolean {
  if (terrain !== "forest" && terrain !== "swamp") return false;
  return (resources.spellUses[CAMOUFLAGE_KEY] ?? 0) > 0;
}

export function ignoreEvent(resources: AdventurerResources, terrain: Terrain): AdventurerResources {
  if (!canIgnoreEvent(resources, terrain)) return resources;
  return {
    ...resources,
    spellUses: { ...resources.spellUses, [CAMOUFLAGE_KEY]: resources.spellUses[CAMOUFLAGE_KEY]! - 1 },
  };
}

/** Star Stone (Ziggurat Wonder, issue #30): "Spend 1 Provision to Reroll an Event." Held as a
 * `wonderItem` armor entry, so found by name the same way `hasElvenBoots()`/`hasFeatheredBoots()`
 * are. Unlike a `trapImmunity` item this is *not* one-shot -- the rulebook gives it no use limit,
 * and the provision is the cost that bounds it. */
export function hasStarStone(resources: AdventurerResources): boolean {
  return resources.armor.some((p) => p.itemName?.toLowerCase().includes("star stone"));
}

export function canRerollEvent(resources: AdventurerResources): boolean {
  return hasStarStone(resources) && resources.provisions >= 1;
}

export interface EventRerollResult {
  resources: AdventurerResources;
  roll: TravelEventRoll;
}

/** Spends the provision first, then rerolls -- "pay then roll," the same shape Gamble/Thug Life/
 * `trainAnimal()` already use, so a reroll into another Event still costs the provision. The
 * reroll deliberately goes back through `rollTravelEvent`, so a 7+ result ("nothing happened") is a
 * legitimate and desirable outcome of using the Star Stone. */
export function rerollEvent(
  resources: AdventurerResources,
  raceName: string,
  terrain: Terrain,
  rng: RNG = Math.random,
): EventRerollResult {
  if (!canRerollEvent(resources)) return { resources, roll: { kind: "none", total: 7, dice: [3, 4] } };
  const spent = { ...resources, provisions: resources.provisions - 1 };
  return { resources: spent, roll: rollTravelEvent(spent, raceName, terrain, rng) };
}

export interface EventEffectResult {
  resources: AdventurerResources;
  /** Glacier's Cracked Ice -- the caller writes the Graveyard entry and clears the session. */
  died: boolean;
  /** Storm -- the caller relocates the player, since only it holds `WorldState`. */
  relocate: boolean;
  message: string;
}

/** Applies a non-combat Event outcome. HP loss is floored at 1, matching every other non-dungeon HP
 * cost in this codebase (Hard Work's `maxHp` drain, the Forgotten Gods' lightning): only an
 * explicitly fatal outcome -- here just Cracked Ice -- ever actually kills. Provision loss likewise
 * floors at 0 rather than converting a shortfall into HP damage the way `payTravelCost()` does;
 * the rulebook describes these as losing provisions you have, not a debt. */
export function applyEventEffect(resources: AdventurerResources, effect: EventEffect): EventEffectResult {
  switch (effect.kind) {
    case "loseProvisions": {
      const lost = Math.min(effect.amount, resources.provisions);
      return {
        resources: { ...resources, provisions: resources.provisions - lost },
        died: false,
        relocate: false,
        message: lost > 0 ? `You lose ${lost} provision${lost === 1 ? "" : "s"}.` : "You had no provisions left to lose.",
      };
    }
    case "loseHp": {
      const lost = Math.min(effect.amount, Math.max(0, resources.hp - 1));
      return {
        resources: { ...resources, hp: resources.hp - lost },
        died: false,
        relocate: false,
        message: lost > 0 ? `You lose ${lost} HP.` : "Battered, but you keep your feet.",
      };
    }
    case "moveToRandomHex":
      return { resources, died: false, relocate: true, message: "You come to on unfamiliar ground." };
    case "instantDeath":
      // Never actually surfaced -- the caller hands straight off to the death handler.
      return { resources, died: true, relocate: false, message: "" };
  }
}

// --- Monster Events ------------------------------------------------------------------------------

export interface EventCombatState {
  monsters: CombatMonsterState[];
  outcome: "ongoing" | "victory" | "defeat";
  /** Set once on victory, so the caller can report exactly what the Loot rolls produced. */
  loot: { coins: number; treasures: number; keys: number } | null;
}

export function startEventCombat(row: EventRow, rng: RNG = Math.random): EventCombatState | null {
  if (!row.monsters) return null;
  let nextId = 1;
  return { monsters: spawnMonsters(row.monsters, () => nextId++, rng), outcome: "ongoing", loot: null };
}

export interface EventRoundResult {
  state: EventCombatState;
  hp: number;
  died: boolean;
  events: CombatEvent[];
}

/** One full round: the player attacks their chosen target, then every *surviving* monster counters.
 * The player always swings first -- an Event has no "noisy arrival" concept the way a dungeon room
 * does, same as Arena. A no-op once the fight is over or the target is already down.
 *
 * `rawRoll` is the weapon die the *caller* rolled, not one rolled here -- the same split
 * `dungeonReducer.ts`'s `PLAYER_ATTACK` uses, and for the same reason: `EventPanel` animates that
 * die, so the value the player watches land has to be the value that actually resolved. (Arena can
 * roll internally because `TownScreen` renders its fight un-animated.) The modifier is re-derived
 * from `weaponFormula` here rather than passed, exactly as the reducer does. */
export function resolveEventRound(
  state: EventCombatState,
  hp: number,
  weaponFormula: string,
  targetId: number,
  rawRoll: number,
  rng: RNG = Math.random,
): EventRoundResult {
  if (state.outcome !== "ongoing") return { state, hp, died: false, events: [] };
  const target = state.monsters.find((m) => m.id === targetId);
  if (!target || target.hp <= 0) return { state, hp, died: false, events: [] };

  const { modifier } = parseWeaponFormula(weaponFormula);
  const total = Math.max(0, rawRoll + modifier);
  const atk = resolvePlayerAttack(target, rawRoll, total, rng);

  const monsters = state.monsters.map((m) => {
    if (m.id !== targetId) return m;
    const hit: CombatMonsterState = { ...m, hp: Math.max(0, m.hp - atk.damageDealt) };
    if (atk.monsterDefeated) return hit;
    // The two abilities the Event table actually contains that alter the monster itself, applied
    // exactly as dungeonReducer.ts's PLAYER_ATTACK case does: Firebreath queues a +10 counterattack,
    // Regeneration heals immediately (capped at maxHp).
    let after = hit;
    for (const event of atk.events) {
      if (event.kind === "firebreath") after = { ...after, bonusDamage: after.bonusDamage + 10 };
      else if (event.kind === "regeneration") {
        after = { ...after, hp: Math.min(after.maxHp, after.hp + event.amount) };
      }
    }
    return after;
  });

  // Explosive can kill the player in the same blast that defeats the monster -- death is checked
  // first regardless, mirroring both dungeonReducer.ts and arena.ts.
  let newHp = hp - atk.selfDestructDamageToPlayer;
  if (newHp <= 0) {
    return { state: { ...state, monsters, outcome: "defeat" }, hp: 0, died: true, events: atk.events };
  }

  const living = monsters.filter((m) => m.hp > 0);
  if (living.length === 0) {
    const lootCount = state.monsters[0]!.abilities.includes("loot") ? state.monsters.length : 0;
    const loot = lootCount > 0 ? rollLoot(lootCount, rng) : null;
    return { state: { monsters, outcome: "victory", loot }, hp: newHp, died: false, events: atk.events };
  }

  const counter = resolveMonsterTurn(living);
  newHp = Math.max(0, newHp - counter.totalDamage);
  const outcome = newHp <= 0 ? "defeat" : "ongoing";
  return { state: { ...state, monsters, outcome }, hp: newHp, died: newHp <= 0, events: atk.events };
}

/** Credits a won Event fight's Loot to the character. Split out from `resolveEventRound` (which is
 * pure over `hp` alone, like `resolveArenaRound`) so the caller applies resources once, at the end,
 * rather than threading a full `AdventurerResources` through every round. */
export function applyEventVictory(
  resources: AdventurerResources,
  state: EventCombatState,
  hp: number,
  monsterName: string,
  killCount: number,
): AdventurerResources {
  const loot = state.loot;
  return {
    ...resources,
    hp,
    coins: resources.coins + (loot?.coins ?? 0),
    treasures: resources.treasures + (loot?.treasures ?? 0),
    keys: resources.keys + (loot?.keys ?? 0),
    monsterKills: resources.monsterKills + killCount,
    killsByName: {
      ...resources.killsByName,
      [monsterName.toLowerCase()]: (resources.killsByName[monsterName.toLowerCase()] ?? 0) + killCount,
    },
  };
}

/** Exported for the panel's Camouflage row, so the UI names the spell from its own data rather than
 * hardcoding the string a second time. */
export function camouflageSpellName(): string {
  return SPELL_TABLE_BY_KEY.nature![3]!.name;
}

/** Elf Ranger's ability text, resolved from its own data for the same reason. */
export function elfRangerAbilityText(): string | undefined {
  return HIRELING_BY_NAME["Elf Ranger"]?.abilityText;
}
