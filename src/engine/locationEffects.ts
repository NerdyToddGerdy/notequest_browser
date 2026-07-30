import { LOCATION_EFFECTS, type LocationEffect } from "../data/locationEffects.ts";
import type { LocationKind } from "../data/hexTables.ts";
import { rollDie } from "./dice.ts";
import type { RNG } from "./rng.ts";
import type { AdventurerResources } from "./town.ts";

/** Location entry effects (issue #98). Its own module for the same reason `events.ts` is: an outcome
 * can spend provisions, heal, or kill the character, so it belongs neither to `hexReducer` (which
 * owns the map, not the adventurer) nor to `town.ts` (which owns neither arrival nor death). */

export interface LocationEffectResult {
  resources: AdventurerResources;
  /** Thin Ice's roll of 1 -- the caller writes the Graveyard entry and clears the session. */
  died: boolean;
  /** The die that was rolled, so the UI can animate the actual value. */
  roll: number;
  message: string;
  /** Reef's 3-or-more: an Underwater Cave is *there*, but it's a distinct #30 dungeon type that
   * doesn't exist yet. Flagged rather than silently dropped so the panel can say so -- substituting
   * some other dungeon would be a worse lie than admitting the cave isn't enterable. */
  foundUnbuiltCave: boolean;
}

export function effectForLocation(location: LocationKind | null): LocationEffect | null {
  return (location && LOCATION_EFFECTS[location]) || null;
}

export function resolveLocationEffect(
  effect: LocationEffect,
  resources: AdventurerResources,
  rng: RNG = Math.random,
): LocationEffectResult {
  const roll = rollDie(rng);
  const base = { resources, died: false, roll, foundUnbuiltCave: false };

  switch (effect.kind) {
    case "oasis":
      // "If 4 or less, it was a mirage. If 5 or 6, you found an Oasis (recover all lost HP)."
      return roll >= 5
        ? {
            ...base,
            resources: { ...resources, hp: resources.maxHp },
            message: "Real water, and shade. You drink your fill and feel whole again.",
          }
        : { ...base, message: "Heat shimmer and nothing else. The water was never there." };

    case "thinIce":
      // "If 1 you fell into the freezing water and died." No survival floor and no saving roll --
      // the rulebook is explicit, the same way Magma's 6d6 is (issue #105).
      return roll === 1
        ? { ...base, died: true, message: "The ice gives out beneath you." }
        : { ...base, message: "It creaks the whole way across, and holds." };

    case "reef": {
      // "If 1, your ship ran aground (lose 1 provision). If 3 or more you found an Underwater Cave."
      // A 2 is the rulebook's own gap: nothing happens.
      if (roll === 1) {
        const lost = Math.min(1, resources.provisions);
        return {
          ...base,
          resources: { ...resources, provisions: resources.provisions - lost },
          message: lost
            ? "Your hull grinds on coral — you lose a provision to the water."
            : "Your hull grinds on coral, but you had nothing left to lose.",
        };
      }
      if (roll >= 3) {
        return {
          ...base,
          foundUnbuiltCave: true,
          message:
            "Below the coral, a flooded cave mouth — an Underwater Cave, though you can find no way in.",
        };
      }
      return { ...base, message: "Shallow water and sharp coral. You pick your way through." };
    }
  }
}
