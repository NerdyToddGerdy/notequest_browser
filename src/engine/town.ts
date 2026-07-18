import type { MonsterAbility } from "../data/dungeonTables.ts";
import { HEAL_AMOUNT } from "./combat.ts";
import type { ArmorPiece, EquippedWeapon, HeldItem } from "./dungeonState.ts";

/** Heal (1) and Light (2) are the only two Basic Spells usable outside combat -- see
 * CharacterSheet's own CASTABLE_OUT_OF_COMBAT set, the shared source of truth for which rolls
 * these are. */
const CASTABLE_OUT_OF_COMBAT = new Set([1, 2]);

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
  /** Found weapons not currently wielded -- see DungeonState.spareWeapons. */
  spareWeapons: EquippedWeapon[];
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
export function canRest(
  resources: AdventurerResources,
  maxSpellUses: Record<number, number>,
): boolean {
  if (resources.coins < 1) return false;
  if (resources.hp < resources.maxHp) return true;
  return Object.entries(maxSpellUses).some(
    ([roll, max]) => (resources.spellUses[Number(roll)] ?? 0) < max,
  );
}

/** "Rest: Spend 1 coin and recover your HP and spells consumed." */
export function rest(
  resources: AdventurerResources,
  maxSpellUses: Record<number, number>,
): AdventurerResources {
  return {
    ...resources,
    coins: resources.coins - 1,
    hp: resources.maxHp,
    spellUses: { ...maxSpellUses },
  };
}

export function canCastSpell(resources: AdventurerResources, spellRoll: number): boolean {
  return CASTABLE_OUT_OF_COMBAT.has(spellRoll) && (resources.spellUses[spellRoll] ?? 0) > 0;
}

/** Town/World's own equivalent of dungeonReducer.ts's CAST_SPELL case, for just Heal and Light --
 * the only two spells CharacterSheet's "Cast" button ever offers outside a dungeon (Teleport/Cold
 * Ray/Lightning/Fireball all need combat, which neither screen has). Mirrors that case's Heal
 * (min(HEAL_AMOUNT, room left before maxHp)) and Light (min(1, room left before MAX_TORCHES))
 * math exactly, since there's no DungeonState/reducer here to dispatch CAST_SPELL against. */
export function castSpell(resources: AdventurerResources, spellRoll: number): AdventurerResources {
  if (!canCastSpell(resources, spellRoll)) return resources;
  const spellUses = { ...resources.spellUses, [spellRoll]: resources.spellUses[spellRoll]! - 1 };
  if (spellRoll === 1) {
    const healed = Math.min(HEAL_AMOUNT, resources.maxHp - resources.hp);
    return { ...resources, hp: resources.hp + healed, spellUses };
  }
  const gained = Math.min(1, MAX_TORCHES - resources.torches);
  return { ...resources, torches: resources.torches + gained, spellUses };
}

export function canBuyTorch(resources: AdventurerResources): boolean {
  return resources.coins >= 1 && resources.torches < MAX_TORCHES;
}

/** "Buy Torches: Spend 1 coin and add 1 torch. Max 10 torches carried at a time." */
export function buyTorch(resources: AdventurerResources): AdventurerResources {
  return {
    ...resources,
    coins: resources.coins - 1,
    torches: Math.min(resources.torches + 1, MAX_TORCHES),
  };
}

/** "Sell Items: Sell any item in any city for [its worth in] coins." Each HeldItem already
 * carries the sale price it was found with (e.g. "Ornament, worth 5 Coins in the town").
 * `isCatPerson`: "You can sell equipment in the town for twice the price." */
export function sellItem(
  resources: AdventurerResources,
  index: number,
  isCatPerson = false,
): AdventurerResources {
  const item = resources.heldItems[index];
  if (!item) return resources;
  return {
    ...resources,
    coins: resources.coins + item.worth * (isCatPerson ? 2 : 1),
    heldItems: resources.heldItems.filter((_, i) => i !== index),
  };
}

/** `isBlacksmith`: "You can repair an armor by spending 1 Torch [instead of a coin]." */
export function canFixArmor(
  resources: AdventurerResources,
  index: number,
  isBlacksmith = false,
): boolean {
  const piece = resources.armor[index];
  const cost = isBlacksmith ? resources.torches : resources.coins;
  return cost >= 1 && !!piece && piece.hp < piece.maxHp;
}

/** "Fix Armor: Spend 1 coin to recover HP of an armor." */
export function fixArmor(
  resources: AdventurerResources,
  index: number,
  isBlacksmith = false,
): AdventurerResources {
  const piece = resources.armor[index];
  if (!piece) return resources;
  return {
    ...resources,
    coins: isBlacksmith ? resources.coins : resources.coins - 1,
    torches: isBlacksmith ? resources.torches - 1 : resources.torches,
    armor: resources.armor.map((p, i) => (i === index ? { ...p, hp: p.maxHp } : p)),
  };
}

/** Swaps a found-but-unwielded weapon into the equipped slot, pushing whatever was equipped (if
 * anything) back into spareWeapons -- Town's own free, no-roll equivalent of dungeonReducer.ts's
 * WIELD_WEAPON action, for wielding while not in a dungeon at all. */
export function wieldWeapon(resources: AdventurerResources, index: number): AdventurerResources {
  const chosen = resources.spareWeapons[index];
  if (!chosen) return resources;
  const remaining = resources.spareWeapons.filter((_, i) => i !== index);
  return {
    ...resources,
    weapon: chosen,
    spareWeapons: resources.weapon ? [...remaining, resources.weapon] : remaining,
  };
}

export function canBuyProvision(resources: AdventurerResources): boolean {
  return resources.coins >= 1 && resources.provisions < MAX_PROVISIONS;
}

/** "[Buy] more in any city by paying 1 coin per Provision, up to a maximum of 20." */
export function buyProvision(resources: AdventurerResources): AdventurerResources {
  return {
    ...resources,
    coins: resources.coins - 1,
    provisions: Math.min(resources.provisions + 1, MAX_PROVISIONS),
  };
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
