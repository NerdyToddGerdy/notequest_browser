import { produce } from "immer";
import { CITY_OR_FORTRESS, isImpassable } from "../data/hexTables.ts";
import { hasAffinity } from "../data/affinity.ts";
import {
  findAskedDungeonHex,
  hexKey,
  hexNeighbors,
  revealNeighborsInPlace,
  withDungeonMarked,
  type HexCoord,
  type WorldState,
} from "./hexState.ts";
import type { RNG } from "./rng.ts";

export type HexAction =
  | { type: "MOVE"; to: HexCoord; raceName: string }
  | { type: "HIRE_BOAT" }
  | { type: "ASK_FOR_DUNGEON" };

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
      if (!targetTile) return state;
      if (isImpassable(targetTile.terrain, targetTile.location, state.hasBoat)) return state;
      if (!hasAffinity(action.raceName, targetTile.location)) return state;

      return produce(state, (draft) => {
        draft.player = action.to;
        // "Once you enter non-water terrain you leave the boat" -- fires every landing, harmless
        // no-op if hasBoat was already false.
        if (targetTile.terrain !== "water") draft.hasBoat = false;
        revealNeighborsInPlace(draft.tiles, action.to, draft.climate, rng);
      });
    }
    case "HIRE_BOAT": {
      // "If you are in a city or fortress beside a water terrain" -- the reducer is the actual
      // authority here (same precedent as dungeonReducer.ts's door-open guards), not just the UI
      // deciding whether to show the button.
      const currentTile = state.tiles[hexKey(state.player)];
      if (!currentTile?.location || !CITY_OR_FORTRESS.has(currentTile.location)) return state;
      const besideWater = hexNeighbors(state.player).some((n) => state.tiles[hexKey(n)]?.terrain === "water");
      if (!besideWater) return state;
      return produce(state, (draft) => {
        draft.hasBoat = true;
      });
    }
    case "ASK_FOR_DUNGEON": {
      // "Ask" (rulebook p.29) -- same City/Fortress-only authority pattern as HIRE_BOAT. A no-op
      // if a neighbor already has one ("if you don't already have a dungeon in any adjacent hex,
      // roll 1d6") or if the should-be-impossible no-qualifying-neighbor case comes back null.
      const currentTile = state.tiles[hexKey(state.player)];
      if (!currentTile?.location || !CITY_OR_FORTRESS.has(currentTile.location)) return state;
      const alreadyKnown = hexNeighbors(state.player).some((n) => {
        const t = state.tiles[hexKey(n)];
        return !!t?.dungeonRunId || !!t?.dungeonMarked;
      });
      if (alreadyKnown) return state;
      const found = findAskedDungeonHex(state, state.player, rng);
      if (!found) return state;
      return withDungeonMarked(state, found);
    }
    default:
      return state;
  }
}
