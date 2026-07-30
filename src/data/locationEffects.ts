import type { LocationKind } from "./hexTables.ts";

/** "Locations" (`docs/game-rules-reference.md` lines 898-907, issue #98) -- what arriving at a
 * special hex actually does. City/Fortress/Ruins/Rocks/Portal all had real behavior already; these
 * four were rendered as labels and nothing more.
 *
 * Fires on arrival, and is mutually exclusive with Events on Travel (#91) by construction: an Event
 * only rolls on a hex with *no* location, and every one of these has one.
 */
export type LocationEffect =
  /** "Oasis: Roll 1d6. If 4 or less, it was a mirage. If 5 or 6, you found an Oasis (recover all
   * lost HP)." */
  | { kind: "oasis" }
  /** "Thin Ice: Upon entering this hex, roll 1d6. If 1 you fell into the freezing water and died."
   * Only generates on cold terrain, so it was doubly unreachable until #101 made climate selectable. */
  | { kind: "thinIce" }
  /** "Reef: Upon entering, roll 1d6. If 1, your ship ran aground (lose 1 provision). If 3 or more you
   * found an Underwater Cave." A 2 does nothing -- the rulebook simply leaves that gap. */
  | { kind: "reef" };

/** Only these three have an entry roll. **Volcano** is deliberately absent: its entire content is
 * "Has a Volcanic Cave," a distinct #30 dungeon type, so there is nothing to roll for and nothing
 * honest to substitute -- see `LOCATION_EFFECT_NOTES`. */
export const LOCATION_EFFECTS: Partial<Record<LocationKind, LocationEffect>> = {
  oasis: { kind: "oasis" },
  thinIce: { kind: "thinIce" },
  reef: { kind: "reef" },
};

/** Read-only flavor for a location whose only rulebook content is a dungeon type #30 hasn't built.
 * Shown in `HexInspector` so the hex isn't silently empty -- the player is told what's there and why
 * they can't go in, rather than the label just sitting inert with no explanation. */
export const LOCATION_EFFECT_NOTES: Partial<Record<LocationKind, string>> = {
  volcano: "A Volcanic Cave opens somewhere in the crater — but no way down has been found yet.",
};
