import { produce } from "immer";
import { isImpassable } from "../data/hexTables.ts";
import { hexKey, hexNeighbors, revealNeighborsInPlace, type HexCoord, type WorldState } from "./hexState.ts";
import type { RNG } from "./rng.ts";

export type HexAction = { type: "MOVE"; to: HexCoord };

/** Not an extension of `dungeonReducer.ts` -- a different persisted lifetime (one map that
 * outlives every dungeon run, vs. one DungeonState per run), a different action vocabulary, and no
 * combat. Kept as its own small state machine instead of growing dungeonReducer.ts (already the
 * largest file) a second, unrelated one. */
export function hexReducer(state: WorldState, action: HexAction, rng: RNG = Math.random): WorldState {
  switch (action.type) {
    case "MOVE": {
      // Trusts the UI to only ever offer a reachable, passable neighbor (same pattern
      // dungeonReducer.ts uses elsewhere) but no-ops defensively on a stray/invalid dispatch
      // rather than throwing.
      const isNeighbor = hexNeighbors(state.player).some((n) => hexKey(n) === hexKey(action.to));
      if (!isNeighbor) return state;
      const targetTile = state.tiles[hexKey(action.to)];
      if (!targetTile || isImpassable(targetTile.terrain, targetTile.location)) return state;

      return produce(state, (draft) => {
        draft.player = action.to;
        revealNeighborsInPlace(draft.tiles, action.to, draft.climate, rng);
      });
    }
    default:
      return state;
  }
}
