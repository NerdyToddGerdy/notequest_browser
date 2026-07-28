import type { MonsterTemplate } from "./dungeonTables.ts";
import type { OverworldTerrain } from "./hexTables.ts";

/** "Events on Travel" (`docs/game-rules-reference.md` lines 908-926, issue #91): "Whenever you enter
 * a hex that doesn't have a location, roll 2d6. If it's 7 or more, nothing happened. If not, you
 * have found an Event."
 *
 * The printed table's columns are outcome *bands*, not individual 2d6 totals -- "Result 2",
 * "Result 3 or 4", "Result 5 or 6" -- so it's modeled as a band lookup (`eventBandFor()`) rather
 * than the `Record<number, ...>` shape every other 2d6 table in this codebase uses. Totals of 7+
 * never reach the table at all.
 *
 * Monster rows reuse `MonsterTemplate` unchanged (the same thing `arena.ts`'s
 * `ARENA_CHAMPION_TABLE` does for a non-dungeon fight), so `combat.ts`'s `spawnMonsters()`/
 * `resolvePlayerAttack()`/`resolveMonsterTurn()` apply as-is. Non-monster rows are a small typed
 * effect union instead of free text, since each one actually does something.
 */
export type EventEffect =
  /** "Heavy rain (loses 1 provisions)", "Sand Storm", "Blizzard (lose 2 provisions)". */
  | { kind: "loseProvisions"; amount: number }
  /** "Avalanche (lose 2 HP)". Floored at 1 HP -- see `events.ts`'s `applyEventEffect()`. */
  | { kind: "loseHp"; amount: number }
  /** "Storm (Move to a random hex)" -- relocation, not damage. */
  | { kind: "moveToRandomHex" }
  /** Glacier's "Cracked Ice (You died!)" -- the only Event that kills outright. */
  | { kind: "instantDeath" };

export interface EventRow {
  /** Narrative only -- deliberately *not* including the mechanical clause the rulebook prints in
   * parentheses ("loses 1 provisions", "lose 2 HP", the monster stat block). The concrete outcome is
   * reported separately: `applyEventEffect()`'s own message states what was actually lost (which can
   * differ from the printed number once flooring applies), and the fight UI shows monster stats. */
  text: string;
  /** Exactly one of `monsters`/`effect` is set. */
  monsters?: MonsterTemplate;
  effect?: EventEffect;
}

/** Which column of the printed table a 2d6 total lands in. `null` for 7+ ("nothing happened"). */
export type EventBand = 2 | 34 | 56;

export function eventBandFor(total: number): EventBand | null {
  if (total === 2) return 2;
  if (total === 3 || total === 4) return 34;
  if (total === 5 || total === 6) return 56;
  return null;
}

/** Repeated across several terrains, so shared rather than re-authored per row. */
const HEAVY_RAIN: EventRow = {
  text: "Heavy rain sets in.",
  effect: { kind: "loseProvisions", amount: 1 },
};
const SAND_STORM: EventRow = {
  text: "A sand storm engulfs you.",
  effect: { kind: "loseProvisions", amount: 1 },
};
const BLIZZARD: EventRow = {
  text: "A blizzard closes in.",
  effect: { kind: "loseProvisions", amount: 2 },
};
const STORM: EventRow = {
  text: "A storm sweeps you off course.",
  effect: { kind: "moveToRandomHex" },
};
const CRACKED_ICE: EventRow = {
  text: "The ice cracks beneath you and the water takes you.",
  effect: { kind: "instantDeath" },
};

/** "Creatures with Loot will have 1d6-1 coins" -- the `loot` ability, resolved by `combat.ts`'s
 * existing `rollLoot()` on victory, exactly as a dungeon monster's would be. */
export const EVENT_TABLE: Record<OverworldTerrain, Record<EventBand, EventRow>> = {
  water: {
    2: { text: "A Kraken rises from the deep.", monsters: { name: "Kraken", hp: 50, damage: 10, abilities: [], count: 1 } },
    34: {
      text: "Pirates board you.",
      monsters: { name: "Pirates", singularName: "Pirate", hp: 5, damage: 2, abilities: ["loot"], count: 4 },
    },
    56: STORM,
  },
  plain: {
    2: {
      text: "A Wyvern drops out of the sky.",
      monsters: { name: "Wyvern", hp: 12, damage: 6, abilities: ["firebreath"], count: 1 },
    },
    34: { text: "An Orc bars your way.", monsters: { name: "Orc", hp: 6, damage: 3, abilities: ["loot"], count: 1 } },
    56: HEAVY_RAIN,
  },
  mountain: {
    2: {
      text: "A Dragon descends on you.",
      monsters: { name: "Dragon", hp: 30, damage: 7, abilities: ["firebreath"], count: 1 },
    },
    34: { text: "Two Orcs ambush you.", monsters: { name: "Orcs", singularName: "Orc", hp: 6, damage: 3, abilities: ["loot"], count: 2 } },
    56: { text: "An avalanche catches you.", effect: { kind: "loseHp", amount: 2 } },
  },
  forest: {
    2: {
      text: "A Troll lumbers out of the trees.",
      monsters: { name: "Troll", hp: 10, damage: 6, abilities: ["regeneration"], count: 1 },
    },
    34: {
      text: "Goblins swarm out of the undergrowth.",
      monsters: {
        name: "Goblins",
        singularName: "Goblin",
        hp: 3,
        damage: 1,
        abilities: ["explosive"],
        count: { dice: 1, sides: 6 },
      },
    },
    56: HEAVY_RAIN,
  },
  swamp: {
    2: { text: "A Moss Giant hauls itself upright.", monsters: { name: "Moss Giant", hp: 20, damage: 2, abilities: [], count: 1 } },
    34: HEAVY_RAIN,
    56: STORM,
  },
  desert: {
    2: { text: "A Giant Worm erupts from the sand.", monsters: { name: "Giant Worm", hp: 30, damage: 10, abilities: [], count: 1 } },
    34: SAND_STORM,
    56: SAND_STORM,
  },
  tundra: {
    2: { text: "A Yeti stalks you across the snow.", monsters: { name: "Yeti", hp: 20, damage: 5, abilities: [], count: 1 } },
    34: BLIZZARD,
    56: BLIZZARD,
  },
  // Unreachable in practice while `WorldState.climate` is hardcoded "hot" (glacier only exists in
  // the still-unused COLD_TERRAIN_TABLE) -- authored for `Record<Terrain, ...>` completeness, the
  // same reason DUNGEON_TYPE_BY_TERRAIN fills in its own glacier/water rows.
  glacier: { 2: CRACKED_ICE, 34: CRACKED_ICE, 56: BLIZZARD },
};
