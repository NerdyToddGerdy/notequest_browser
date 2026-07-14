import { DIR_VEC, edgePoint } from "../../../engine/dungeon.ts";
import type { LevelState } from "../../../engine/dungeonState.ts";

const PAD = 44;
const MARKER_OFFSET = 22;
const MARKER_HALF = 14;
/** Floor for the canvas's width/height so a single starting segment (up to the Final Room's
 * 180x140, the largest) still gets some comfortable breathing room -- deliberately not much
 * bigger than that, since dungeons branch unpredictably in any direction and a large fixed
 * minimum (previously 320) left a lot of dead space around anything smaller/narrower than a
 * perfect square. */
const MIN_SIZE = 240;

export interface MapLayout {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/** Bounding box (in the map's own coordinate space) covering every segment plus any door/descent markers. */
export function computeMapLayout(level: Pick<LevelState, "segments">): MapLayout {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const seg of level.segments) {
    minX = Math.min(minX, seg.x);
    minY = Math.min(minY, seg.y);
    maxX = Math.max(maxX, seg.x + seg.w);
    maxY = Math.max(maxY, seg.y + seg.h);
  }

  for (const seg of level.segments) {
    for (const door of seg.doors) {
      if (door.opened && door.leadsToLevel == null) continue;
      const pt = edgePoint(seg, door.dir);
      const vec = DIR_VEC[door.dir];
      const mx = pt.x + vec.x * MARKER_OFFSET;
      const my = pt.y + vec.y * MARKER_OFFSET;
      minX = Math.min(minX, mx - MARKER_HALF);
      minY = Math.min(minY, my - MARKER_HALF);
      maxX = Math.max(maxX, mx + MARKER_HALF);
      maxY = Math.max(maxY, my + MARKER_HALF);
    }
  }

  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }

  return {
    originX: minX - PAD,
    originY: minY - PAD,
    width: Math.max(maxX - minX + PAD * 2, MIN_SIZE),
    height: Math.max(maxY - minY + PAD * 2, MIN_SIZE),
  };
}
