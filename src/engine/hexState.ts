import { rollDie } from "./dice.ts";
import type { RNG } from "./rng.ts";
import {
  CITY_OR_FORTRESS,
  COLD_TERRAIN_TABLE,
  HOT_TERRAIN_TABLE,
  LOCATION_TABLE,
  type Climate,
  type ColdTerrain,
  type HotTerrain,
  type Land,
  type LocationKind,
  type Terrain,
} from "../data/hexTables.ts";
import { CULTURE_BY_LOCATION, hasAffinity, type CityCulture } from "../data/affinity.ts";
import { CITY_NAME_PREFIX, CITY_NAME_SUFFIX } from "../data/cityNames.ts";
import type { AnimalDef, BuildingKind } from "../data/types.ts";
import type { RealmKey } from "../data/realms.ts";

export interface HexCoord {
  q: number;
  r: number;
}

export function hexKey(c: HexCoord): string {
  return `${c.q},${c.r}`;
}

/** The inverse of `hexKey()` -- needed for Politics' (issue #27) Vassal-within-3-hexes distance
 * check, which only has an owned building's stored `hexKey` string to work from. */
export function parseHexKey(key: string): HexCoord {
  const [q, r] = key.split(",").map(Number);
  return { q: q!, r: r! };
}

/** Axial neighbor offsets, pointy-top hexes. */
export const HEX_DIRECTIONS: readonly HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function hexNeighbors(c: HexCoord): HexCoord[] {
  return HEX_DIRECTIONS.map((d) => ({ q: c.q + d.q, r: c.r + d.r }));
}

/** Standard axial hex distance -- Politics' (issue #27) "within 3 hexes" Vassal-eligibility check
 * is the only consumer today. */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export interface HexTile {
  terrain: Terrain;
  location: LocationKind | null;
  /** The PendingDungeon.id found here, once "Enter Dungeon" has been used on this hex -- lets a
   * later visit (same character returning, or a new one taking over) resume the same dungeon
   * instead of rolling fresh. Set once, on first entry; never cleared, even once beaten. */
  dungeonRunId?: string;
  /** Set by the "Ask" City Action (`findAskedDungeonHex`/`withDungeonMarked`) the moment a nearby
   * dungeon hex is found -- "draw the dungeon on the map" happens here, before the player has ever
   * set foot on this tile or a `dungeonRunId`/`PendingDungeon` exists for it. Once the player
   * actually travels here and uses "Enter Dungeon", the normal first-entry flow takes over exactly
   * as it does for a City/Fortress/Ruins hex -- this flag only ever widens *which* hexes can offer
   * that button, it never itself mints a run. */
  dungeonMarked?: boolean;
  /** A generated proper name (issue #49), set once -- alongside `terrain`/`location` -- the moment
   * a City/Fortress location is first rolled, so it's stable for that hex forever. Only ever set
   * for a City/Fortress `location` (see `rollCityName()`); everything else (Ruins, water, "It was
   * nothing...," etc.) has no identity of its own to name. Optional so a session persisted before
   * this field existed still loads -- an old city with no name falls back to its generic
   * `LOCATION_LABEL` wherever this is displayed. */
  name?: string;
  /** Buildings (issue #27) -- set once a character builds here (`withBuilding()`), replaced in
   * place on a later upgrade. A building doesn't count as a `location` in the `LocationKind` sense
   * -- it's a player-owned overlay on an otherwise-empty hex, so `location` stays `null`. */
  building?: BuildingKind;
  /** Portals (issue #21): the 3d6 total this portal was established at. "Once you've established
   * where a portal leads, you don't need to roll again for it" -- so the first trip through fixes
   * the destination forever and every later trip reuses it, making a portal a stable piece of
   * geography rather than a slot machine. Only ever set on a `location: "portal"` hex. */
  portalTotal?: number;
}

export interface WorldState {
  /** Always "hot" for now -- the cold table is real data but nothing picks it yet. */
  climate: Climate;
  home: HexCoord;
  player: HexCoord;
  /** Sparse, populated lazily -- a tile only exists once its terrain+location are rolled,
   * mirroring DungeonState's segments (which likewise don't exist until a door reveals them). The
   * rulebook rolls a hex's location the same moment it rolls its terrain (both happen when its
   * *parent* hex is entered), so there's no separate "terrain known, location TBD" state to model
   * -- presence in this map means fully known. */
  tiles: Record<string, HexTile>;
  /** "Hire Boat" (a City Action, see `town.ts`/`TownScreen.tsx`) -- true for exactly one `MOVE`
   * onto water; "once you enter non-water terrain you leave the boat" clears it automatically the
   * moment the player lands somewhere that isn't water again. */
  hasBoat: boolean;
  /** Thug Life's failed-escape outcome ("you have fled, and will no longer be able to enter this
   * city") -- hex keys the player is permanently barred from entering, world-scoped like
   * `dungeonRunId`/discovered tiles rather than tied to any one character (this app has no
   * per-character bucket on `WorldState` to scope a ban to any more narrowly -- see CLAUDE.md's
   * "Getting Money" note). Optional so a session persisted before this field existed still loads;
   * always read via `isBannedHex()`, never directly, so that default stays in one place. */
  bannedHexes?: string[];
  /** Politics (issue #27) -- the outcome of a resolved Political Affinity roll at a City/Fortress
   * hex, keyed by `hexKey()`. Optional so a session persisted before this field existed still
   * loads; always read via `politicalStatusFor()`, never directly, so that default stays in one
   * place, same "optional for back-compat" precedent as `bannedHexes`. A hex's entry, once set, is
   * permanent -- there's no re-rolling a hex that already has a status. */
  politicalStatus?: Record<string, "ally" | "vassal" | "enemy">;
  /** Portals (issue #21), the 3d6 roll of 13: "You are still in the same place but now whenever you
   * reveal a Plain you find Water." A permanent, world-scoped curse on *future* generation only --
   * already-revealed plains are untouched (the rulebook says "whenever you reveal," not "every
   * plain becomes"). Optional for back-compat like `bannedHexes`; applied inside `nextTerrain()`,
   * the single chokepoint every newly-revealed tile's terrain goes through. */
  plainsRevealAsWater?: boolean;
  /** Other Worlds (issue #105): which map `tiles`/`player`/`home` currently describe. Optional and
   * read via `currentRealm()` so a session saved before realms existed still loads as
   * `"overworld"`. */
  realm?: RealmKey;
  /** The maps you *aren't* standing in. `WorldState` deliberately still means "the map you're in",
   * so all ~22 of its consumers kept working unchanged; switching realms swaps the live
   * `tiles`/`player`/`home`/`hasBoat` into here and pulls the destination's back out.
   *
   * This is also why the realm-scoped systems stop at survival (see `otherWorlds.ts`): `bannedHexes`,
   * `politicalStatus` and `HexTile.dungeonRunId` are all keyed by a bare `hexKey`, so two realms'
   * `"0,0"` would collide. Rather than realm-qualify every one of those maps, Buildings/Politics/
   * Warfare/dungeons simply don't operate in a realm -- and `bannedHexes`/`politicalStatus` stay
   * top-level, describing the overworld only. */
  stashedRealms?: Partial<Record<RealmKey, StashedRealm>>;
}

/** Everything that makes one realm's map distinct from another's. Deliberately *not* the whole
 * `WorldState`: `climate`, `bannedHexes`, `politicalStatus` and `plainsRevealAsWater` are properties
 * of the traveller or the overworld, and follow them across realms rather than being stashed. */
export interface StashedRealm {
  tiles: Record<string, HexTile>;
  player: HexCoord;
  home: HexCoord;
  hasBoat: boolean;
}

/** `current` is trusted to belong to `climate`'s own terrain set (a hot-climate world only ever
 * produces HotTerrain values, a cold one only ColdTerrain) -- true by construction, since every
 * tile in a WorldState is generated by this same function against the same fixed climate. */
function nextTerrain(
  current: Terrain,
  climate: Climate,
  roll: number,
  plainsAsWater = false,
): Terrain {
  const rolled =
    climate === "hot"
      ? HOT_TERRAIN_TABLE[roll]![current as HotTerrain]
      : COLD_TERRAIN_TABLE[roll]![current as ColdTerrain];
  // Portals' roll of 13 -- see WorldState.plainsRevealAsWater.
  return plainsAsWater && rolled === "plain" ? "water" : rolled;
}

/** City/Fortress name generator (issue #49) -- two 1d6 rolls (prefix, suffix) against the given
 * culture's `CITY_NAME_PREFIX`/`CITY_NAME_SUFFIX` tables (`data/cityNames.ts`), joined into one
 * compound word (e.g. "Iron" + "hold" -> "Ironhold"). Not from the rulebook, mirroring
 * `dungeonTypes.ts`'s own "second part"/"third part" flavor-name combination. */
export function rollCityName(culture: CityCulture, rng: RNG): string {
  const prefix = CITY_NAME_PREFIX[culture][rollDie(rng)]!;
  const suffix = CITY_NAME_SUFFIX[culture][rollDie(rng)]!;
  return `${prefix}${suffix}`;
}

/**
 * "When entering a hex, first determine the neighboring hexes. Roll one die in the Terrain table
 * for each hex. After that, roll one more die for each hex to see if there is a location. If it
 * lands on 6, there is a location -- roll on the Location table." Mutates `tiles` in place (works
 * whether it's a plain object, as in `createInitialWorldState`, or an Immer `Draft`, as in
 * `hexReducer`'s `produce()`) and never overwrites an already-revealed tile, so a hex shared by
 * two revealed neighbors only ever gets rolled once. A City/Fortress location also gets a
 * `rollCityName()` name in the same pass, right where its `location` itself is decided.
 */
export function revealNeighborsInPlace(
  tiles: Record<string, HexTile>,
  of: HexCoord,
  climate: Climate,
  rng: RNG,
  plainsAsWater = false,
): void {
  const parent = tiles[hexKey(of)];
  if (!parent) return;
  for (const neighbor of hexNeighbors(of)) {
    const key = hexKey(neighbor);
    if (tiles[key]) continue;
    const terrain = nextTerrain(parent.terrain, climate, rollDie(rng), plainsAsWater);
    const hasLocation = rollDie(rng) === 6;
    const location = hasLocation ? LOCATION_TABLE[rollDie(rng)]![terrain as Land] : null;
    const culture = location ? CULTURE_BY_LOCATION[location] : undefined;
    tiles[key] = culture
      ? { terrain, location, name: rollCityName(culture, rng) }
      : { terrain, location };
  }
}

/** Animals (issue #26): how many of `coord`'s six neighbors already share `terrain` -- both
 * acquisition paths ("train in the wild," "buy a mount in a qualifying city") require at least 2. */
export function countMatchingNeighbors(
  tiles: Record<string, HexTile>,
  coord: HexCoord,
  terrain: Terrain,
): number {
  return hexNeighbors(coord).filter((n) => tiles[hexKey(n)]?.terrain === terrain).length;
}

/** "This land must be empty (no location) and have at least 2 lands of the same type adjacent to
 * it." An empty `animal.terrain` (Snake's "Any") always matches terrain-wise. */
export function qualifiesForTraining(
  tile: HexTile,
  matchingNeighbors: number,
  animal: AnimalDef,
): boolean {
  const terrainMatches = animal.terrain.length === 0 || animal.terrain.includes(tile.terrain);
  return tile.location === null && terrainMatches && matchingNeighbors >= 2;
}

/** "You can buy mounts in a city that is on the appropriate terrain (and also has at least two of
 * the same land adjacent to it)" -- culture-agnostic, unlike Hirelings: only the city's own terrain
 * has to match, not which culture built it. */
export function qualifiesForBuyingMount(
  tile: HexTile,
  matchingNeighbors: number,
  mount: AnimalDef,
): boolean {
  const terrainMatches = mount.terrain.includes(tile.terrain);
  return (
    tile.location !== null &&
    CITY_OR_FORTRESS.has(tile.location) &&
    terrainMatches &&
    matchingNeighbors >= 2
  );
}

/** Immutably ties a `PendingDungeon` to the hex at `coord` -- called from App.tsx the moment a
 * hex's dungeon is rolled for the very first time (see CLAUDE.md's per-hex dungeon persistence
 * note). A no-op if the hex isn't known yet, which shouldn't happen in practice -- this only ever
 * runs while standing on one. */
export function withDungeonRunId(world: WorldState, coord: HexCoord, runId: string): WorldState {
  const key = hexKey(coord);
  const tile = world.tiles[key];
  if (!tile) return world;
  return { ...world, tiles: { ...world.tiles, [key]: { ...tile, dungeonRunId: runId } } };
}

/** The inverse of `withDungeonRunId()` -- issue #79's "Locate" (show, not travel to, a dungeon
 * from the Dungeons list on the map) and #80's closest-to-farthest sort both need to turn a
 * `PendingDungeon.id` back into a coordinate. `null` if no known tile carries it, which shouldn't
 * happen in practice (a `PendingDungeon` only ever exists because some hex was already stamped). */
export function findHexForRunId(world: WorldState, runId: string): HexCoord | null {
  for (const [key, tile] of Object.entries(world.tiles)) {
    if (tile.dungeonRunId === runId) return parseHexKey(key);
  }
  return null;
}

/** "Ask" City Action (`docs/game-rules-reference.md` lines 978-985) -- rolls a hex side and steps
 * clockwise through `from`'s own six neighbors for the first one that's land with no location: "In
 * this hex there will be a dungeon ... If the hex has Water or another City or Ruins, go clockwise
 * to the next hex until you find land that has no location and isn't water." Every neighbor of an
 * already-entered hex is guaranteed to already be revealed (see `revealNeighborsInPlace`), so this
 * only ever reads `tiles` -- it never needs to reveal anything itself. Returns `null` in the
 * should-be-impossible case that all six neighbors are Water/City/Fortress/Ruins/Rocks, since the
 * rulebook doesn't cover that.
 */
export function findAskedDungeonHex(world: WorldState, from: HexCoord, rng: RNG): HexCoord | null {
  const roll = rollDie(rng);
  for (let i = 0; i < 6; i++) {
    const dir = HEX_DIRECTIONS[(roll - 1 + i) % 6]!;
    const coord = { q: from.q + dir.q, r: from.r + dir.r };
    const tile = world.tiles[hexKey(coord)];
    if (tile && tile.terrain !== "water" && tile.location === null) return coord;
  }
  return null;
}

/** Companion to `withDungeonRunId` -- immutably flags a hex as "a dungeon has been found nearby"
 * (see `HexTile.dungeonMarked`) without minting a run for it yet. */
export function withDungeonMarked(world: WorldState, coord: HexCoord): WorldState {
  const key = hexKey(coord);
  const tile = world.tiles[key];
  if (!tile) return world;
  return { ...world, tiles: { ...world.tiles, [key]: { ...tile, dungeonMarked: true } } };
}

/** True once the hex at `coord` has been permanently barred by a failed Thug Life escape (see
 * `HexTile`'s -- no, `WorldState.bannedHexes`' -- own doc comment). The one place this list should
 * ever be read, so the `?? []` back-compat default for a pre-#58 persisted session lives here once
 * instead of at every call site. */
export function isBannedHex(world: WorldState, coord: HexCoord): boolean {
  return (world.bannedHexes ?? []).includes(hexKey(coord));
}

/** Immutably bars a hex for good -- "Thug Life" (`town.ts`'s `resolveThugLife()`) is the only
 * caller today. Idempotent (a second call is a no-op) even though nothing currently re-bans an
 * already-banned hex. */
export function withBannedHex(world: WorldState, coord: HexCoord): WorldState {
  if (isBannedHex(world, coord)) return world;
  return { ...world, bannedHexes: [...(world.bannedHexes ?? []), hexKey(coord)] };
}

/** Buildings (issue #27) -- immutably stamps (or replaces, on an upgrade) the building at `coord`.
 * A no-op if the hex isn't known yet, same "shouldn't happen in practice" contract as
 * `withDungeonRunId`. */
export function withBuilding(world: WorldState, coord: HexCoord, kind: BuildingKind): WorldState {
  const key = hexKey(coord);
  const tile = world.tiles[key];
  if (!tile) return world;
  return { ...world, tiles: { ...world.tiles, [key]: { ...tile, building: kind } } };
}

/** Warfare (issue #28): Declared Enemies destroying one of the player's own structures -- clears
 * `HexTile.building` back to nothing (the hex reverts to a plain, re-buildable empty hex, not
 * Ruins -- Ruins is specifically what a *stormed City/Fortress location* becomes, and a
 * player-built structure was never a `location` to begin with). Same immutable-stamp shape as
 * `withBuilding`. */
export function withoutBuilding(world: WorldState, coord: HexCoord): WorldState {
  const key = hexKey(coord);
  const tile = world.tiles[key];
  if (!tile) return world;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to omit it
  const { building: _building, ...rest } = tile;
  return { ...world, tiles: { ...world.tiles, [key]: rest } };
}

/** Warfare (issue #28): "Storming the Castle" 's Loot outcome -- "you destroy the place
 * completely (mark it on the map as Ruins)." Clears the hex's generated `name` too (Ruins have no
 * city name); `dungeonRunId`/`dungeonMarked` are left untouched, since razing the city doesn't
 * erase an unrelated dungeon already tied to this hex. */
export function withRazedToRuins(world: WorldState, coord: HexCoord): WorldState {
  const key = hexKey(coord);
  const tile = world.tiles[key];
  if (!tile) return world;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to omit it
  const { name: _name, ...rest } = tile;
  return { ...world, tiles: { ...world.tiles, [key]: { ...rest, location: "ruins" } } };
}

/** Politics (issue #27) -- `null` if this hex's Political Affinity roll hasn't been attempted yet,
 * the one place the `?? {}` back-compat default for a pre-#27 persisted session lives. */
export function politicalStatusFor(
  world: WorldState,
  coord: HexCoord,
): "ally" | "vassal" | "enemy" | null {
  return (world.politicalStatus ?? {})[hexKey(coord)] ?? null;
}

/** Immutably records a hex's Political Affinity outcome -- permanent, like `withBannedHex`; no
 * caller re-resolves an already-decided hex (see `politics.ts`'s `canAttemptPoliticalAffinity`). */
export function withPoliticalStatus(
  world: WorldState,
  coord: HexCoord,
  status: "ally" | "vassal" | "enemy",
): WorldState {
  const key = hexKey(coord);
  return { ...world, politicalStatus: { ...(world.politicalStatus ?? {}), [key]: status } };
}

/** Portals (issue #21): drops the player onto an arbitrary already-known hex, revealing its neighbors
 * the same way an ordinary `MOVE` would. Not routed through `hexReducer`'s `MOVE` for the same reason
 * `STORM_RELOCATE` isn't -- a portal destination is emphatically not adjacent. The boat is dropped on
 * arrival (it was moored wherever you left), matching `MOVE`/`STORM_RELOCATE`. */
export function withPlayerMovedTo(world: WorldState, dest: HexCoord, rng: RNG): WorldState {
  const tiles = { ...world.tiles };
  revealNeighborsInPlace(tiles, dest, world.climate, rng, world.plainsRevealAsWater);
  return { ...world, player: dest, hasBoat: false, tiles };
}

/** Hell's Infernal Baron (issue #105): "With the death of the Infernal Baron, a Portal is opened in
 * place of his body." The only place in the game where a hex *gains* a location mid-play. Leaves an
 * existing location alone -- the Baron can only be met on an Event, and Events fire on hexes whose
 * own location has already been rolled. */
export function withPortalHere(world: WorldState, coord: HexCoord): WorldState {
  const key = hexKey(coord);
  const tile = world.tiles[key];
  if (!tile || tile.location === "portal") return world;
  return { ...world, tiles: { ...world.tiles, [key]: { ...tile, location: "portal" } } };
}

/** Portals (issue #21): remembers the 3d6 total a portal hex was established at, so every later trip
 * through reuses it ("once you've established where a portal leads, you don't need to roll again"). */
export function withPortalTotal(world: WorldState, coord: HexCoord, total: number): WorldState {
  const key = hexKey(coord);
  const tile = world.tiles[key];
  if (!tile) return world;
  return { ...world, tiles: { ...world.tiles, [key]: { ...tile, portalTotal: total } } };
}

/** Portals' roll of 9 ("the nearest town, even if it's an enemy town") and 10 ("the nearest human
 * city"). Nearest is by `hexDistance()` from `from`, ties broken by hex-key order for determinism;
 * `humanOnly` narrows to the two Human locations. Deliberately searches only *revealed* tiles -- the
 * player can't be sent to a town that doesn't exist yet -- and excludes `from` itself so a portal
 * standing in a city doesn't resolve to where you already are. `null` if nothing qualifies, which the
 * caller must handle (an early-game map may genuinely have no known city but Haven). */
export function findNearestTown(
  world: WorldState,
  from: HexCoord,
  humanOnly: boolean,
): HexCoord | null {
  const fromKey = hexKey(from);
  let best: { coord: HexCoord; distance: number; key: string } | null = null;
  for (const [key, tile] of Object.entries(world.tiles)) {
    if (key === fromKey) continue;
    if (!tile.location || !CITY_OR_FORTRESS.has(tile.location)) continue;
    if (humanOnly && tile.location !== "humanCity" && tile.location !== "humanFortress") continue;
    const coord = parseHexKey(key);
    const distance = hexDistance(from, coord);
    if (!best || distance < best.distance || (distance === best.distance && key < best.key)) {
      best = { coord, distance, key };
    }
  }
  return best?.coord ?? null;
}

/** Portals' roll of 6: "You went to the future, and all cities are destroyed (Ruins)." Applies
 * `withRazedToRuins`'s own shape to *every* City/Fortress at once -- names dropped, dungeons left
 * alone. Buildings the player raised are deliberately spared: they aren't `LocationKind` cities (a
 * built hex keeps `location: null`), and destroying someone's Castle as a side effect of a portal
 * roll the rulebook doesn't mention would be its own, much harsher rule. Political statuses are left
 * as they are too -- a razed city has no one left to have a treaty with, but nothing reads a status
 * for a Ruins hex, so clearing them would be busywork. */
export function withAllCitiesRazed(world: WorldState): WorldState {
  const tiles: Record<string, HexTile> = {};
  for (const [key, tile] of Object.entries(world.tiles)) {
    if (tile.location && CITY_OR_FORTRESS.has(tile.location)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to omit it
      const { name: _name, ...rest } = tile;
      tiles[key] = { ...rest, location: "ruins" };
    } else {
      tiles[key] = tile;
    }
  }
  return { ...world, tiles };
}

/** Portals' roll of 12: "You went to another reality. Create a new map from scratch." A brand-new map
 * generated exactly like a new game's, but deliberately *keeping* everything that belongs to the
 * character rather than the geography: `hasBoat` is dropped (the boat was moored in the old reality),
 * while `plainsRevealAsWater` carries over, since roll 13 curses the traveler's eyes rather than any
 * one world. Buildings/politics/bans all belonged to hexes that no longer exist and are simply gone
 * -- but note `AdventurerResources.buildings` still lists them, so the boss-kill tax survives; that
 * asymmetry is deliberate (the alternative is silently confiscating a player's investment). */
export function withNewReality(world: WorldState, rng: RNG): WorldState {
  const fresh = createInitialWorldState(rng);
  return { ...fresh, plainsRevealAsWater: world.plainsRevealAsWater };
}

/** Scans every currently-revealed tile for a City/Fortress whose culture `raceName` has Affinity
 * for, returning the one nearest `home` (via `hexDistance()`) if more than one matches -- `null` if
 * nothing qualifies yet. Issue #78's `findOrRevealCompatibleHome()` is the only caller. */
function findCompatibleCity(
  tiles: Record<string, HexTile>,
  home: HexCoord,
  raceName: string,
): HexCoord | null {
  let best: HexCoord | null = null;
  let bestDist = Infinity;
  for (const [key, tile] of Object.entries(tiles)) {
    if (!tile.location || !CULTURE_BY_LOCATION[tile.location]) continue;
    if (!hasAffinity(raceName, tile.location)) continue;
    const coord = parseHexKey(key);
    const dist = hexDistance(home, coord);
    if (dist < bestDist) {
      best = coord;
      bestDist = dist;
    }
  }
  return best;
}

/** Issue #78: a race with no Affinity for `world.home`'s own Human City (today, only Orc/Ogre --
 * see `RACE_AFFINITY`) can never stand there, and -- since `canTravelTo()` only checks a *
 * destination* hex's Affinity, never blocking leaving one -- would permanently lose access to it
 * (or any other Human city) the moment they stepped off it. `App.tsx`'s `handleCharacterCreated`
 * calls this instead of resetting straight to `world.home` whenever that's the case.
 *
 * Searches the already-revealed map first -- the same "the physical map, once generated, is
 * permanent" precedent every other World system already relies on (dungeons, buildings, political
 * status) -- placing the new character directly at an existing compatible city rather than
 * generating a redundant one. Only if nothing qualifies yet does it generate new territory,
 * outward, ring by ring, reusing the existing `revealNeighborsInPlace()` primitive on every
 * currently-known hex each pass. `MAX_HOME_SEARCH_RINGS` is a safety net against a pathological RNG
 * sequence never rolling a matching City/Fortress -- `LOCATION_TABLE`'s own row distribution puts an
 * Orc/Goblin location on a sizeable fraction of "has a location" rolls, so a match should turn up
 * within the first 1-3 rings almost always; this should never actually be reached, and falls back
 * to `world.home` itself rather than looping forever if it somehow is. */
export function findOrRevealCompatibleHome(
  world: WorldState,
  raceName: string,
  rng: RNG = Math.random,
): { world: WorldState; coord: HexCoord } {
  const existing = findCompatibleCity(world.tiles, world.home, raceName);
  if (existing) return { world, coord: existing };

  const MAX_HOME_SEARCH_RINGS = 20;
  const tiles: Record<string, HexTile> = { ...world.tiles };
  for (let ring = 0; ring < MAX_HOME_SEARCH_RINGS; ring++) {
    for (const coord of Object.keys(tiles).map(parseHexKey)) {
      revealNeighborsInPlace(tiles, coord, world.climate, rng, world.plainsRevealAsWater);
    }
    const found = findCompatibleCity(tiles, world.home, raceName);
    if (found) return { world: { ...world, tiles }, coord: found };
  }
  return { world: { ...world, tiles }, coord: world.home };
}

/** The player starts on a human city on a plain (fixed, not rolled -- "Choose a hex to start with
 * ... it will be a human city on a plain"), with its 6 neighbors already revealed so there's
 * somewhere to go without a wasted first move. Its name ("Haven") is likewise fixed rather than
 * rolled via `rollCityName()`, same "fixed, not rolled" precedent as its terrain/location -- rolling
 * it would also shift every existing `rng` fixture's die sequence by two for no rules-driven reason
 * (the rulebook doesn't roll a name for the starting hex either). */
export function createInitialWorldState(rng: RNG = Math.random): WorldState {
  const home: HexCoord = { q: 0, r: 0 };
  const climate: Climate = "hot";
  const tiles: Record<string, HexTile> = {
    [hexKey(home)]: { terrain: "plain", location: "humanCity", name: "Haven" },
  };
  revealNeighborsInPlace(tiles, home, climate, rng);
  return { climate, home, player: home, tiles, hasBoat: false, bannedHexes: [] };
}
