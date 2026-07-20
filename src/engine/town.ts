import type { MonsterAbility } from "../data/dungeonTables.ts";
import type { SpellTableKey } from "../data/types.ts";
import { HEAL_AMOUNT, OUT_OF_COMBAT_SPELL_NAMES } from "./combat.ts";
import type { ArmorPiece, EquippedWeapon, HeldItem } from "./dungeonState.ts";
import { rollSpell, spellKey, SPELL_TABLE_BY_KEY } from "./character.ts";
import { rollDie } from "./dice.ts";
import type { RNG } from "./rng.ts";

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
  /** Keyed by `character.ts`'s `spellKey(table, roll)` composite -- see `DungeonState.spellUses`. */
  spellUses: Record<string, number>;
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
  maxSpellUses: Record<string, number>,
): boolean {
  if (resources.coins < 1) return false;
  if (resources.hp < resources.maxHp) return true;
  return Object.entries(maxSpellUses).some(([key, max]) => (resources.spellUses[key] ?? 0) < max);
}

/** "Rest: Spend 1 coin and recover your HP and spells consumed." */
export function rest(
  resources: AdventurerResources,
  maxSpellUses: Record<string, number>,
): AdventurerResources {
  return {
    ...resources,
    coins: resources.coins - 1,
    hp: resources.maxHp,
    spellUses: { ...maxSpellUses },
  };
}

/** Whether the spell at this composite key is one of the two (Heal/Light) usable outside a
 * dungeon fight at all -- see `combat.ts`'s `OUT_OF_COMBAT_SPELL_NAMES` for why this is
 * name-matched rather than keyed by table/roll directly. */
export function canCastSpell(resources: AdventurerResources, table: SpellTableKey, roll: number): boolean {
  const spell = SPELL_TABLE_BY_KEY[table]?.[roll];
  if (!spell || !OUT_OF_COMBAT_SPELL_NAMES.has(spell.name)) return false;
  return (resources.spellUses[spellKey(table, roll)] ?? 0) > 0;
}

/** Town/World's own equivalent of dungeonReducer.ts's CAST_SPELL case, for just Heal and Light --
 * the only two spells CharacterSheet's "Cast" button ever offers outside a dungeon (Teleport/Cold
 * Ray/Lightning/Fireball all need combat, which neither screen has). Mirrors that case's Heal
 * (min(HEAL_AMOUNT, room left before maxHp)) and Light (min(1, room left before MAX_TORCHES))
 * math exactly, since there's no DungeonState/reducer here to dispatch CAST_SPELL against. */
export function castSpell(
  resources: AdventurerResources,
  table: SpellTableKey,
  roll: number,
): AdventurerResources {
  if (!canCastSpell(resources, table, roll)) return resources;
  const spell = SPELL_TABLE_BY_KEY[table]![roll]!;
  const key = spellKey(table, roll);
  const spellUses = { ...resources.spellUses, [key]: resources.spellUses[key]! - 1 };
  if (spell.name === "Heal") {
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

// -- "Different Cultures" (docs/game-rules-reference.md lines 941-952): one bonus City Action per
// culture, on top of the base Rest/Buy/Sell/Fix set above. Several of these reference systems this
// codebase doesn't have (Curses, hand-economy, day-passage) -- per the project's own established
// precedent (`bladeTrap`'s flavor-only roll-of-2, `WeaponEntry.twoHanded` unenforced), those parts
// resolve as flavor-only rather than triggering new engine work; see each function's own comment.

const HUMAN_CURSE_REMOVAL_COST = 200;
export function canRemoveCurse(resources: AdventurerResources): boolean {
  return resources.coins >= HUMAN_CURSE_REMOVAL_COST;
}
/** Human: "Can eliminate a Curse or Cursed Item for 200 coins." No curse system exists anywhere in
 * this codebase (nothing carries a "cursed" flag) -- a pure, flavor-only coin sink. */
export function removeCurse(resources: AdventurerResources): AdventurerResources {
  return { ...resources, coins: resources.coins - HUMAN_CURSE_REMOVAL_COST };
}

const DWARF_LAMP_COST = 40;
export function canBuyLamp(resources: AdventurerResources): boolean {
  return resources.coins >= DWARF_LAMP_COST;
}
/** Dwarf: "Buy a Lamp for 40 coins. With the lamp you can use both hands in combat." Two-handed
 * weapons are already tracked-but-unenforced (`WeaponEntry.twoHanded`, no hand-economy system) --
 * a flavor-only keepsake added to the Pack, same shape as any other `HeldItem`. */
export function buyLamp(resources: AdventurerResources): AdventurerResources {
  return {
    ...resources,
    coins: resources.coins - DWARF_LAMP_COST,
    heldItems: [...resources.heldItems, { name: "Dwarven Lamp", worth: 5 }],
  };
}

const ELVEN_BOOTS_COST = 60;
export function canBuyElvenBoots(resources: AdventurerResources): boolean {
  return resources.coins >= ELVEN_BOOTS_COST;
}
/** Elf: "Buy a pair of Elven Boots (2 HP) for 60 coins. With them you can only spend 1 provision to
 * move through forests." A real `ArmorPiece` in the existing "boots" slot (can be damaged/fixed
 * normally, same as any dungeon-found boots -- the rulebook's "can't wear two of the same piece"
 * rule isn't enforced anywhere else in this codebase either, so buying a second pair over an
 * already-equipped one isn't specially guarded against here). The travel discount itself is
 * `hasElvenBoots()` below, checked by `WorldScreen.tsx`'s travel-cost caller. */
export function buyElvenBoots(resources: AdventurerResources): AdventurerResources {
  return {
    ...resources,
    coins: resources.coins - ELVEN_BOOTS_COST,
    armor: [...resources.armor, { piece: "boots", hp: 2, maxHp: 2, itemName: "Elven Boots" }],
  };
}

/** True once `resources.armor` includes a pair of Elven Boots -- a case-insensitive `itemName`
 * substring match, the same precedent already established for monster-tag matching. Checked by
 * `WorldScreen.tsx`'s travel-cost caller directly, not baked into `travelCost()` itself (a
 * World-map-only concern, not a dungeon-combat `ItemEffect` one). */
export function hasElvenBoots(resources: AdventurerResources): boolean {
  return resources.armor.some((p) => p.itemName?.toLowerCase().includes("elven boots"));
}

const GNOME_SPELL_COST = 80;
export function canLearnRandomSpell(resources: AdventurerResources): boolean {
  return resources.coins >= GNOME_SPELL_COST;
}
/** Gnome: "Learn a random Basic Magic for 80 coins." Fully real -- rolls a spell exactly like
 * Character Creation's own random-spell rolls (`rollSpell()`) and grants 1 use of it. */
export function learnRandomSpell(resources: AdventurerResources, rng: RNG = Math.random): AdventurerResources {
  const { entry } = rollSpell(rng);
  const key = spellKey(entry.table, entry.roll);
  return {
    ...resources,
    coins: resources.coins - GNOME_SPELL_COST,
    spellUses: { ...resources.spellUses, [key]: (resources.spellUses[key] ?? 0) + 1 },
  };
}

const GOBLIN_POTION_COST = 30;
export interface VerdosaPotionResult {
  resources: AdventurerResources;
  healed: boolean;
}
export function canDrinkVerdosaPotion(resources: AdventurerResources): boolean {
  return resources.coins >= GOBLIN_POTION_COST;
}
/** Goblin: "Buy a Verdosa Potion for 30 coins. When drinking, roll a die. If it's 3 or more you
 * regain all your HP. If not you will be itchy for a whole day." Drunk immediately (not
 * inventoried, matching "when drinking"); the itchy outcome is flavor-only -- no day-passage
 * system exists to model it against. */
export function drinkVerdosaPotion(resources: AdventurerResources, rng: RNG = Math.random): VerdosaPotionResult {
  const roll = rollDie(rng);
  const spent = { ...resources, coins: resources.coins - GOBLIN_POTION_COST };
  if (roll >= 3) return { resources: { ...spent, hp: spent.maxHp }, healed: true };
  return { resources: spent, healed: false };
}

const ORC_GLADIO_COST = 70;
export function canBuyOrcGladio(resources: AdventurerResources): boolean {
  return resources.coins >= ORC_GLADIO_COST;
}
/** Orc: "Buy an Orc Gladio (1d6+1 damage) for 70 coins." Fully real -- overwrites the equipped
 * weapon, same precedent as finding a better one in a dungeon (no equip-swap UI, you use what you
 * just got). */
export function buyOrcGladio(resources: AdventurerResources): AdventurerResources {
  return {
    ...resources,
    coins: resources.coins - ORC_GLADIO_COST,
    weapon: { name: "Orc Gladio", formula: "1d6+1" },
  };
}

/** "Hire Boat: spend 1 coin." The actual water-crossing capability lives on `WorldState.hasBoat`
 * (see `hexReducer.ts`'s `HIRE_BOAT` action) -- this only spends the coin. */
export function canHireBoat(resources: AdventurerResources): boolean {
  return resources.coins >= 1;
}
export function hireBoat(resources: AdventurerResources): AdventurerResources {
  return { ...resources, coins: resources.coins - 1 };
}

// -- "Getting Money" (issue #58, `docs/game-rules-reference.md` lines 1025-1071): mini-games for a
// broke character. Unlike everything above, Gamble's life-bet can kill the character outright --
// town.ts has no notion of "the character is dead" (that's App.tsx's job, the only place with both
// a `character` and the authority to clear the session/write the Graveyard), so a lethal outcome is
// surfaced as a result field instead of applied here. See `TownDeathCause` in `graveyard.ts`.

/** "Hard work: In a city, spend a few years working hard for more than daily bread. Permanently
 * lose 1 HP and gain 1d6+1 coins." "Permanently" -- unlike every other HP loss in this game, Rest
 * can't undo this, so it comes out of `maxHp` itself (current `hp` clamped down to match if it was
 * already at the old max), not just current HP. Guarded so `maxHp` can never drop to 0 -- the
 * rulebook doesn't list this as a way to die, unlike Gamble/Thug Life/Arena. City-only per the
 * rulebook's own wording (unlike Gamble, which explicitly says "city or fortress") -- callers gate
 * this on `!isFortressLocation(...)`. */
export function canHardWork(resources: AdventurerResources): boolean {
  return resources.maxHp > 1;
}
export function hardWork(resources: AdventurerResources, rng: RNG = Math.random): AdventurerResources {
  const maxHp = resources.maxHp - 1;
  return {
    ...resources,
    maxHp,
    hp: Math.min(resources.hp, maxHp),
    coins: resources.coins + rollDie(rng) + 1,
  };
}

export interface GambleResult {
  resources: AdventurerResources;
  outcome: "won" | "lost" | "survivedLifeBet" | "diedLifeBet";
}
/** "Gamble: In a city or fortress, spend 1 coin and roll a die. If you roll 6 you get 6 coins; if
 * less, you get nothing. If you don't have money, you can bet your life. If you drop less than 6,
 * someone kills you...; if you drop 6 you stay alive and earn 5 coins." Always offered -- which of
 * the two sub-games runs is decided by `resources.coins` itself, matching the rulebook's own "if
 * you don't have money" framing (not a separate action to pick). `diedLifeBet` leaves `resources`
 * untouched; the caller (`TownScreen`, via `onCharacterDied`) is responsible for the actual death --
 * see the block comment above. */
export function gamble(resources: AdventurerResources, rng: RNG = Math.random): GambleResult {
  if (resources.coins >= 1) {
    const spent = { ...resources, coins: resources.coins - 1 };
    if (rollDie(rng) === 6) return { resources: { ...spent, coins: spent.coins + 6 }, outcome: "won" };
    return { resources: spent, outcome: "lost" };
  }
  if (rollDie(rng) === 6) {
    return { resources: { ...resources, coins: resources.coins + 5 }, outcome: "survivedLifeBet" };
  }
  return { resources, outcome: "diedLifeBet" };
}

export interface ThugLifeResult {
  resources: AdventurerResources;
  /** Same "town.ts doesn't know the character is dead" split as Gamble's `diedLifeBet` -- `died`
   * leaves `resources` untouched either way; the caller owns the actual death flow. */
  died: boolean;
  /** True on a successful-but-caught escape -- the caller applies the actual hex ban via
   * `hexState.ts`'s `withBannedHex()`, since town.ts has no notion of hexes/WorldState. */
  banned: boolean;
  outcome: "killed" | "diedEscaping" | "fled" | "coins" | "treasure";
  /** Only set for `outcome === "coins"`. */
  amount?: number;
}

/** "Thug Life: Steal money from travelers. In a city roll 2d6, in a fortress roll 3d6, and compare
 * with the table below" -- "Table: Stealing from Travelers." The 15-18 "Crypt/Sanctuary/Palace
 * Treasure!" rows are only reachable on 3d6 (a city's 2d6 tops out at 12) and are flattened to a
 * generic `treasures` credit -- this codebase has no per-dungeon-type Treasure concept to hand out
 * one of specifically, same flavor-simplification precedent as `bladeTrap`'s roll-of-2 or
 * `DUNGEON_TYPE_BY_TERRAIN`'s thematic substitutions. The 5-7 jail row's "lose 1d6 HP... if you are
 * still alive, you have fled" can itself be lethal -- checked here rather than left for the caller,
 * since it's the same roll that determines both the HP loss and whether the escape succeeds. */
export function resolveThugLife(
  resources: AdventurerResources,
  isFortress: boolean,
  rng: RNG = Math.random,
): ThugLifeResult {
  const dice = isFortress ? 3 : 2;
  let roll = 0;
  for (let i = 0; i < dice; i++) roll += rollDie(rng);

  if (roll <= 4) return { resources, died: true, banned: false, outcome: "killed" };
  if (roll <= 7) {
    const hpLoss = rollDie(rng);
    if (resources.hp - hpLoss <= 0) {
      return { resources, died: true, banned: false, outcome: "diedEscaping" };
    }
    return {
      resources: { ...resources, hp: resources.hp - hpLoss },
      died: false,
      banned: true,
      outcome: "fled",
    };
  }
  if (roll === 8) return coinsResult(resources, 2);
  if (roll === 9) return coinsResult(resources, 5);
  if (roll === 10) return coinsResult(resources, 7);
  if (roll <= 12) return coinsResult(resources, 10);
  if (roll <= 14) return coinsResult(resources, 20);
  return {
    resources: { ...resources, treasures: resources.treasures + 1 },
    died: false,
    banned: false,
    outcome: "treasure",
  };
}

function coinsResult(resources: AdventurerResources, amount: number): ThugLifeResult {
  return {
    resources: { ...resources, coins: resources.coins + amount },
    died: false,
    banned: false,
    outcome: "coins",
    amount,
  };
}
