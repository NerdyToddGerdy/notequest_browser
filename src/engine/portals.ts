import { OTHER_WORLD_LABELS, PORTAL_TABLE, type PortalOutcome, type PortalRow } from "../data/portals.ts";
import { rollDie } from "./dice.ts";
import {
  findNearestTown,
  hexKey,
  withAllCitiesRazed,
  withNewReality,
  withPlayerMovedTo,
  type HexCoord,
  type WorldState,
} from "./hexState.ts";
import type { RNG } from "./rng.ts";
import type { AdventurerResources } from "./town.ts";

/** "Portals" (issue #21, rules 1091-1116) -- stepping through a portal hex and resolving the 3d6
 * "Going through the Portal" table. Its own engine module for the same reason `events.ts` is: an
 * outcome can rewrite `WorldState` wholesale, move the player, credit coins, send them into a
 * dungeon, or end the character, so no single existing reducer owns it.
 *
 * **Stage 1**: the 12 outcomes resolvable on one map. The six Other-World rows are authored in
 * `PORTAL_TABLE` but re-rolled here (see `rollPortal`), pending issue #21 stage 2's multi-map model.
 */

/** How many times `rollPortal` will re-roll an Other-World row before giving up. Six of sixteen rows
 * are Other Worlds, so the chance of exhausting this is about (6/16)^12 -- vanishingly small, but a
 * bound beats a `while (true)`. */
const MAX_REROLLS = 12;

export interface PortalRoll {
  /** The 3d6 total finally settled on -- the value persisted to `HexTile.portalTotal`. */
  total: number;
  /** The three raw dice of the *settled* roll, for the UI to animate. */
  dice: [number, number, number];
  row: PortalRow;
  /** Non-empty when Other-World rows were rolled and re-rolled past, so the panel can say so rather
   * than silently swallowing them. Stage 2 will make this always empty. */
  skippedWorlds: string[];
}

function roll3d6(rng: RNG): { total: number; dice: [number, number, number] } {
  const dice: [number, number, number] = [rollDie(rng), rollDie(rng), rollDie(rng)];
  return { total: dice[0] + dice[1] + dice[2], dice };
}

/** Rolls a fresh portal destination, re-rolling any Other-World row (stage 1 only). Falls back to
 * the nearest-town row if every attempt somehow lands on a world -- a safe outcome that always
 * resolves, rather than throwing in the player's face. */
export function rollPortal(rng: RNG = Math.random): PortalRoll {
  const skippedWorlds: string[] = [];
  for (let attempt = 0; attempt <= MAX_REROLLS; attempt++) {
    const { total, dice } = roll3d6(rng);
    const row = PORTAL_TABLE[total]!;
    if (row.outcome.kind === "otherWorld") {
      skippedWorlds.push(OTHER_WORLD_LABELS[row.outcome.world]);
      continue;
    }
    return { total, dice, row, skippedWorlds };
  }
  return { total: 9, dice: [3, 3, 3], row: PORTAL_TABLE[9]!, skippedWorlds };
}

/** Reads an already-established portal instead of rolling ("once you've established where a portal
 * leads, you don't need to roll again for it"). A remembered total is always a stage-1-resolvable
 * one, since `rollPortal` never settles on an Other-World row -- so this can't resurrect a row stage
 * 1 has no handler for. */
export function establishedPortal(total: number): PortalRoll | null {
  const row = PORTAL_TABLE[total];
  if (!row || row.outcome.kind === "otherWorld") return null;
  return { total, dice: [0, 0, 0], row, skippedWorlds: [] };
}

export interface PortalResolution {
  resources: AdventurerResources;
  world: WorldState;
  /** Roll 3 -- the caller writes the Graveyard entry and clears the session. */
  died: boolean;
  /** Roll 11/14 -- the caller must show a destination picker; nothing has moved yet. */
  awaitDestination: boolean;
  /** Roll 7 -- the caller must send the player into a fresh, exit-less dungeon. */
  enterNoExitDungeon: boolean;
  /** Roll 15 -- the coins are credited and a *second* portal must be rolled, since a doorless golden
   * room offers no other way out. */
  chainAnotherPortal: boolean;
  /** What actually happened, appended to the row's own text by the panel. */
  message: string;
}

function unchanged(
  resources: AdventurerResources,
  world: WorldState,
  message: string,
): PortalResolution {
  return {
    resources,
    world,
    died: false,
    awaitDestination: false,
    enterNoExitDungeon: false,
    chainAnotherPortal: false,
    message,
  };
}

/**
 * Applies a settled portal outcome. `from` is the portal hex itself, needed by the nearest-town rolls
 * (which measure distance from where the player stepped in) -- note the player is still standing
 * there when this is called; nothing has moved yet.
 *
 * Deliberately does *not* stamp `HexTile.portalTotal` -- the caller does that, because a
 * `newMap`/`futureRuins` outcome replaces or rewrites the very tiles this would be writing into, and
 * ordering that here would mean either stamping a tile about to be discarded or special-casing two
 * outcomes. See `WorldScreen.tsx`'s `handlePortalResolve`.
 */
export function resolvePortalOutcome(
  outcome: PortalOutcome,
  resources: AdventurerResources,
  world: WorldState,
  from: HexCoord,
  rng: RNG = Math.random,
): PortalResolution {
  switch (outcome.kind) {
    case "vanish":
      return { ...unchanged(resources, world, ""), died: true };

    case "futureRuins":
      return unchanged(resources, withAllCitiesRazed(world), "Every city you knew is a ruin now.");

    case "noExitDungeon":
      return { ...unchanged(resources, world, ""), enterNoExitDungeon: true };

    case "nearestTown":
    case "nearestHumanCity": {
      const dest = findNearestTown(world, from, outcome.kind === "nearestHumanCity");
      if (!dest) {
        // Nothing qualifies on the revealed map yet -- the portal simply fails to find a destination
        // rather than stranding the player or inventing a city out of nowhere.
        return unchanged(
          resources,
          world,
          outcome.kind === "nearestHumanCity"
            ? "But you know of no human city, and the portal spits you back out where you stood."
            : "But you know of no town at all, and the portal spits you back out where you stood.",
        );
      }
      const name = world.tiles[hexKey(dest)]?.name;
      return unchanged(
        resources,
        withPlayerMovedTo(world, dest, rng),
        name ? `You step out in ${name}.` : "You step out among strangers.",
      );
    }

    case "chooseAnyHex":
    case "slimemenCity":
      return { ...unchanged(resources, world, ""), awaitDestination: true };

    case "newMap":
      return unchanged(resources, withNewReality(world, rng), "Nothing here is familiar.");

    case "plainsBecomeWater":
      return unchanged(
        resources,
        { ...world, plainsRevealAsWater: true },
        "The ground looks no different — but the water is coming.",
      );

    case "goldenRoom":
      return {
        ...unchanged(resources, world, `You gather ${outcome.coins} coins and face the second portal.`),
        resources: { ...resources, coins: resources.coins + outcome.coins },
        chainAnotherPortal: true,
      };

    case "otherWorld":
      // Unreachable in stage 1 -- `rollPortal`/`establishedPortal` both filter these out. Kept as a
      // real branch (rather than an exhaustiveness `never`) so stage 2 has one obvious place to fill in.
      return unchanged(resources, world, "The portal refuses to take you there.");
  }
}

/** Roll 11/14's destination picker: every revealed hex the player could legally be standing in.
 * "You go to whatever hexagon you want" is bounded to known geography for the same reason
 * `findNearestTown` is -- you can't choose a hex that doesn't exist yet. Impassable terrain is
 * excluded (a portal doesn't let you stand inside Rocks), but a banned hex deliberately *is* allowed:
 * the Thug Life ban is about being turned away at the gate, and arriving by portal isn't that. */
export function portalDestinations(world: WorldState, isImpassableAt: (key: string) => boolean): HexCoord[] {
  return Object.keys(world.tiles)
    .filter((key) => key !== hexKey(world.player) && !isImpassableAt(key))
    .map((key) => {
      const [q, r] = key.split(",").map(Number);
      return { q: q!, r: r! };
    });
}
