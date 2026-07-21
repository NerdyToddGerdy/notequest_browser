import type { CityCulture } from "../data/affinity.ts";
import { hirelingsFor } from "../data/hirelings.ts";
import { grantSpellUses } from "./advancedClasses.ts";
import type { AdventurerResources } from "./town.ts";
import type { RNG } from "./rng.ts";

/** Hirelings (Expanded World, issue #25) -- paid companions hired in a City/Fortress "to face just
 * one dungeon" (see CLAUDE.md's Hirelings note for exactly how the per-trip expiry is threaded
 * through `DungeonState`/`AdventurerResources`). Mirrors `advancedClasses.ts`'s precedent of a
 * self-contained engine module rather than folding a large system into `town.ts` directly. */

/** Hiring a new Hireling always replaces whichever one is currently employed (no separate "dismiss"
 * action, no refund) -- so the only gate is being in the roster and being able to afford it. */
export function canHireHireling(
  resources: AdventurerResources,
  name: string,
  culture: CityCulture | null,
  isFortress: boolean,
): boolean {
  const roster = hirelingsFor(culture, isFortress);
  const def = roster.find((h) => h.name === name);
  if (!def) return false;
  return resources.coins >= def.cost;
}

/** Applies whichever Hireling ability is mechanically real today (see CLAUDE.md's Hirelings note
 * for the full list) -- every other one either has no ability ("None.") or is left flavor-only
 * (Torchbearer, Jester, Elf Ranger, Cargo Ogre, Goblin Helper), so falls through untouched. Burglar
 * (no-torch lock-picking), Minstrel (+2 combat damage), and Dwarf Soldier (+1 vs. Orcs/Goblins) are
 * checked directly against `DungeonState.hireling`/`resources.hireling` at their own use sites
 * (`dungeonReducer.ts`'s `attackBonus()`/`RESOLVE_DOOR_LOCK`, `RoomInspector.tsx`) rather than here,
 * since they're passive checks, not one-time grants applied at hire time. */
function applyHirelingAbility(name: string, resources: AdventurerResources, rng: RNG): AdventurerResources {
  switch (name) {
    case "Rent Wizard":
      return grantSpellUses(resources, "basic", 4, rng);
    case "Elf Soldier":
      return grantSpellUses(resources, "basic", 3, rng);
    case "Gnome Helper":
      return grantSpellUses(resources, "basic", 4, rng);
    default:
      return resources;
  }
}

/** Spends the coin cost, replaces whoever's currently hired (if anyone) with `name`, then applies
 * whichever spell-grant ability above is mechanically real -- granted once, permanently, at hire
 * time (the same simplification `advancedClasses.ts`'s spell grants already made, since
 * `spellUses` has no source-tracking to revoke from cleanly once the Hireling's trip expires).
 * Returns the resources unchanged if `canHireHireling()` would reject it. */
export function hireHireling(
  resources: AdventurerResources,
  name: string,
  culture: CityCulture | null,
  isFortress: boolean,
  rng: RNG = Math.random,
): AdventurerResources {
  if (!canHireHireling(resources, name, culture, isFortress)) return resources;
  const roster = hirelingsFor(culture, isFortress);
  const def = roster.find((h) => h.name === name)!;
  const withHire: AdventurerResources = {
    ...resources,
    coins: resources.coins - def.cost,
    hireling: name,
  };
  return applyHirelingAbility(name, withHire, rng);
}
