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
}

/** "You can carry a maximum of 10 torches at a time." */
export const MAX_TORCHES = 10;

export function canRest(resources: AdventurerResources): boolean {
  return resources.coins >= 1;
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
