import {
  REALMS,
  REALM_TERRAIN_HAZARD,
  type RealmDef,
  type RealmEventEffect,
  type RealmEventRow,
} from "../data/otherWorlds.ts";
import { OVERWORLD, type RealmKey } from "../data/realms.ts";
import type { OtherWorldKey } from "../data/portals.ts";
import type { Terrain } from "../data/hexTables.ts";
import { CANDY_TREASURE_TABLE } from "../data/otherWorlds.ts";
import { DUNGEON_TABLES } from "../data/dungeonTables.ts";
import type { HeldItem } from "./dungeonState.ts";
import type { AdventurerResources } from "./town.ts";
import { rollDie } from "./dice.ts";
import {
  hexKey,
  hexNeighbors,
  type HexCoord,
  type HexTile,
  type StashedRealm,
  type WorldState,
} from "./hexState.ts";
import type { RNG } from "./rng.ts";

/** Other Worlds (issue #105 / #21 stage 2) -- generating, entering and leaving the four realms a
 * portal can drop you into.
 *
 * The model keeps `WorldState` meaning "the map you are currently standing in", so every existing
 * consumer kept working untouched; `stashedRealms` holds the maps you aren't in, and switching
 * swaps one for the other. See `WorldState.stashedRealms` for why that shape was chosen over
 * realm-qualifying every per-hex map.
 */

export function currentRealm(world: WorldState): RealmKey {
  return world.realm ?? OVERWORLD;
}

export function isInOtherWorld(world: WorldState): boolean {
  return currentRealm(world) !== OVERWORLD;
}

/** The realm's own data, or null on the overworld -- the single place callers branch on "am I
 * somewhere with its own tables?". */
export function currentRealmDef(world: WorldState): RealmDef | null {
  const key = currentRealm(world);
  return key === OVERWORLD ? null : REALMS[key as OtherWorldKey];
}

/** Reveals a realm hex's six neighbours, mirroring `revealNeighborsInPlace()` but against the
 * realm's own flat 1d6 tables. Two real differences from the overworld:
 *
 * - Terrain doesn't depend on the neighbouring hex's terrain (the realm tables are flat lookups,
 *   not the overworld's from-this-terrain matrix), so no parent tile is needed.
 * - A location is rolled *unconditionally*. The overworld first rolls "is there anything here?" and
 *   only consults its Location table on a 6; every realm table instead lists a result for all six
 *   faces, several of which are that realm's own "nothing" row (Candy World's peanuts, and Magma,
 *   which the rulebook says never has a location at all).
 */
export function revealRealmNeighborsInPlace(
  tiles: Record<string, HexTile>,
  of: HexCoord,
  realm: RealmDef,
  rng: RNG,
): void {
  for (const neighbor of hexNeighbors(of)) {
    const key = hexKey(neighbor);
    if (tiles[key]) continue;
    const terrain = realm.terrain[rollDie(rng)]!;
    // "Magma: ... There are no locations here."
    const location = terrain === "magma" ? null : realm.location[rollDie(rng)]!;
    tiles[key] = { terrain, location };
  }
}

/** Builds a realm's map from scratch: "Make a new map... You start on a [terrain]." */
export function createRealmMap(realm: RealmDef, rng: RNG): StashedRealm {
  const start: HexCoord = { q: 0, r: 0 };
  const tiles: Record<string, HexTile> = {
    [hexKey(start)]: { terrain: realm.startTerrain, location: null },
  };
  revealRealmNeighborsInPlace(tiles, start, realm, rng);
  return { tiles, player: start, home: start, hasBoat: false };
}

/** Moves the player between realms, stashing the map they're leaving and restoring (or, on a first
 * visit, generating) the one they're entering. Returning to a realm you've been to before puts you
 * back exactly where you left it -- the rulebook's "you don't need to roll again" instinct for
 * portals, applied to whole worlds. */
export function switchRealm(world: WorldState, to: RealmKey, rng: RNG = Math.random): WorldState {
  const from = currentRealm(world);
  if (from === to) return world;

  const stashed: Partial<Record<RealmKey, StashedRealm>> = {
    ...(world.stashedRealms ?? {}),
    [from]: { tiles: world.tiles, player: world.player, home: world.home, hasBoat: world.hasBoat },
  };

  const existing = stashed[to];
  const destination =
    existing ?? (to === OVERWORLD ? null : createRealmMap(REALMS[to as OtherWorldKey], rng));
  if (!destination) {
    // Only reachable if the overworld itself was never stashed, which can't happen -- the player
    // always starts there. Bail rather than invent a second overworld.
    return world;
  }

  // The destination's own entry is dropped from the stash: it's live again now.
  const remaining = { ...stashed };
  delete remaining[to];

  return {
    ...world,
    realm: to,
    stashedRealms: remaining,
    tiles: destination.tiles,
    player: destination.player,
    home: destination.home,
    // A boat doesn't cross between worlds; a realm you return to keeps whatever it had.
    hasBoat: existing ? existing.hasBoat : false,
  };
}

/** Every realm the player could pick a destination in -- the current one plus anything stashed.
 * Underworld's "If you defeat Death you can go back to any world you like (in any hex you like)"
 * and the portal table's roll of 11 ("even from another world") are the two callers. */
export function visitedRealms(world: WorldState): RealmKey[] {
  const keys = new Set<RealmKey>([
    currentRealm(world),
    ...(Object.keys(world.stashedRealms ?? {}) as RealmKey[]),
  ]);
  return [...keys];
}

export interface RealmHazard {
  effect: RealmEventEffect;
  text: string;
}

/** What entering a hex of this terrain does to you (issue #105). Rolled fresh each time, since two
 * of the four hazards aren't flat values:
 *
 * - **Magma**: "you take 6d6 damage" -- rolled here, not stored, so it varies per hex.
 * - **Forest of the Impaled**: "roll a die. If it's 1 you are catatonic." Confirmed with the user as
 *   *losing your next move* rather than dying: `AdventurerResources.catatonic` makes the next travel
 *   action consume itself doing nothing. A 1-in-6 instant death on terrain you can be forced onto
 *   (by a Sea of Blood shove, no less) would be brutal, and nothing else in the game kills without
 *   the rulebook saying "you died".
 *
 * Returns null for terrain that costs nothing -- every overworld terrain, and Candy World's, which
 * is entirely harmless despite appearances.
 */
export function realmTerrainHazard(terrain: Terrain, rng: RNG = Math.random): RealmHazard | null {
  if (terrain === "magma") {
    let damage = 0;
    for (let i = 0; i < 6; i++) damage += rollDie(rng);
    return {
      effect: { kind: "loseHp", amount: damage },
      text: `The magma sears you for ${damage} damage.`,
    };
  }
  if (terrain === "forestOfImpaled") {
    if (rollDie(rng) !== 1) return null;
    return {
      effect: { kind: "catatonic" },
      text: "The horror of the place locks you rigid — you lose your next move.",
    };
  }
  const flat = REALM_TERRAIN_HAZARD[terrain as keyof typeof REALM_TERRAIN_HAZARD];
  if (!flat) return null;
  if (flat.kind === "moveToRandomAdjacent") {
    return { effect: flat, text: "The blood drags you under and spits you out somewhere else." };
  }
  if (flat.kind === "loseHp")
    return { effect: flat, text: `The thorns open you up for ${flat.amount} damage.` };
  return { effect: flat, text: "" };
}

export interface RealmEventRoll {
  total: number;
  dice: [number, number];
  row: RealmEventRow | null;
}

/** The realm equivalent of `rollTravelEvent()`: 2d6 on entering any hex, 7+ is nothing. Unlike the
 * overworld's version this has no location gate -- a realm rolls for events everywhere, since its
 * Location table is rolled unconditionally and "has a location" carries no special meaning there. */
export function rollRealmEvent(realm: RealmDef, rng: RNG = Math.random): RealmEventRoll {
  const dice: [number, number] = [rollDie(rng), rollDie(rng)];
  const total = dice[0] + dice[1];
  return { total, dice, row: total >= 7 ? null : (realm.event[total] ?? null) };
}

/** Underworld's "Dense fog (cannot pass through)" is unlike Rocks: "If you encounter a land with
 * Mist, you can spend 1 provision to wait for it to dissipate." So it blocks travel only when the
 * player can't pay. */
export function canClearDenseFog(provisions: number): boolean {
  return provisions >= 1;
}

export function realmLabel(key: RealmKey): string {
  return key === OVERWORLD ? "the world" : REALMS[key as OtherWorldKey].name;
}

// --- Per-world victory rewards -------------------------------------------------------------------

export interface RealmVictoryReward {
  resources: AdventurerResources;
  message: string;
  /** Hell only: "With the death of the Infernal Baron, a Portal is opened in place of his body." The
   * caller stamps it, since only it holds the coordinate the fight happened on. */
  opensPortalHere: boolean;
  /** Underworld only: "If you defeat Death you can go back to any world you like (in any hex you
   * like)" -- the caller offers the cross-realm picker. */
  unlocksAnyDestination: boolean;
}

/** What defeating a given realm's monster grants, on top of the ordinary Loot/kill bookkeeping
 * `applyEventVictory()` already did (issue #105).
 *
 * Matched on monster *name*, the same "no formal taxonomy, substring/exact-name matching instead"
 * convention the rest of this codebase uses for monster categories -- the rulebook names these
 * rewards by creature, not by any tag.
 */
export function applyRealmVictoryReward(
  resources: AdventurerResources,
  realm: RealmKey,
  monsterName: string,
  rng: RNG = Math.random,
): RealmVictoryReward {
  const plain = (message: string): RealmVictoryReward => ({
    resources,
    message,
    opensPortalHere: false,
    unlocksAnyDestination: false,
  });

  if (realm === "hell" && (monsterName === "Demon Lord" || monsterName === "Infernal Baron")) {
    // "you'll encounter 1d6 Magic Items (roll on the table on page 23 -- the Palace Reward Magic
    // Item column)". Rolled here as held items rather than equipped gear: `resolveMagicItem()` lives
    // in `dungeonReducer` and operates on a `DungeonState` draft, which doesn't exist out here. Each
    // is worth its rolled Magic Item's own name, sellable in town -- the same landing spot #83 uses
    // for gear a character can't use on the spot.
    const count = rollDie(rng);
    const items = Array.from({ length: count }, () => {
      const entry = DUNGEON_TABLES.palace.magicItem[rollDie(rng)]!;
      return { name: entry.name, worth: MAGIC_ITEM_WORTH };
    });
    const isBaron = monsterName === "Infernal Baron";
    return {
      resources: { ...resources, heldItems: [...resources.heldItems, ...items] },
      message: `${count} Magic Item${count === 1 ? "" : "s"} lie among the ashes.${isBaron ? " Where the Baron fell, a Portal opens." : ""}`,
      opensPortalHere: isBaron,
      unlocksAnyDestination: false,
    };
  }

  if (realm === "underworld" && monsterName === "The Death") {
    return {
      resources,
      message: "Death is beaten. Every world is open to you now — step through anywhere you like.",
      opensPortalHere: false,
      unlocksAnyDestination: true,
    };
  }

  if (realm === "pesadelum" && monsterName === "Tentacle") {
    // "a Dream Potion (If you drink it you can reverse your HP number, trading the Ten value with
    // the Unit)". Carried as a held item; `drinkDreamPotion()` below is the effect.
    return plainWith(resources, DREAM_POTION, "Among the coils you find a Dream Potion.");
  }

  if (realm === "candyWorld") {
    // "If you defeat a monster, roll a treasure" -- every monster, not a specific one.
    const roll = rollDie(rng) + rollDie(rng);
    const entry = CANDY_TREASURE_TABLE[roll];
    if (!entry) return plain("You find nothing but crumbs.");
    let next = resources;
    if (entry.coins) next = { ...next, coins: next.coins + entry.coins };
    if (entry.healAll) next = { ...next, hp: next.maxHp };
    if (entry.armorHp && entry.armorName) {
      next = {
        ...next,
        armor: [
          ...next.armor,
          {
            piece: "wonderItem",
            hp: entry.armorHp,
            maxHp: entry.armorHp,
            itemName: entry.armorName,
          },
        ],
      };
    }
    if (entry.palaceTreasure) {
      const treasure = DUNGEON_TABLES.palace.magicItem[rollDie(rng)]!;
      next = {
        ...next,
        heldItems: [...next.heldItems, { name: treasure.name, worth: MAGIC_ITEM_WORTH }],
      };
    }
    return {
      resources: next,
      message: entry.text,
      opensPortalHere: false,
      unlocksAnyDestination: false,
    };
  }

  return plain("");
}

function plainWith(
  resources: AdventurerResources,
  item: HeldItem,
  message: string,
): RealmVictoryReward {
  return {
    resources: { ...resources, heldItems: [...resources.heldItems, item] },
    message,
    opensPortalHere: false,
    unlocksAnyDestination: false,
  };
}

/** A flat sale value for a Magic Item won outside a dungeon -- these arrive as sellable `HeldItem`s
 * rather than equipped gear (see `applyRealmVictoryReward`), and the Magic Item table carries no
 * price of its own. Matches `OGRE_UNUSABLE_TREASURE_WORTH`'s own "small flat placeholder" reasoning,
 * scaled up because a Magic Item is a real prize. */
export const MAGIC_ITEM_WORTH = 10;

export const DREAM_POTION: HeldItem = { name: "Dream Potion", worth: 5 };

/** Pesadelum's Tentacle reward: "reverse your HP number, trading the Ten value with the Unit."
 * 34 HP becomes 43. Deliberately capped at `maxHp` -- nothing else in the game lets current HP
 * exceed the maximum, and the alternative (a permanent overheal) would need its own display rules.
 * Single-digit HP reverses to itself (7 -> 7); three digits are left alone, since the rulebook only
 * describes a two-digit swap. */
export function reverseHp(hp: number, maxHp: number): number {
  if (hp < 10 || hp > 99) return hp;
  const swapped = (hp % 10) * 10 + Math.floor(hp / 10);
  return Math.min(Math.max(1, swapped), maxHp);
}

export function hasDreamPotion(resources: AdventurerResources): boolean {
  return resources.heldItems.some((i) => i.name === DREAM_POTION.name);
}

export function drinkDreamPotion(resources: AdventurerResources): AdventurerResources {
  const index = resources.heldItems.findIndex((i) => i.name === DREAM_POTION.name);
  if (index === -1) return resources;
  return {
    ...resources,
    hp: reverseHp(resources.hp, resources.maxHp),
    heldItems: resources.heldItems.filter((_, i) => i !== index),
  };
}
