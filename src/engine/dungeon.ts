import { SEGMENTS_TABLE, type DungeonTypeKey, type SegmentType } from "../data/dungeonTypes.ts";
import { DUNGEON_TABLES, type MonsterTemplate, type RoomContentEntry } from "../data/dungeonTables.ts";
import type { Box, Direction, DungeonState, LevelState, SegmentState } from "./dungeonState.ts";
import { rollDie } from "./dice.ts";
import type { RNG } from "./rng.ts";

export const UNIT = 20;
export const CONNECTOR_LEN = 2 * UNIT;
export const CONNECTOR_THICK = 14;
export const MARGIN = 10;

export const DIR_VEC: Record<Direction, { x: number; y: number }> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};
export const OPPOSITE: Record<Direction, Direction> = { N: "S", S: "N", E: "W", W: "E" };
const LEFT_OF: Record<Direction, Direction> = { N: "W", W: "S", S: "E", E: "N" };
const RIGHT_OF: Record<Direction, Direction> = { N: "E", E: "S", S: "W", W: "N" };

export function assignDirections(cameFromDir: Direction | null, count: number): Direction[] {
  const pool: Direction[] =
    cameFromDir === null ? ["E", "S", "N", "W"] : [cameFromDir, LEFT_OF[cameFromDir], RIGHT_OF[cameFromDir]];
  return pool.slice(0, count);
}

export function sizeFor(type: SegmentType, dir: Direction | null): { w: number; h: number } {
  switch (type) {
    case "room-small":
      return { w: 4 * UNIT, h: 4 * UNIT };
    case "room-medium":
      return { w: 5 * UNIT, h: 5 * UNIT };
    case "room-wide":
      return { w: 7 * UNIT, h: 4 * UNIT };
    case "room-large":
      return { w: 8 * UNIT, h: 6 * UNIT };
    case "staircase":
      return { w: 4 * UNIT, h: 4 * UNIT };
    case "final":
      return { w: 9 * UNIT, h: 7 * UNIT };
    case "corridor":
      return dir === "E" || dir === "W" ? { w: 7 * UNIT, h: 3 * UNIT } : { w: 3 * UNIT, h: 7 * UNIT };
  }
}

export function boxFromCenter(cx: number, cy: number, size: { w: number; h: number }): Box {
  return { x: cx - size.w / 2, y: cy - size.h / 2, w: size.w, h: size.h, cx, cy };
}

export function boxesOverlap(a: Box, b: Box, margin: number): boolean {
  return !(
    a.x + a.w + margin <= b.x ||
    b.x + b.w + margin <= a.x ||
    a.y + a.h + margin <= b.y ||
    b.y + b.h + margin <= a.y
  );
}

export function collidesInList(box: Box, list: Box[], margin: number): boolean {
  return list.some((other) => boxesOverlap(box, other, margin));
}

export function edgePoint(box: Box, dir: Direction): { x: number; y: number } {
  switch (dir) {
    case "E":
      return { x: box.x + box.w, y: box.cy };
    case "W":
      return { x: box.x, y: box.cy };
    case "S":
      return { x: box.cx, y: box.y + box.h };
    case "N":
      return { x: box.cx, y: box.y };
  }
}

/** Places a new segment adjacent to `parent` in direction `dir`, extending the gap until it clears every existing box. */
export function placeChild(parent: Box, dir: Direction, childType: SegmentType, existing: Box[]): Box {
  const size = sizeFor(childType, dir);
  const vec = DIR_VEC[dir];
  const parentHalf = dir === "E" || dir === "W" ? parent.w / 2 : parent.h / 2;
  const childHalf = dir === "E" || dir === "W" ? size.w / 2 : size.h / 2;
  let gap = CONNECTOR_LEN;
  let box: Box = boxFromCenter(0, 0, size);
  for (let attempt = 0; attempt < 24; attempt++) {
    const offset = parentHalf + gap + childHalf;
    const cx = parent.cx + vec.x * offset;
    const cy = parent.cy + vec.y * offset;
    box = boxFromCenter(cx, cy, size);
    if (!collidesInList(box, existing, MARGIN)) break;
    gap += UNIT;
  }
  return box;
}

export function buildConnector(
  parentBox: Box,
  dir: Direction,
  childBox: Box,
): { x: number; y: number; w: number; h: number; horiz: boolean } {
  const p1 = edgePoint(parentBox, dir);
  const p2 = edgePoint(childBox, OPPOSITE[dir]);
  const horiz = dir === "E" || dir === "W";
  if (horiz) {
    const x = Math.min(p1.x, p2.x);
    const w = Math.abs(p2.x - p1.x);
    return { x, y: p1.y - CONNECTOR_THICK / 2, w, h: CONNECTOR_THICK, horiz: true };
  }
  const y = Math.min(p1.y, p2.y);
  const h = Math.abs(p2.y - p1.y);
  return { x: p1.x - CONNECTOR_THICK / 2, y, w: CONNECTOR_THICK, h, horiz: false };
}

export type SegmentsColumn = "staircase" | "corridor" | "room";

export function columnFor(type: SegmentType): SegmentsColumn {
  if (type === "staircase") return "staircase";
  if (type === "corridor") return "corridor";
  return "room";
}

export function rollSegment(fromType: SegmentType, roll: number) {
  const row = SEGMENTS_TABLE[roll];
  if (!row) throw new Error(`No Segments row for roll ${roll}`);
  return row[columnFor(fromType)];
}

/** Rolls Room Content + Monsters for a newly-created Room segment; no-op (undefined) for non-room types.
 * `isEntrance`: a deliberate design/balance call (not from the rulebook, which says nothing about the
 * entrance specifically) -- the very first room the player steps into, before any doors have been
 * opened or choices made, shouldn't be able to ambush them. Still rolls the Monsters dice (keeping
 * this call's RNG consumption identical to every other room, so it doesn't shift the roll sequence
 * for whatever's built next) but discards the result. Room Content still applies normally. */
export function resolveRoomExtras(
  type: SegmentType,
  dungeonKey: DungeonTypeKey,
  rng: RNG = Math.random,
  isEntrance = false,
): { roomContent: RoomContentEntry; monsters: MonsterTemplate | null } | undefined {
  if (!type.startsWith("room-")) return undefined;
  const tables = DUNGEON_TABLES[dungeonKey];
  const contentSum = rollDie(rng) + rollDie(rng);
  const monsterSum = rollDie(rng) + rollDie(rng);
  const roomContent = tables.roomContent[contentSum];
  if (!roomContent) {
    throw new Error(`Missing Room Content entry for ${dungeonKey} sum=${contentSum}`);
  }
  const monsters = isEntrance ? null : (tables.monsters[monsterSum] ?? null);
  return { roomContent, monsters };
}

/** Rolls the Dungeon Boss (1d6) for a newly-placed Final Room -- no Content or Monsters roll, per the rulebook. */
export function resolveBoss(dungeonKey: DungeonTypeKey, rng: RNG = Math.random): MonsterTemplate {
  const roll = rollDie(rng);
  const boss = DUNGEON_TABLES[dungeonKey].boss[roll];
  if (!boss) throw new Error(`Missing Boss entry for ${dungeonKey} roll=${roll}`);
  return boss;
}

export type DoorOpenClassification =
  | { kind: "normal" }
  | { kind: "descend-normal" }
  | { kind: "descend-final" }
  | { kind: "dead-end-final" }
  | { kind: "reuse-final"; targetLevel: number }
  | { kind: "reuse-normal"; targetLevel: number };

/**
 * Determines how opening a given door should resolve, without needing a die roll.
 * The UI consults this to decide whether to animate a roll at all (only "normal" and
 * "descend-normal" need one -- "reuse-normal" just links to the target level's own
 * existing entrance, same as "reuse-final" already does, see DungeonMap's AUTOMATIC_KINDS);
 * the reducer re-derives the same classification when applying OPEN_DOOR so there is one
 * source of truth.
 */
export function classifyDoorOpen(
  state: DungeonState,
  segId: number,
  doorIdx: number,
): DoorOpenClassification {
  const level = state.levels[state.activeLevel];
  if (!level) throw new Error("No active level");
  const seg = level.segments.find((s) => s.id === segId);
  if (!seg) throw new Error(`Segment ${segId} not found on active level`);
  const door = seg.doors[doorIdx];
  if (!door) throw new Error(`Door ${doorIdx} not found on segment ${segId}`);

  // A staircase-type entrance (Crypt/Sanctuary/Prison) represents arriving at this level,
  // not a way down from it -- only a staircase segment *found while exploring* is a real
  // descent. Without this, the very first door of those dungeon types would skip level 1
  // entirely and jump straight to level 2.
  const isEntranceStaircase = seg.type === "staircase" && seg.isEntrance;
  const isDescent = seg.type === "staircase" && !seg.isEntrance;

  if (isDescent && level.stairwayTarget != null) {
    const targetLevel = level.stairwayTarget;
    const target = state.levels[targetLevel];
    if (!target) throw new Error(`Target level ${targetLevel} not found`);
    return target.isFinalRoomLevel
      ? { kind: "reuse-final", targetLevel }
      : { kind: "reuse-normal", targetLevel };
  }
  if (isDescent && level.depth + 1 >= 3) return { kind: "descend-final" };
  if (isDescent) return { kind: "descend-normal" };

  const triggersDeadEnd =
    !isEntranceStaircase && !level.finalRoomPlaced && level.doorsRemaining === 1 && !level.hasStaircase;
  return triggersDeadEnd ? { kind: "dead-end-final" } : { kind: "normal" };
}

/** The player's current segment plus every segment directly connected to it by an already-opened
 * door, within this one level -- the "fog of war" boundary for what's interactive right now (see
 * CLAUDE.md's Positional movement section). A door only records its parent -> child link
 * (`childId`), so this walks every segment's doors once to build the link in both directions. A
 * door's `childId` crossing to a different level (a staircase) never matches anything in this
 * level's own segment list, so cross-level links are harmless noise here, not a correctness bug --
 * level transitions are handled separately by whichever action crosses them, updating
 * `currentSegId` directly rather than through this adjacency walk. */
export function reachableSegIds(level: Pick<LevelState, "segments">, currentSegId: number | null): Set<number> {
  const reachable = new Set<number>();
  if (currentSegId == null) return reachable;
  reachable.add(currentSegId);
  for (const seg of level.segments) {
    for (const door of seg.doors) {
      if (!door.opened || door.childId == null) continue;
      if (seg.id === currentSegId) reachable.add(door.childId);
      else if (door.childId === currentSegId) reachable.add(seg.id);
    }
  }
  return reachable;
}

/** Teleport ("You teleport to any empty room") ignores fog-of-war -- unlike `reachableSegIds`, a
 * destination can be any already-discovered room, on any level, not just one adjacent to where the
 * player currently stands. "Room" excludes corridors/staircases (not a "room" per the rulebook's own
 * wording); "empty" excludes a room whose monsters are undefeated and haven't been avoided via a
 * successful Move Silently (a `sneakedPast` room's monsters are still there, just not yet noticing),
 * and also a room flagged `needsMonsterReroll` (see `restoreMapFromPersisted()`) -- it looks empty
 * here, but CAST_SPELL's Teleport case calls `rerollMonstersIfNeeded()` the instant the player
 * arrives, which is exactly what fires that flag's fresh encounter roll and can start a brand-new
 * fight right where they just fled to. */
export function isTeleportDestination(seg: SegmentState, excludeSegId: number): boolean {
  if (seg.id === excludeSegId) return false;
  if (seg.type === "corridor" || seg.type === "staircase") return false;
  if (seg.sneakedPast) return false;
  if (seg.monsters && !seg.monstersDefeated) return false;
  if (seg.needsMonsterReroll) return false;
  return true;
}
