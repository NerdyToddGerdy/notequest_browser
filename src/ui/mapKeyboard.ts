/**
 * Issue #143: arrow-key movement around a map whose cells aren't on a square grid (the World's
 * hexes). Each arrow moves to the nearest cell lying in that direction: candidates must sit on the
 * arrow's side of the current cell, and among them the one closest along the arrow's axis wins, with
 * sideways drift weighted double so "right" prefers the hex beside you over one diagonally up-right.
 *
 * Pure, and keyed by whatever id the caller uses, so it has no idea it's looking at hexes.
 */
export type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

export interface MapCell<K> {
  key: K;
  x: number;
  y: number;
}

export function isArrowKey(key: string): key is ArrowKey {
  return key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight";
}

const AXIS: Record<ArrowKey, { x: number; y: number }> = {
  ArrowRight: { x: 1, y: 0 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowDown: { x: 0, y: 1 },
  ArrowUp: { x: 0, y: -1 },
};

/** The cell an arrow press moves to from `fromKey`, or null if nothing lies that way. */
export function nextCellInDirection<K>(
  cells: readonly MapCell<K>[],
  fromKey: K,
  arrow: ArrowKey,
): K | null {
  const from = cells.find((c) => c.key === fromKey);
  if (!from) return null;
  const axis = AXIS[arrow];
  let best: { key: K; score: number } | null = null;
  for (const cell of cells) {
    if (cell.key === fromKey) continue;
    const dx = cell.x - from.x;
    const dy = cell.y - from.y;
    const along = dx * axis.x + dy * axis.y;
    if (along <= 0) continue;
    const across = Math.abs(dx * axis.y - dy * axis.x);
    const score = along + 2 * across;
    if (!best || score < best.score) best = { key: cell.key, score };
  }
  return best?.key ?? null;
}
