import type { MonsterAbility } from "../data/dungeonTables.ts";
import type { ArmorPiece, EquippedWeapon, HeldItem } from "./dungeonState.ts";

/** A living character's current stats, carried between the dungeon and the town -- unlike
 * `CreatedCharacter`, which only ever holds the starting values rolled at creation. */
export interface AdventurerResources {
  torches: number;
  hp: number;
  maxHp: number;
  coins: number;
  treasures: number;
  keys: number;
  heldItems: HeldItem[];
  armor: ArmorPiece[];
  weapon: EquippedWeapon | null;
  spellUses: Record<number, number>;
  monsterKills: number;
  bossKills: number;
  /** Per-monster-name/-ability kill tallies, mirroring `DungeonState`'s own fields of the same
   * name -- see there for why these exist. */
  killsByName: Record<string, number>;
  killsByAbility: Partial<Record<MonsterAbility, number>>;
  /** Spent while exploring the World map, same as `torches` is spent while exploring a dungeon --
   * neither resource is touched by the other activity, but both persist across every screen as
   * part of this same object. */
  provisions: number;
}

/** "You can carry a maximum of 10 torches at a time." */
export const MAX_TORCHES = 10;

/** "No one can carry more than 20 provisions." */
export const MAX_PROVISIONS = 20;

/** Resting only helps if it would actually recover something -- full HP and every spell already
 * at its max uses means the coin buys nothing. */
export function canRest(resources: AdventurerResources, maxSpellUses: Record<number, number>): boolean {
  if (resources.coins < 1) return false;
  if (resources.hp < resources.maxHp) return true;
  return Object.entries(maxSpellUses).some(([roll, max]) => (resources.spellUses[Number(roll)] ?? 0) < max);
}

/** "Rest: Spend 1 coin and recover your HP and spells consumed." */
export function rest(resources: AdventurerResources, maxSpellUses: Record<number, number>): AdventurerResources {
  return { ...resources, coins: resources.coins - 1, hp: resources.maxHp, spellUses: { ...maxSpellUses } };
}

export function canBuyTorch(resources: AdventurerResources): boolean {
  return resources.coins >= 1 && resources.torches < MAX_TORCHES;
}

/** "Buy Torches: Spend 1 coin and add 1 torch. Max 10 torches carried at a time." */
export function buyTorch(resources: AdventurerResources): AdventurerResources {
  return { ...resources, coins: resources.coins - 1, torches: Math.min(resources.torches + 1, MAX_TORCHES) };
}

/** "Sell Items: Sell any item in any city for [its worth in] coins." Each HeldItem already
 * carries the sale price it was found with (e.g. "Ornament, worth 5 Coins in the town").
 * `isCatPerson`: "You can sell equipment in the town for twice the price." */
export function sellItem(resources: AdventurerResources, index: number, isCatPerson = false): AdventurerResources {
  const item = resources.heldItems[index];
  if (!item) return resources;
  return {
    ...resources,
    coins: resources.coins + item.worth * (isCatPerson ? 2 : 1),
    heldItems: resources.heldItems.filter((_, i) => i !== index),
  };
}

/** `isBlacksmith`: "You can repair an armor by spending 1 Torch [instead of a coin]." */
export function canFixArmor(resources: AdventurerResources, index: number, isBlacksmith = false): boolean {
  const piece = resources.armor[index];
  const cost = isBlacksmith ? resources.torches : resources.coins;
  return cost >= 1 && !!piece && piece.hp < piece.maxHp;
}

/** "Fix Armor: Spend 1 coin to recover HP of an armor." */
export function fixArmor(resources: AdventurerResources, index: number, isBlacksmith = false): AdventurerResources {
  const piece = resources.armor[index];
  if (!piece) return resources;
  return {
    ...resources,
    coins: isBlacksmith ? resources.coins : resources.coins - 1,
    torches: isBlacksmith ? resources.torches - 1 : resources.torches,
    armor: resources.armor.map((p, i) => (i === index ? { ...p, hp: p.maxHp } : p)),
  };
}

export function canBuyProvision(resources: AdventurerResources): boolean {
  return resources.coins >= 1 && resources.provisions < MAX_PROVISIONS;
}

/** "[Buy] more in any city by paying 1 coin per Provision, up to a maximum of 20." */
export function buyProvision(resources: AdventurerResources): AdventurerResources {
  return { ...resources, coins: resources.coins - 1, provisions: Math.min(resources.provisions + 1, MAX_PROVISIONS) };
}

/** "Every day of travel consumes 1 Provision ... If you run out of provisions and have to move,
 * lose 1 HP for each provision needed [that you don't have]." Spends whatever provisions are
 * available first; any shortfall at all costs a flat 1 HP for the move -- not scaled to how many
 * provisions were actually short (a Mountain move at 0 provisions costs the same 1 HP as a Plains
 * move at 0 provisions, not 3x as much just because Mountains normally cost more) -- floored at 1,
 * a deliberate v1 simplification: the rulebook's actual lethal hex hazards (Glacier's Cracked Ice,
 * Thin Ice, a failed Reef check) live in the deferred Events on Travel/Location-effects layer, not
 * here, so running out of provisions alone can hurt but not kill. */
export function payTravelCost(resources: AdventurerResources, cost: number): AdventurerResources {
  const spend = Math.min(resources.provisions, cost);
  const shortfall = cost - spend;
  return {
    ...resources,
    provisions: resources.provisions - spend,
    hp: Math.max(1, resources.hp - (shortfall > 0 ? 1 : 0)),
  };
}
