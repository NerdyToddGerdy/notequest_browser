import type { Draft } from "immer";

import type { EquippedWeapon, HeldItem } from "./dungeonState.ts";

/**
 * "Your Hands" (`docs/game-rules-reference.md` lines 226-230, issue #100):
 *
 * > When exploring a dungeon, one hand must hold the torch, so you cannot fight with a Two-Handed
 * > weapon without another source of light in place. Losing an arm in a trap has the same effect.
 * > Ways around this: hiring someone to hold the torch (see Hireling), using a lamp, or casting
 * > Light spells.
 *
 * This module is the hand economy that several already-authored things were silently waiting on:
 * `WeaponEntry.twoHanded` (parsed, stored, displayed, never checked), the Dwarf Lamp culture action
 * (a 40-coin sink with nothing to unlock), the Torchbearer Hireling (listed "None." despite the
 * rulebook naming *hiring someone to hold the torch* as workaround #1), and Blade Trap's roll-of-2
 * arm loss (flavor-only for want of exactly this).
 *
 * It's its own module rather than part of `fight.ts` for the same reason `events.ts`/`portals.ts`
 * are: the state it reads spans a dungeon run *and* a character between runs, and the enforcement it
 * does (benching a weapon into `spareWeapons`) touches fields the `Fighter` seam deliberately
 * doesn't carry.
 */

/** The character-side state the hand economy reads -- satisfied structurally by both `DungeonState`
 * and `AdventurerResources`, exactly like `fight.ts`'s own `Fighter` seam, so nothing here knows
 * which of the two it's holding. `armLost`/`lightActive` are optional so a save written before
 * issue #100 reads as "both arms, no globe" rather than crashing. */
export interface HandBearer {
  heldItems: HeldItem[];
  hireling: string | null;
  weapon: EquippedWeapon | null;
  spareWeapons: EquippedWeapon[];
  /** Permanent, and an absolute veto: Blade Trap's roll-of-2. "Losing an arm has the same effect"
   * as holding the torch -- so a one-armed character with a Lamp still has only one usable hand and
   * still can't two-hand anything. That's why this is checked *before* the light sources below
   * rather than alongside them. */
  armLost?: boolean;
  /** Set by casting Light, cleared the next time a torch is actually spent -- the globe is "worth a
   * torch," so it's used up like the torch it replaces (confirmed with the user as the reading to
   * take, over a whole-run duration). Dungeon-only in practice; nothing sets it in Town. */
  lightActive?: boolean;
}

/** The Dwarf culture action's Lamp -- named here rather than in `town.ts` because both the buy
 * action and this check need it, and the check now has to run against a `DungeonState` too (the
 * Lamp is carried into the dungeon as an ordinary `HeldItem`). */
export const DWARF_LAMP_NAME = "Dwarven Lamp";

/** The Hireling whose whole job this is. "Hiring someone to hold the torch" is the rulebook's own
 * first-listed workaround, and this is that someone -- see `HIRELING_ROSTERS.human`. */
export const TORCHBEARER_NAME = "Torchbearer";

export function ownsLamp(bearer: Pick<HandBearer, "heldItems">): boolean {
  return bearer.heldItems.some((item) => item.name === DWARF_LAMP_NAME);
}

/** True when both hands are available for fighting -- i.e. something other than your own hand is
 * holding the light, and you still have two arms to hold a weapon with. */
export function handsFree(bearer: HandBearer): boolean {
  if (bearer.armLost) return false; // no light source gives an arm back
  return ownsLamp(bearer) || bearer.hireling === TORCHBEARER_NAME || bearer.lightActive === true;
}

export function canWieldWeapon(bearer: HandBearer, weapon: EquippedWeapon): boolean {
  return !weapon.twoHanded || handsFree(bearer);
}

/** Why a two-handed weapon can't be wielded right now, as player-facing copy -- `null` when it can.
 * Shared by the reducer's log line and the disabled Wield button's tooltip so the two can't drift. */
export function twoHandedBlockReason(bearer: HandBearer): string | null {
  if (bearer.armLost) return "You have only one arm -- a two-handed weapon is beyond you.";
  if (handsFree(bearer)) return null;
  return "One hand holds your torch. You need a Lamp, a Torchbearer, or a cast of Light.";
}

/**
 * The single chokepoint for "hands just stopped being free." Benches an equipped two-handed weapon
 * into `spareWeapons` and returns its name (for the caller's own log line), or `null` if there was
 * nothing to bench.
 *
 * This exists because both confirmed design calls need it. Light expiring on the next torch spend
 * means an already-legal weapon can become illegal mid-run; and wielding is unrestricted in Town
 * ("when exploring a dungeon" read literally), which means a two-hander equipped at the shops has to
 * be caught on the way in rather than at the moment it was equipped. Benching rather than dropping
 * reuses issue #48's own answer to the same problem -- a weapon you can't use right now waits in the
 * spare list until you can.
 */
export function benchUnusableWeapon(draft: Draft<HandBearer>): string | null {
  const weapon = draft.weapon;
  if (!weapon?.twoHanded || handsFree(draft)) return null;
  draft.spareWeapons.push(weapon);
  draft.weapon = null;
  return weapon.name;
}
