/**
 * What the character carries during a run: armor pieces, held items, the Pack's capacity, and
 * consumables.
 *
 * Split out of `dungeonReducer.ts` (issue #144), which still owns every action -- these are the
 * helpers its cases share. Behavior is unchanged; only where the code lives moved.
 */
import type { Draft } from "immer";
import type { ArmorPieceKind } from "../../data/dungeonTables.ts";
import { applyConsumableEffect, cannotWearArmor as fightCannotWearArmor } from "../fight.ts";
import type { ArmorPiece, Consumable, DungeonState, HeldItem } from "../dungeonState.ts";
import { MAX_TORCHES, maxHeldItemsFor } from "../town.ts";
import type { RNG } from "../rng.ts";
import { pushLog, dungeonLog } from "./core.ts";

/** Issue #82: "can't use more than one identical piece" -- only these 5 real body slots are
 * subject to it (same list `Collector`'s Advanced Class check already uses,
 * `src/engine/advancedClasses.ts`); `ring` (a documented 0-HP dud, not one of the rulebook's own
 * "5 pieces") and `wonderItem` (an unlimited trinket collection) are exempt. */
export const REAL_ARMOR_SLOTS = new Set<ArmorPieceKind>([
  "bracelets",
  "boots",
  "shoulderpads",
  "helm",
  "breastplate",
]);

/** Adds a found armor piece, benching it into `spareArmor` instead of `armor` if its slot is a
 * real one that's already occupied -- the single chokepoint every armor-granting site now funnels
 * through, replacing what used to be a raw, unconditional `draft.armor.push(...)`. */
export function addArmorPiece(draft: Draft<DungeonState>, piece: ArmorPiece): void {
  if (REAL_ARMOR_SLOTS.has(piece.piece) && draft.armor.some((p) => p.piece === piece.piece)) {
    draft.spareArmor.push(piece);
  } else {
    draft.armor.push(piece);
  }
}

export function addArmorPieces(draft: Draft<DungeonState>, pieces: ArmorPiece[]): void {
  for (const piece of pieces) addArmorPiece(draft, piece);
}

/** Issue #82: the single chokepoint `OPEN_TREASURE`'s `heldValue`/`heldValueRoll` cases funnel
 * through -- pushes normally, or (Pack already at `maxHeldItemsFor(draft.hireling, draft.animals)`,
 * 40 instead of the usual 10 with a Cargo Ogre employed (#63), +1 with a Monkey owned (#67)) sets
 * `pendingPackItem` instead, blocking every other action until RESOLVE_PACK_SWAP settles it.
 * `foundText` is still logged either way (the item was still found), with a note appended when it
 * doesn't fit yet. */
export function addHeldItem(draft: Draft<DungeonState>, item: HeldItem, foundText: string): void {
  if (packIsFull(draft)) {
    draft.pendingPackItem = item;
    pushLog(draft, `${foundText} Your Pack is full -- choose what to do.`);
  } else {
    draft.heldItems.push(item);
    pushLog(draft, foundText);
  }
}

/** Held potions (issue #110) share the Pack's 10 slots with sellables -- the rulebook's own limit is
 * "up to 10 items in your backpack" (rules 200), not ten of each. Counting them together is also what
 * keeps Cargo Ogre's 40 and Monkey's +1 applying to potions for free. */
export function packUsed(draft: Draft<DungeonState>): number {
  return draft.heldItems.length + (draft.consumables?.length ?? 0);
}

export function packIsFull(draft: Draft<DungeonState>): boolean {
  return packUsed(draft) >= maxHeldItemsFor(draft.hireling, draft.animals);
}

/** Stores a potion for later. A full Pack falls back to *using it now* rather than opening the
 * `pendingPackItem` swap prompt: that prompt trades one `HeldItem` for another and has no notion of a
 * consumable, and drinking on the spot is exactly the old behavior -- so an overflowing Pack degrades
 * to what the game did before #110 instead of losing the find. */
export function addConsumable(
  draft: Draft<DungeonState>,
  item: Consumable,
  foundText: string,
  rng: RNG,
): void {
  if (packIsFull(draft)) {
    pushLog(draft, `${foundText} Your Pack is full, so you drink it where you stand.`);
    applyConsumable(draft, item, rng);
    return;
  }
  draft.consumables = [...(draft.consumables ?? []), item];
  pushLog(draft, `${foundText} Stowed in your Pack for later.`);
}

/** Thin wrapper so the dungeon's own call sites read unchanged; the effects live in `fight.ts` now,
 * shared with the wilderness (issue #110/#120). */
export function applyConsumable(draft: Draft<DungeonState>, item: Consumable, rng: RNG): void {
  applyConsumableEffect(draft, draft.combat ?? null, item, rng, dungeonLog(draft), MAX_TORCHES);
}

/**
 * One full monster counter-attack: sums damage (including any queued Firebreath/Sorcery
 * bonuses), applies a queued Deathtouch or Paralyze, then clears those queued effects.
 */
/** Flat damage bonus for the player's next attack: the active fight's `combatDamageBonus` (e.g.
 * Potion of Fury), plus the equipped weapon's `weaponDamageBonus`/`damageBonusVsTag` if its tag
 * matches the target (case-insensitive substring of the monster's name -- there's no formal
 * monster-category system, matching the rulebook's own flavor-driven "+2 damage to Angels" style). */
/** Every currently-equipped item's ability, whether it lives on the weapon or an armor piece --
 * e.g. Emperor's Sandals (a Wonder, "wonderItem" armor piece) grants a damage bonus exactly like
 * a [Weapon] of War would, so damage-bonus effects aren't only ever looked for on the weapon. */
/** Ogre ("cannot wear armor", issue #60) and the bubbles mutation ("cannot wear armor", issue #30)
 * are the identical restriction from two sources -- one OR'd condition, not two code paths. Only
 * covers *armour*: Ogre's separate potion/scroll restrictions are its own, and no mutation grants
 * them. Armour already equipped is kept either way; the rule is that you cannot *put it on*. */
/** Thin dungeon-side wrappers over the shared combat core (issue #120). `DungeonState` satisfies
 * `Fighter` structurally, so these exist only to keep the ~40 existing call sites reading the same
 * way and to supply the dungeon's own log sink. */
export function cannotWearArmor(draft: Draft<DungeonState>): boolean {
  return fightCannotWearArmor(draft);
}
