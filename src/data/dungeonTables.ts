import type { DungeonTypeKey } from "./dungeonTypes.ts";

export interface RoomContentEntry {
  text: string;
  secretPassage: boolean;
  /** True for rows describing an actual Chest to open (see the "Open a Chest" dungeon action). */
  hasChest?: boolean;
  /** A reward implied by this row's own flavor text (e.g. "1d6 coins on the floor") that used to
   * be purely cosmetic. Unlike Chests (an explicit "Open Chest" action) or Treasures (spent on
   * demand via "Open a Treasure"), these are just there -- rolled and credited automatically the
   * moment the room is built, same as the room's flavor text itself needing no interaction. */
  reward?: RoomContentReward;
  /** Sewers (issue #30): "A metal ladder leads to the surface." Sewers has no Final Room or Boss, so
   * this is how a run is *finished* -- `RoomInspector` offers a "Climb Out" action, which sets
   * `DungeonState.exitUsed` and makes `isDungeonBeaten()` true. The only row in any table that ends
   * a dungeon without a Boss. */
  isExit?: boolean;
}

export type RoomContentReward =
  | { kind: "coins"; count: MonsterCount; multiplier?: number }
  | { kind: "treasures"; count: MonsterCount }
  | { kind: "magicScrolls"; count: MonsterCount }
  | { kind: "magicItems"; count: MonsterCount };

export interface TrapEntry {
  text: string;
  /** Set for traps that mechanically cost torches (e.g. the ditch trap) rather than being flavor-only. */
  torchCost?: number;
  /** Necropolis's "A cage falls on you. You are trapped and need to spend 1d6 torches to get out"
   * (issue #30) -- unlike `torchCost`'s flat number, this is rolled fresh at the moment the trap
   * fires (`resolveTrapOutcome()`), same as any other dice-based amount. Mutually exclusive with
   * `torchCost`. */
  torchCostDice?: { dice: number; sides: number };
  /** Flat HP damage this trap deals when it fires (e.g. "Acid Spout (5 Damage)"). */
  damage?: number;
  /** The Blade Trap (identical row 1 across every dungeon type): rolls a die when it fires --
   * a 1 kills outright, a 2 "loses an arm" (flavor only; this codebase has no hand-economy
   * system to enforce against, same simplification tier as `WeaponEntry.twoHanded`). */
  bladeTrap?: boolean;
  /** Monsters that ambush the player when this trap fires (Crypt's Bats, Tomb's Skeletons) --
   * ordinary combat, spawned exactly like a room's own Monster-table roll. */
  monsters?: MonsterTemplate;
  /** Ziggurat (issue #30): "Acid squirts from the ceiling, destroying a piece of armor you're
   * wearing" -- picks one equipped piece at random and zeroes its HP (a no-op if nothing is
   * equipped, rather than inventing a piece to destroy). */
  destroysArmor?: boolean;
  /** Ziggurat (issue #30): "A passage opens and a Monster emerges (roll in the table below)" --
   * unlike `monsters` above (a fixed ambush template), this rolls a fresh 2d6 into the dungeon's
   * own Monster table at the moment the trap fires, same as an ordinary room would (including the
   * possibility of rolling "no monsters," rows 7-8). */
  rollsMonsterTable?: boolean;
}

export type MonsterAbility =
  | "stoneskin"
  | "loot"
  | "explosive"
  | "firebreath"
  | "horde"
  | "intangible"
  | "sorcery"
  | "deathtouch"
  | "undead"
  | "necromancy"
  | "weakness"
  | "regeneration"
  | "paralyze"
  | "poison";

/** How many of this monster appear: a fixed number, or an NdS dice roll (e.g. "1d6 Goblins"). */
export type MonsterCount = number | { dice: number; sides: number };

export interface MonsterTemplate {
  /** Written however the rulebook prints it -- plural for anything with a dice-based `count`
   * (e.g. "1d6 Goblins"), since that's how the table itself reads. */
  name: string;
  /** Only set where `count` is dice-based and could actually resolve to exactly 1 (a fixed `count`
   * of 1 already has a correctly-singular `name` of its own, e.g. "Orc") -- `spawnMonsters()` uses
   * this instead of `name` for the spawned instance whenever the roll comes up 1, so a lone Goblin
   * isn't displayed/logged as "Goblins" everywhere its name shows up. */
  singularName?: string;
  hp: number;
  damage: number;
  abilities: MonsterAbility[];
  count: MonsterCount;
}

/**
 * What opening a Treasure actually does. "worth N Coins in the town" isn't paid out as coins on
 * the spot -- it becomes a held item instead, sellable in Town (see HeldItem). The Reward table's
 * "[Roll in the Wonders/Magic Item column]" redirects (and Prison's "[Roll in the Weapon table]")
 * are `rerollColumn` -- see ItemEffect/WonderEntry/MagicItemEntry below for what those columns
 * actually grant. Only Palace's Wonders/Magic Item tables are fully authored so far (the other
 * five dungeon types' Treasure rows that would redirect there still resolve as flavor-only text,
 * matching this codebase's other "not modeled" outcomes, until a later pass authors them too).
 */
export type RewardEffect =
  | { kind: "heldValue"; name: string; amount: number }
  | { kind: "heldValueRoll"; name: string; dice: number; sides: number; multiplier: number }
  /** Sewers (issue #30): "1d6 Torches" as a *Treasure* row. The Wonders column's `grantsTorches` is
   * an `ItemEffect` with a flat amount; this is the Treasure column's own rolled equivalent. */
  | { kind: "grantTorchesRoll"; dice: number; sides: number }
  | { kind: "healAll" }
  | { kind: "restoreAllSpells" }
  | { kind: "randomSpell" }
  /** Ziggurat's "Strange Fruit" (issue #30): "If eating, recover 1 use of a spell" -- unlike
   * Reload Mana (New Spells, still deferred), this picks a random currently-known spell rather
   * than letting the player choose, so it needs no picker UI. A no-op (flavor log only) if the
   * character knows no spells at all yet. */
  | { kind: "restoreRandomSpellUse" }
  /** Laboratory (issue #30) is the one type whose third Reward column is **Potions** rather than
   * Magic Item -- a different set with different semantics (drinkable one-shots, not equipment), so
   * it gets its own column rather than being squeezed into `magicItem`. */
  | { kind: "rerollColumn"; column: "wonders" | "magicItem" | "weapon" | "potions" }
  | { kind: "flavor" };

export interface RewardOutcome {
  text: string;
  effect: RewardEffect;
}

/** Table: Armor (1d6) -- identical across all six dungeon types, unlike Weapon. "Ring" (0 HP) is
 * a dud roll reconciling the rulebook's "5 pieces" prose with the table's 6 rows: it can never
 * actually absorb damage. `"wonderItem"` isn't a real Armor table row -- it's used for Wonders
 * that are themselves a bespoke protective item (e.g. "Jester Hat (2 HP)"), which grant their own
 * HP pool outside the 5 named pieces (see WonderEntry.grantsHp). */
export type ArmorPieceKind =
  "ring" | "bracelets" | "boots" | "shoulderpads" | "helm" | "breastplate" | "wonderItem";

export const ARMOR_PIECE_LABELS: Record<ArmorPieceKind, string> = {
  ring: "Ring",
  bracelets: "Bracelets",
  boots: "Boots",
  shoulderpads: "Shoulderpads",
  helm: "Helm",
  breastplate: "Breastplate",
  wonderItem: "Trinket",
};

/** Magic Item names and texts are templates -- "[Armor] of Royalty", "Leprechaun's [Armor]",
 * "[Weapon] of Destruction" -- because the concrete piece isn't known until the base Armor/Weapon
 * table is rolled. Substituting at grant time (issue #116) is what stops a literal "[Armor] of the
 * Dead" reaching the player's Equipment list. Case-insensitive on the tag, and a no-op for any
 * name without one. */
export function substituteItemPlaceholder(text: string, concrete: string): string {
  return text.replace(/\[(Armor|Weapon)\]/gi, concrete);
}

export interface ArmorTableEntry {
  piece: ArmorPieceKind;
  maxHp: number;
}

export const ARMOR_TABLE: Record<number, ArmorTableEntry> = {
  1: { piece: "ring", maxHp: 0 },
  2: { piece: "bracelets", maxHp: 2 },
  3: { piece: "boots", maxHp: 3 },
  4: { piece: "shoulderpads", maxHp: 3 },
  5: { piece: "helm", maxHp: 4 },
  6: { piece: "breastplate", maxHp: 10 },
};

/** Table: Weapon (1d6) -- unique per dungeon type (different names/dice), unlike Armor. */
export interface WeaponEntry {
  name: string;
  formula: string;
  /** Conflicts with holding a torch per the rulebook's "Your Hands" section; not enforced -- this
   * app has no hand-economy/limb-tracking system, so it's informational only (same treatment as
   * other consciously-deferred rules -- see the stub list in CLAUDE.md). Audited: `ArmorPieceKind`
   * has no off-hand/shield slot (ring/bracelets/boots/shoulderpads/helm/breastplate are all body
   * slots, and there's exactly one `DungeonState.weapon` slot) -- there is currently no equippable
   * combination this flag could conflict with, so there's nothing to block without first building
   * that hand-economy system. */
  twoHanded?: boolean;
}

/**
 * The mechanical shape of a Wonder or Magic Item's unique ability. A small, reusable vocabulary --
 * extend only when a genuinely new shape turns up, not speculatively. `tags` matching against a
 * monster is done by case-insensitive substring match on `MonsterTemplate.name` (there's no formal
 * monster-category system in this codebase, and the rulebook itself only ever refers to monster
 * types by name, e.g. "Deals +2 damage to Angels") -- an array since at least one item (Garlic
 * necklace: "+1 against Vampire and Ghoul") names more than one.
 */
export type ItemEffect =
  | { kind: "extraHp"; amount: number }
  | { kind: "weaponDamageBonus"; amount: number }
  | { kind: "damageBonusVsTag"; tags: string[]; amount: number }
  | { kind: "damageMultiplierVsTag"; tags: string[]; multiplier: number }
  | { kind: "ignoresMonsterAbility"; ability: MonsterAbility }
  | { kind: "trapImmunity" }
  | { kind: "doubleChestCoins" }
  | { kind: "combatDamageBonus"; amount: number }
  | { kind: "grantsTorches"; amount: number }
  | { kind: "randomSpell" }
  | { kind: "lifesteal"; amount: number }
  | { kind: "instantKillOnRoll"; roll: number }
  /** Pyramid's Wonders column (issue #30): "[Roll in the 'Armor'/'Weapon' table]" -- a genuinely
   * new shape, distinct from `RewardEffect.rerollColumn` (which redirects the Treasure column into
   * Wonders/Magic Item/Weapon): this is a *Wonders-column row itself* redirecting one level further,
   * into the *base* Armor/Weapon table directly, with no bonus layered on top (an ordinary find,
   * not a Magic Item). Handled in `resolveWonder()`. */
  | { kind: "rerollBaseTable"; table: "armor" | "weapon" }
  /** Ziggurat's "Addictive Sweet Drink" (issue #30): "Recovers 1 HP" -- a Wonder-column heal, unlike
   * Treasure's own `healAll` (which heals fully); applied immediately, same as `grantsTorches`. */
  | { kind: "healAmount"; amount: number }
  /** Ziggurat's "Star Stone" (issue #91): "Spend 1 Provision to Reroll an Event." A pure marker,
   * like `trapImmunity`/`doubleChestCoins` -- it carries no numbers, it exists so the item is
   * *kept* as a `wonderItem` (a `flavor` Wonder with no `grantsHp` is discarded outright by
   * `resolveWonder()`) and so `events.ts`'s `hasStarStone()` has something to find. Unlike
   * `trapImmunity` it is not one-shot: the rulebook gives it no use limit, and the provision is the
   * cost that bounds it. */
  | { kind: "rerollEvent" }
  /** The Master key (issue #95): "opens any door in any dungeon." A standing effect, read at the
   * locked-door prompt -- unlike `trapImmunity`, it is never consumed, and unlike an ordinary Key it
   * isn't spent. Closest existing precedent is `doubleChestCoins`: a permanent property of a carried
   * item, checked at one decision point. */
  | { kind: "opensAnyLock" }
  | { kind: "flavor" };

export interface WonderEntry {
  name: string;
  text: string;
  /** Set only for Wonders that are themselves a wearable item with its own HP (e.g. "Jester Hat
   * (2 HP)") -- granted as a `"wonderItem"` ArmorPiece, not rolled on the Armor table. */
  grantsHp?: number;
  /** Citadel's Reward table (issue #30) has one Wonders row that's a plain, uniquely-named weapon
   * rather than a wearable trinket ("Orc Machete (1d6+1 Damage)") -- granted directly to
   * `spareWeapons`, bypassing the `grantsHp`/`wonderItem` shape entirely. Mutually exclusive with
   * `grantsHp` (a Wonder is never both). */
  grantsWeapon?: { name: string; formula: string; twoHanded?: boolean };
  effect: ItemEffect;
}

/** Magic Item entries are always "[Armor] of X" or "[Weapon] of X" -- `grants` says which base
 * table (Armor or the dungeon's own Weapon table) gets rolled for the concrete piece/weapon that
 * this item's `effect` then layers its bonus on top of. */
export interface MagicItemEntry {
  name: string;
  text: string;
  grants: "armor" | "weapon";
  effect: ItemEffect;
  /** Overrides the base Weapon table roll with this fixed formula, using `name` as the weapon's
   * own name directly -- for uniquely-named weapons (e.g. "Boatman's Oar (1d6+1 Dmg)") that don't
   * fit the usual "roll the dungeon's Weapon table, then layer a bonus on top" shape. */
  fixedFormula?: string;
  /** `fixedFormula`'s Armor-side sibling (issue #30) -- for uniquely-named armor pieces (e.g.
   * "Dwarven breastplate (10 HP)") whose text names a specific piece/HP directly instead of the
   * literal "[Armor] of X" bracket template that rolls the base table fresh. */
  fixedArmor?: { piece: ArmorPieceKind; maxHp: number };
  /** Necropolis's "Vampiric Trident" (issue #30) -- `fixedFormula` alone had no way to carry
   * Two-handed through to the granted weapon (unlike the base Weapon table's own `WeaponEntry`,
   * which already has this). */
  twoHanded?: boolean;
  /** Necropolis's "Fool's Potion" (issue #30): "Learn 3 Random Basic Spells" -- a Magic Item with
   * no physical item at all, unlike every other entry here. Short-circuits `resolveMagicItem()`
   * before the armor/weapon roll entirely; `grants` is still set (required) but unused when this
   * is present. */
  grantsSpells?: number;
}

/** Laboratory's Potions column (issue #30). Deliberately not `MagicItemEntry`: a potion is drunk, not
 * worn, so it has no base-table roll and no armour/weapon slot. Each maps onto an existing effect
 * vocabulary entry where one fits, and says so where one doesn't. */
export interface PotionEntry {
  name: string;
  text: string;
  effect: ItemEffect;
  /** Laboratory's own Mutation table (its Special Rule) -- the Mutation Potion rolls on it directly
   * rather than waiting to leave the dungeon. */
  rollsMutation?: boolean;
}

export interface DungeonTypeTables {
  /** Table: Trap (1d6). Row 1 is identical across all types. */
  trap: Record<number, TrapEntry>;
  /** Table: Room Content (2d6). */
  roomContent: Record<number, RoomContentEntry>;
  /** Table: Monsters (2d6). Rows 7 and 8 are both null ("no monsters in this room"). */
  monsters: Record<number, MonsterTemplate | null>;
  /** Table: Boss (1d6). Rolled once when the Final Room is placed; no Content/Monsters roll alongside it.
   * Optional only for Necropolis (issue #30), whose Boss is instead a 3-dice combinator --
   * `NECROPOLIS_BOSS_PART1/2/3` below, resolved by `dungeon.ts`'s `resolveBoss()` -- not a flat table. */
  boss?: Record<number, MonsterTemplate>;
  /** Table: Reward (1d6), "Treasure" column. */
  treasure: Record<number, RewardOutcome>;
  /** Table: Weapon (1d6). */
  weapon: Record<number, WeaponEntry>;
  /** Table: Reward's "Wonders" column (1d6). */
  wonders: Record<number, WonderEntry>;
  /** Table: Reward's "Magic Item" column (1d6). */
  magicItem: Record<number, MagicItemEntry>;
  /** Only Laboratory has one -- see `PotionEntry`. */
  potions?: Record<number, PotionEntry>;
  /** Citadel's "Dwarf Hallows" / Necropolis's "Forgotten Hallows" (issue #30): "Once you defeat the
   * Dungeon Boss, in addition to the 2d6 Treasures, you've found one of the Hallows (roll below)."
   * Optional -- only these two types have this Special Rule; `finishIfVictorious()` rolls it (1d6)
   * right after crediting the usual Boss Treasures, whenever present. */
  bossBonusLoot?: Record<number, BonusLootEntry>;
}

/** A post-Boss bonus item (Citadel/Necropolis's own Hallows tables, issue #30) -- always a
 * concrete, named item, so it's granted directly rather than routed through the Wonders/Magic Item
 * tables' own roll-then-layer-a-bonus shape. Several Hallows rows describe a stateful or
 * ability-conditioned effect this codebase's small `ItemEffect` vocabulary doesn't cover (e.g. "+2
 * damage to the next creature of the same type killed," "+3 against creatures with Firebreath" --
 * ability-gated, not name-gated, so `damageBonusVsTag`'s substring match wouldn't reliably fire) --
 * those items are still granted with their real HP/formula, just with `effect: { kind: "flavor" }`
 * for the part that isn't mechanically enforced, the same "documented, deliberate simplification"
 * tier as `bladeTrap`'s roll-of-2. */
export type BonusLootEntry =
  | { kind: "weapon"; name: string; formula: string; twoHanded?: boolean; bonusEffect?: ItemEffect }
  | { kind: "armor"; name: string; piece: ArmorPieceKind; maxHp: number; effect?: ItemEffect }
  | { kind: "trinket"; name: string; grantsHp?: number; effect: ItemEffect };

const ABILITY_LABELS: Record<MonsterAbility, string> = {
  stoneskin: "Stoneskin",
  loot: "Loot",
  explosive: "Explosive",
  firebreath: "Firebreath",
  horde: "Horde",
  intangible: "Intangible",
  sorcery: "Sorcery",
  deathtouch: "Deathtouch",
  undead: "Undead",
  necromancy: "Necromancy",
  weakness: "Weakness",
  regeneration: "Regeneration",
  paralyze: "Paralyze",
  poison: "Poison",
};

/** Summarized from `docs/game-rules-reference.md`'s Monster Abilities table, for the hover tooltip
 * on each ability tag -- not new copy, just condensed to a sentence. Lives here beside
 * `ABILITY_LABELS` rather than in a component, since both `CombatPanel` (dungeon fights) and
 * `EventPanel` (Events on Travel, issue #91) render the same tags. */
export const ABILITY_DESCRIPTIONS: Record<MonsterAbility, string> = {
  stoneskin: "Ignores any damage of 3 or less.",
  loot: "After the fight, rolls for a coin, a Key, or a Treasure.",
  explosive: "On a roll of 1, self-destructs for damage equal to its current HP.",
  firebreath: "On a roll of 1, its next attack deals +10 damage.",
  horde: "On a roll of 1, an Orc (6 HP; 3 Damage) joins the fight.",
  intangible: "Takes no damage from an even-numbered hit.",
  sorcery: "On a roll of 1, its next attack gets a bonus die of damage.",
  deathtouch: "On a roll of 1, its next attack kills you outright.",
  undead: "On defeat, a roll of 1 revives it with 1 HP.",
  necromancy: "On a roll of 1, a Skeleton (4 HP; 1 Damage; Undead) joins the fight.",
  weakness: "On a roll of 6, it takes double damage.",
  regeneration: "On a roll of 1, it recovers 6 HP.",
  paralyze: "On a roll of 1, its next attack paralyzes you for 1d6 turns.",
  poison: "Its damage always bypasses armor.",
};

export function formatMonsterCount(count: MonsterCount): string {
  return typeof count === "number" ? String(count) : `${count.dice}d${count.sides}`;
}

/** Renders a MonsterTemplate back into rulebook-style flavor text, e.g. "2 Orcs (6 HP; 3 Damage; Loot)". */
export function formatMonsterTemplate(template: MonsterTemplate): string {
  const abilities = template.abilities.map((a) => ABILITY_LABELS[a]);
  const stats = [`${template.hp} HP`, `${template.damage} Damage`, ...abilities].join("; ");
  return `${formatMonsterCount(template.count)} ${template.name} (${stats})`;
}

/** Renders a Wonder/Magic Item's `ItemEffect` into a short, human-readable line for a hover
 * tooltip, e.g. "+2 damage" or "Ignores Paralyze" -- `extraHp` and `flavor` return `null` since
 * they're either already visible as the piece's HP or have no mechanical effect to explain. */
export function describeItemEffect(effect: ItemEffect): string | null {
  switch (effect.kind) {
    case "weaponDamageBonus":
      return `+${effect.amount} damage`;
    case "damageBonusVsTag":
      return `+${effect.amount} damage vs ${effect.tags.join(" and ")}`;
    case "damageMultiplierVsTag":
      return `${effect.multiplier}x damage vs ${effect.tags.join(" and ")}`;
    case "ignoresMonsterAbility":
      return `Ignores ${ABILITY_LABELS[effect.ability]}`;
    case "trapImmunity":
      return "Ignores the next activated trap";
    case "doubleChestCoins":
      return "Doubles coins found in chests";
    case "combatDamageBonus":
      return `+${effect.amount} damage until the end of the fight`;
    case "grantsTorches":
      return `Grants ${effect.amount} torch${effect.amount === 1 ? "" : "es"}`;
    case "randomSpell":
      return "Grants a random Spell";
    case "lifesteal":
      return `Recovers ${effect.amount} HP with each attack`;
    case "instantKillOnRoll":
      return `Kills instantly on a roll of ${effect.roll}`;
    case "rerollBaseTable":
      return `Grants a plain ${effect.table === "armor" ? "Armor piece" : "Weapon"}`;
    case "healAmount":
      return `Recovers ${effect.amount} HP`;
    case "rerollEvent":
      return "Spend 1 provision to reroll a travel Event";
    case "opensAnyLock":
      return "Opens any locked door, without a torch or a key";
    case "extraHp":
    case "flavor":
      return null;
  }
}

const BLADE_TRAP: TrapEntry = {
  text: "A blade falls from the ceiling. Roll the dice. On a 2 you lose one of your arms and on a 1 you die.",
  bladeTrap: true,
};
const CLICK_NOTHING: TrapEntry = { text: "You hear a click, but nothing happens." };
const DITCH_TRAP: TrapEntry = {
  text: "You fall into a ditch (spend 1 torch to go out).",
  torchCost: 1,
};
const ACID_SPOUT_TRAP: TrapEntry = { text: "Acid Spout (5 Damage).", damage: 5 };
const DART_TRAP: TrapEntry = { text: "A dart hits you (1 Damage).", damage: 1 };

// Table: Reward, "Treasure" column -- these five rows repeat, word-for-word or in spirit,
// across every Core Book dungeon type; only the "worth N Coins" row (and Tomb's Mana Potion
// row 1) actually varies per type.
const HEALTH_POTION: RewardOutcome = {
  text: "Health Potion (Recovers all HP).",
  effect: { kind: "healAll" },
};
const MAGIC_SCROLL: RewardOutcome = {
  text: "Magic Scroll (a random Basic Spell, 1 use).",
  effect: { kind: "randomSpell" },
};
const VALUABLE_JEWEL: RewardOutcome = {
  text: "Valuable jewel (worth 2d6 x 10 Coins in the town).",
  effect: { kind: "heldValueRoll", name: "Valuable jewel", dice: 2, sides: 6, multiplier: 10 },
};

// Table: Monsters -- these three dice-counted entries repeat word-for-word across dungeon types,
// same shared-constant precedent as the traps/rewards above.
const GOBLINS: MonsterTemplate = {
  name: "Goblins",
  singularName: "Goblin",
  hp: 3,
  damage: 1,
  abilities: ["explosive"],
  count: { dice: 1, sides: 6 },
};
const BATS: MonsterTemplate = {
  name: "Bats",
  singularName: "Bat",
  hp: 1,
  damage: 1,
  abilities: ["poison"],
  count: { dice: 1, sides: 6 },
};
const SKELETON_SOLDIERS_SWARM: MonsterTemplate = {
  name: "Skeleton Soldiers",
  singularName: "Skeleton Soldier",
  hp: 4,
  damage: 2,
  abilities: ["undead"],
  count: { dice: 1, sides: 6 },
};
// Pyramid (issue #30): its own Trap table raises this same swarm at rows 2-3 -- no other dungeon
// type has a mummy-type monster, so this is new (not shared with any Core 6 type).
const MUMMIFIED_SOLDIERS_SWARM: MonsterTemplate = {
  name: "Mummified Soldiers",
  singularName: "Mummified Soldier",
  hp: 5,
  damage: 2,
  abilities: ["undead"],
  count: { dice: 1, sides: 6 },
};
/** Necropolis's own "Table: Boss" (issue #30) isn't a flat 1d6 table like every other type -- "roll
 * three dice and compare each column... combine Part 1 + Part 2 + Part 3 to build the boss's full
 * name, HP, damage, and abilities." Resolved by `dungeon.ts`'s `resolveBoss()`. */
export interface NecropolisBossModifier {
  name: string;
  hpBonus?: number;
  damageBonus?: number;
  abilities?: MonsterAbility[];
}

export interface NecropolisBossCreature {
  name: string;
  hp: number;
  damage: number;
  abilities: MonsterAbility[];
}

export const NECROPOLIS_BOSS_PART1: Record<number, NecropolisBossModifier> = {
  1: { name: "Colossal", hpBonus: 30 },
  2: { name: "Giant", hpBonus: 15 },
  3: { name: "Monstrous", damageBonus: 2 },
  4: { name: "Poisonous", abilities: ["poison"] },
  5: { name: "Dying", hpBonus: -5 },
  6: { name: "Stone", abilities: ["stoneskin"] },
};

export const NECROPOLIS_BOSS_PART2: Record<number, NecropolisBossCreature> = {
  1: { name: "Animal", hp: 20, damage: 3, abilities: [] },
  2: { name: "Skeleton", hp: 12, damage: 4, abilities: ["undead"] },
  3: { name: "Zombie", hp: 15, damage: 5, abilities: ["undead"] },
  4: { name: "Ghost", hp: 12, damage: 4, abilities: ["intangible"] },
  5: { name: "Necromancer", hp: 20, damage: 4, abilities: ["necromancy"] },
  6: { name: "Lich", hp: 25, damage: 6, abilities: ["necromancy", "undead"] },
};

export const NECROPOLIS_BOSS_PART3: Record<number, NecropolisBossModifier> = {
  1: { name: "of Death", abilities: ["deathtouch"] },
  2: { name: "of the Blades", damageBonus: 2 },
  3: { name: "from Hell", abilities: ["firebreath"] },
  4: { name: "from the Ice", abilities: ["paralyze"] },
  5: { name: "of Ancient Times", hpBonus: 30 },
  6: { name: "Forgotten by the Gods", hpBonus: 40 },
};

export const DUNGEON_TABLES: Record<DungeonTypeKey, DungeonTypeTables> = {
  palace: {
    trap: {
      1: BLADE_TRAP,
      2: ACID_SPOUT_TRAP,
      3: DITCH_TRAP,
      4: DART_TRAP,
      5: CLICK_NOTHING,
      6: CLICK_NOTHING,
    },
    roomContent: {
      2: { text: "Dust-filled library.", secretPassage: true },
      3: {
        text: "Destroyed kitchen with 1d6 coins on the floor.",
        secretPassage: false,
        reward: { kind: "coins", count: { dice: 1, sides: 6 } },
      },
      4: { text: "Large table with a few chairs.", secretPassage: true },
      5: {
        text: "Bookshelf with 1d6 Magic Scrolls.",
        secretPassage: false,
        reward: { kind: "magicScrolls", count: { dice: 1, sides: 6 } },
      },
      6: { text: "Desk with a Chest.", secretPassage: false, hasChest: true },
      7: { text: "Dirt everywhere.", secretPassage: true },
      8: { text: "Bed with a Chest on the side.", secretPassage: false, hasChest: true },
      9: { text: "Garden covered by plants.", secretPassage: true },
      10: { text: "Trash deposit.", secretPassage: true },
      11: { text: "Large table with papers and maps.", secretPassage: true },
      12: {
        text: "Armory. 2d6 Magic Items.",
        secretPassage: false,
        reward: { kind: "magicItems", count: { dice: 2, sides: 6 } },
      },
    },
    monsters: {
      2: { name: "Minotaur", hp: 14, damage: 7, abilities: [], count: 1 },
      3: { name: "Orcs", hp: 6, damage: 3, abilities: ["loot"], count: 2 },
      4: { name: "Orc", hp: 6, damage: 3, abilities: ["loot"], count: 1 },
      5: {
        name: "Giant Rats",
        singularName: "Giant Rat",
        hp: 2,
        damage: 1,
        abilities: [],
        count: { dice: 1, sides: 6 },
      },
      6: GOBLINS,
      7: null,
      8: null,
      9: { name: "Living Armor", hp: 8, damage: 3, abilities: [], count: 2 },
      10: { name: "Fungoid", hp: 4, damage: 2, abilities: ["loot", "regeneration"], count: 3 },
      11: { name: "Bone Golem", hp: 12, damage: 5, abilities: ["undead"], count: 1 },
      12: {
        name: "Walking Slime",
        hp: 10,
        damage: 1,
        abilities: ["loot", "regeneration"],
        count: 1,
      },
    },
    boss: {
      1: { name: "Zombie Baron", hp: 30, damage: 4, abilities: ["undead"], count: 1 },
      2: { name: "Mad King", hp: 22, damage: 2, abilities: ["explosive"], count: 1 },
      3: { name: "Ghost Lady", hp: 13, damage: 3, abilities: ["intangible"], count: 1 },
      4: { name: "Unholy Gargoyles", hp: 12, damage: 3, abilities: ["stoneskin"], count: 2 },
      5: { name: "Necromancer", hp: 16, damage: 7, abilities: ["necromancy"], count: 1 },
      6: { name: "Orc King", hp: 24, damage: 5, abilities: ["horde"], count: 1 },
    },
    treasure: {
      1: {
        text: "Ornament (worth 5 Coins in the town).",
        effect: { kind: "heldValue", name: "Ornament", amount: 5 },
      },
      2: HEALTH_POTION,
      3: MAGIC_SCROLL,
      4: VALUABLE_JEWEL,
      5: {
        text: "Roll on the Wonders table.",
        effect: { kind: "rerollColumn", column: "wonders" },
      },
      6: {
        text: "Roll on the Magic Item table.",
        effect: { kind: "rerollColumn", column: "magicItem" },
      },
    },
    weapon: {
      1: { name: "Candlestick", formula: "1d6-1" },
      2: { name: "Sword", formula: "1d6" },
      3: { name: "Rapier", formula: "1d6+1" },
      4: { name: "Whip", formula: "1d6+1" },
      5: { name: "Claw", formula: "1d6+1" },
      6: { name: "Halberd", formula: "1d6+3", twoHanded: true },
    },
    wonders: {
      1: {
        name: "Jester Hat",
        text: "Jester Hat (2 HP; Can't Move in Silence).",
        grantsHp: 2,
        effect: { kind: "flavor" },
      },
      2: {
        name: "Emperor's Sandals",
        text: "Emperor's Sandals (2 HP; +1 dmg against cockroaches).",
        grantsHp: 2,
        effect: { kind: "damageBonusVsTag", tags: ["cockroach"], amount: 1 },
      },
      3: {
        name: "Amulet of the Dead",
        text: "Amulet of the Dead (Ignores Undead effect).",
        effect: { kind: "ignoresMonsterAbility", ability: "undead" },
      },
      4: {
        name: "Potion of Luck",
        text: "Potion of Luck (Ignores the next activated Trap).",
        effect: { kind: "trapImmunity" },
      },
      5: {
        name: "Potion of Fury",
        text: "Potion of Fury (Damage +2 until the end of the fight).",
        effect: { kind: "combatDamageBonus", amount: 2 },
      },
      6: {
        name: "Lamp",
        text: "Lamp (No need to use hands to light).",
        effect: { kind: "flavor" },
      },
    },
    magicItem: {
      1: {
        name: "[Armor] of Royalty",
        text: "[Armor] of Royalty (It is very elegant).",
        grants: "armor",
        effect: { kind: "flavor" },
      },
      2: {
        name: "Leprechaun's [Armor]",
        text: "Leprechaun's [Armor] (Earn double coins in chests).",
        grants: "armor",
        effect: { kind: "doubleChestCoins" },
      },
      3: {
        name: "Centurion's [Armor]",
        text: "Centurion's [Armor] (+1 HP).",
        grants: "armor",
        effect: { kind: "extraHp", amount: 1 },
      },
      4: {
        name: "[Weapon] of Destruction",
        text: "[Weapon] of Destruction (Deals +2 damage).",
        grants: "weapon",
        effect: { kind: "weaponDamageBonus", amount: 2 },
      },
      5: {
        name: "[Weapon] of War",
        text: "[Weapon] of War (Deals +2 damage to Angels).",
        grants: "weapon",
        effect: { kind: "damageBonusVsTag", tags: ["angel"], amount: 2 },
      },
      6: {
        name: "[Weapon] of the Dragon Slayer",
        text: "[Weapon] of the Dragon Slayer (Double damage against Dragons).",
        grants: "weapon",
        effect: { kind: "damageMultiplierVsTag", tags: ["dragon"], multiplier: 2 },
      },
    },
  },
  crypt: {
    trap: {
      1: BLADE_TRAP,
      2: ACID_SPOUT_TRAP,
      3: {
        text: "Appears 1d6 Bats (1 HP; 1 Damage; Poison).",
        monsters: BATS,
      },
      4: CLICK_NOTHING,
      5: CLICK_NOTHING,
      6: CLICK_NOTHING,
    },
    roomContent: {
      2: { text: "Tombstone carved with your name.", secretPassage: false },
      3: { text: "Several pots with dead plants.", secretPassage: false },
      4: { text: "Texts sculpted on the floor.", secretPassage: true },
      5: { text: "Human bones everywhere.", secretPassage: true },
      6: {
        text: "A pile of bones and 1d6 coins.",
        secretPassage: false,
        reward: { kind: "coins", count: { dice: 1, sides: 6 } },
      },
      7: { text: "Casket with Chest inside.", secretPassage: false, hasChest: true },
      8: { text: "Various wooden coffins.", secretPassage: true },
      9: { text: "Walls made of skulls.", secretPassage: true },
      10: { text: "Dozens of burned candles everywhere.", secretPassage: true },
      11: { text: "Broken statue of a forgotten person.", secretPassage: true },
      12: {
        text: "Treasure room with 2d6 Treasures.",
        secretPassage: false,
        reward: { kind: "treasures", count: { dice: 2, sides: 6 } },
      },
    },
    monsters: {
      2: { name: "Vampire Servant", hp: 9, damage: 4, abilities: ["regeneration"], count: 1 },
      3: { name: "Giant Leech", hp: 12, damage: 5, abilities: [], count: 1 },
      4: { name: "Skeletons", hp: 4, damage: 1, abilities: ["undead"], count: 3 },
      5: { name: "Ghoul", hp: 6, damage: 3, abilities: ["regeneration"], count: 1 },
      6: GOBLINS,
      7: null,
      8: null,
      9: BATS,
      10: { name: "Giant Spider", hp: 10, damage: 4, abilities: ["paralyze"], count: 1 },
      11: { name: "Fungoid", hp: 4, damage: 2, abilities: ["loot", "regeneration"], count: 3 },
      12: { name: "Giant Spiders", hp: 10, damage: 4, abilities: ["paralyze"], count: 2 },
    },
    boss: {
      1: { name: "Spider Queen", hp: 20, damage: 3, abilities: ["paralyze"], count: 1 },
      2: { name: "Death Dessert", hp: 30, damage: 2, abilities: [], count: 1 },
      3: { name: "Death Boatman", hp: 20, damage: 2, abilities: ["deathtouch"], count: 1 },
      4: { name: "Master Vampire", hp: 20, damage: 5, abilities: ["regeneration"], count: 1 },
      5: { name: "Eternal Warrior", hp: 10, damage: 5, abilities: ["intangible"], count: 1 },
      6: { name: "Vampiric Beast", hp: 19, damage: 7, abilities: [], count: 1 },
    },
    treasure: {
      1: {
        text: "Religious Object (worth 3 Coins in the town).",
        effect: { kind: "heldValue", name: "Religious Object", amount: 3 },
      },
      2: HEALTH_POTION,
      3: MAGIC_SCROLL,
      4: VALUABLE_JEWEL,
      5: {
        text: "Roll on the Wonders table.",
        effect: { kind: "rerollColumn", column: "wonders" },
      },
      6: {
        text: "Roll on the Magic Item table.",
        effect: { kind: "rerollColumn", column: "magicItem" },
      },
    },
    weapon: {
      1: { name: "Femur", formula: "1d6-1" },
      2: { name: "Pickaxe", formula: "1d6" },
      3: { name: "Dagger", formula: "1d6" },
      4: { name: "Warhammer", formula: "1d6+1" },
      5: { name: "Sickle", formula: "1d6+1" },
      6: { name: "Glaive", formula: "1d6+2", twoHanded: true },
    },
    wonders: {
      1: {
        name: "Garlic necklace",
        text: "Garlic necklace (+1 against Vampire and Ghoul).",
        effect: { kind: "damageBonusVsTag", tags: ["vampire", "ghoul"], amount: 1 },
      },
      2: {
        name: "Potion of Luck",
        text: "Potion of Luck (Ignores the next activated Trap).",
        effect: { kind: "trapImmunity" },
      },
      3: {
        name: "Potion of Fury",
        text: "Potion of Fury (Damage +2 until the end of the fight).",
        effect: { kind: "combatDamageBonus", amount: 2 },
      },
      4: {
        name: "Salamander Potion",
        text: "Salamander Potion (Recovers lost arm).",
        effect: { kind: "flavor" },
      },
      5: {
        name: "Master key",
        text: "Master key (Open any door).",
        effect: { kind: "opensAnyLock" },
      },
      6: {
        name: "Potion of Luminescence",
        text: "Potion of Luminescence (Worth like two torches).",
        effect: { kind: "grantsTorches", amount: 2 },
      },
    },
    magicItem: {
      1: {
        name: "[Armor] of the Dead",
        text: "[Armor] of the Dead (It always stinks).",
        grants: "armor",
        effect: { kind: "flavor" },
      },
      2: {
        name: "[Armor] of the Spider Queen",
        text: "[Armor] of the Spider Queen (ignores the effect Paralyze).",
        grants: "armor",
        effect: { kind: "ignoresMonsterAbility", ability: "paralyze" },
      },
      3: {
        name: "Count's [Armor]",
        text: "Count's [Armor] (+2 HP).",
        grants: "armor",
        effect: { kind: "extraHp", amount: 2 },
      },
      4: {
        name: "[Weapon] of Destruction",
        text: "[Weapon] of Destruction (Deals +2 damage).",
        grants: "weapon",
        effect: { kind: "weaponDamageBonus", amount: 2 },
      },
      5: {
        name: "Vampiric [Weapon]",
        text: "Vampiric [Weapon] (Recovers 1 HP with each attack).",
        grants: "weapon",
        effect: { kind: "lifesteal", amount: 1 },
      },
      6: {
        name: "Boatman's Oar",
        text: "Boatman's Oar (1d6+1 Dmg; ignores Intangible).",
        grants: "weapon",
        fixedFormula: "1d6+1",
        effect: { kind: "ignoresMonsterAbility", ability: "intangible" },
      },
    },
  },
  tomb: {
    trap: {
      1: BLADE_TRAP,
      2: {
        text: "Raise 1d6 Skeleton Soldiers (4 HP; 2 Damage; Undead).",
        monsters: SKELETON_SOLDIERS_SWARM,
      },
      3: {
        text: "Raise 1d6 Skeleton Soldiers (4 HP; 2 Damage; Undead).",
        monsters: SKELETON_SOLDIERS_SWARM,
      },
      4: {
        text: "Raise 1 Skeleton (3 HP; 1 Damage; Undead).",
        monsters: { name: "Skeleton", hp: 3, damage: 1, abilities: ["undead"], count: 1 },
      },
      5: CLICK_NOTHING,
      6: CLICK_NOTHING,
    },
    roomContent: {
      2: { text: "Empty sarcophagus with your name.", secretPassage: false },
      3: { text: "Several pots with dead plants.", secretPassage: false },
      4: { text: "Texts sculpted on the floor.", secretPassage: true },
      5: { text: "Human bones everywhere.", secretPassage: true },
      6: {
        text: "Pile of bones and 1d6 coins.",
        secretPassage: false,
        reward: { kind: "coins", count: { dice: 1, sides: 6 } },
      },
      7: { text: "Sarcophagus with Chest inside.", secretPassage: false, hasChest: true },
      8: { text: "Several wooden coffins.", secretPassage: true },
      9: { text: "Walls made of skulls.", secretPassage: true },
      10: { text: "A destroyed sarcophagus.", secretPassage: true },
      11: { text: "Broken statue of a hero.", secretPassage: true },
      12: {
        text: "Treasure Room with 2d6 Treasures.",
        secretPassage: false,
        reward: { kind: "treasures", count: { dice: 2, sides: 6 } },
      },
    },
    monsters: {
      2: { name: "Ghost of the Prince", hp: 6, damage: 4, abilities: ["intangible"], count: 1 },
      3: { name: "Bone Golem", hp: 12, damage: 5, abilities: ["undead"], count: 1 },
      4: { name: "Skeleton Soldiers", hp: 4, damage: 2, abilities: ["undead"], count: 2 },
      5: { name: "Living Armor", hp: 8, damage: 3, abilities: [], count: 1 },
      6: GOBLINS,
      7: null,
      8: null,
      9: {
        name: "Scorpions",
        singularName: "Scorpion",
        hp: 2,
        damage: 1,
        abilities: ["poison"],
        count: { dice: 1, sides: 6 },
      },
      10: { name: "Living Armor", hp: 8, damage: 3, abilities: [], count: 2 },
      11: { name: "Fungoid", hp: 4, damage: 2, abilities: ["loot", "regeneration"], count: 3 },
      12: { name: "Giant Spider", hp: 10, damage: 4, abilities: ["paralyze"], count: 1 },
    },
    boss: {
      1: { name: "Emperor Scorpio", hp: 20, damage: 3, abilities: ["poison"], count: 1 },
      2: { name: "Skeleton King", hp: 12, damage: 7, abilities: ["undead"], count: 1 },
      3: { name: "Queen of Bladed Hands", hp: 11, damage: 10, abilities: [], count: 1 },
      4: {
        name: "Ghost King of the Lost Swamp",
        hp: 10,
        damage: 4,
        abilities: ["intangible"],
        count: 1,
      },
      5: { name: "Necrotic Kings", hp: 4, damage: 1, abilities: ["undead"], count: 7 },
      6: {
        name: "Lich King of the Ethernal Wars",
        hp: 22,
        damage: 6,
        abilities: ["necromancy", "undead"],
        count: 1,
      },
    },
    treasure: {
      1: { text: "Mana Potion (Recovers all Spells).", effect: { kind: "restoreAllSpells" } },
      2: HEALTH_POTION,
      3: MAGIC_SCROLL,
      4: VALUABLE_JEWEL,
      5: {
        text: "Roll on the Wonders table.",
        effect: { kind: "rerollColumn", column: "wonders" },
      },
      6: {
        text: "Roll on the Magic Item table.",
        effect: { kind: "rerollColumn", column: "magicItem" },
      },
    },
    weapon: {
      1: { name: "Shovel", formula: "1d6-1" },
      2: { name: "Sword", formula: "1d6" },
      3: { name: "Axe", formula: "1d6+1" },
      4: { name: "Warhammer", formula: "1d6+1" },
      5: { name: "Sickle", formula: "1d6+1" },
      6: { name: "Scythe", formula: "1d6+2", twoHanded: true },
    },
    wonders: {
      1: {
        name: "Crown of the beheaded prince",
        text: "Crown of the beheaded prince (Does not die in blade traps).",
        effect: { kind: "flavor" },
      },
      2: {
        name: "Potion of Luck",
        text: "Potion of Luck (Ignores the next activated Trap).",
        effect: { kind: "trapImmunity" },
      },
      3: {
        name: "Potion of Luck",
        text: "Potion of Luck (Ignores the next activated Trap).",
        effect: { kind: "trapImmunity" },
      },
      4: {
        name: "Potion of Fury",
        text: "Potion of Fury (Damage +2 until the end of the fight).",
        effect: { kind: "combatDamageBonus", amount: 2 },
      },
      5: {
        name: "Sapphire of Magic",
        text: "Sapphire of Magic (Learn a random Spell).",
        effect: { kind: "randomSpell" },
      },
      6: {
        name: "Lamp",
        text: "Lamp (No need to use hands to light).",
        effect: { kind: "flavor" },
      },
    },
    magicItem: {
      1: {
        name: "Bone [Armor]",
        text: "Bone [Armor] (-1 HP).",
        grants: "armor",
        effect: { kind: "extraHp", amount: -1 },
      },
      2: {
        name: "[Armor] of Strength",
        text: "[Armor] of Strength (+1 HP).",
        grants: "armor",
        effect: { kind: "extraHp", amount: 1 },
      },
      3: {
        name: "[Armor] of the Special Guard",
        text: "[Armor] of the Special Guard (+1 HP).",
        grants: "armor",
        effect: { kind: "extraHp", amount: 1 },
      },
      4: {
        name: "[Weapon] of Destruction",
        text: "[Weapon] of Destruction (Deals +2 damage).",
        grants: "weapon",
        effect: { kind: "weaponDamageBonus", amount: 2 },
      },
      5: {
        name: "Vampiric [Weapon]",
        text: "Vampiric [Weapon] (Recovers 1 HP with each attack).",
        grants: "weapon",
        effect: { kind: "lifesteal", amount: 1 },
      },
      6: {
        name: "Vorpal [Weapon]",
        text: "Vorpal [Weapon] (Kills instantly when get '6' on the die).",
        grants: "weapon",
        effect: { kind: "instantKillOnRoll", roll: 6 },
      },
    },
  },
  sanctuary: {
    trap: {
      1: BLADE_TRAP,
      2: { text: "Spears come out of the ground (5 Damage).", damage: 5 },
      3: DITCH_TRAP,
      4: CLICK_NOTHING,
      5: CLICK_NOTHING,
      6: CLICK_NOTHING,
    },
    roomContent: {
      2: { text: "A magic circle on the floor.", secretPassage: false },
      3: { text: "10 chairs lined up.", secretPassage: false },
      4: {
        text: "Torture Room with 1d6 Treasures.",
        secretPassage: false,
        reward: { kind: "treasures", count: { dice: 1, sides: 6 } },
      },
      5: { text: "Creature or deity statues.", secretPassage: true },
      6: {
        text: "Corpse with 1 Treasure.",
        secretPassage: false,
        reward: { kind: "treasures", count: 1 },
      },
      7: { text: "Large Chest on an altar.", secretPassage: false, hasChest: true },
      8: {
        text: "Small altar with 1d6 coins.",
        secretPassage: true,
        reward: { kind: "coins", count: { dice: 1, sides: 6 } },
      },
      9: {
        text: "2d6 paintings of gods (2 coins each).",
        secretPassage: true,
        reward: { kind: "coins", count: { dice: 2, sides: 6 }, multiplier: 2 },
      },
      10: { text: "Melted candles everywhere.", secretPassage: true },
      11: { text: "Fountain with running water.", secretPassage: true },
      12: {
        text: "Shelves with 1d6 Treasures.",
        secretPassage: false,
        reward: { kind: "treasures", count: { dice: 1, sides: 6 } },
      },
    },
    monsters: {
      2: { name: "Wisp", hp: 2, damage: 1, abilities: [], count: 8 },
      3: { name: "Fungoid", hp: 4, damage: 2, abilities: ["loot", "regeneration"], count: 3 },
      4: { name: "Warrior Angels", hp: 4, damage: 2, abilities: [], count: 3 },
      5: { name: "Sentinel Angel", hp: 5, damage: 3, abilities: ["sorcery"], count: 1 },
      6: GOBLINS,
      7: null,
      8: null,
      9: { name: "Orcs", hp: 6, damage: 3, abilities: ["loot"], count: 2 },
      10: { name: "Giant Angel Statue", hp: 10, damage: 5, abilities: ["stoneskin"], count: 1 },
      11: { name: "Giant Spider", hp: 10, damage: 4, abilities: ["paralyze"], count: 1 },
      12: {
        name: "Fallen Angel of Putrification",
        hp: 21,
        damage: 4,
        abilities: ["poison"],
        count: 1,
      },
    },
    boss: {
      1: { name: "Rat God", hp: 30, damage: 5, abilities: ["poison"], count: 1 },
      2: { name: "Nether Guardians", hp: 9, damage: 3, abilities: ["intangible"], count: 2 },
      3: { name: "Aberration", hp: 29, damage: 4, abilities: ["weakness"], count: 1 },
      4: { name: "Faceless Goddess", hp: 40, damage: 7, abilities: ["sorcery"], count: 1 },
      5: { name: "God of Destruction", hp: 40, damage: 8, abilities: [], count: 1 },
      6: { name: "Fallen Angel of Vengeance", hp: 25, damage: 8, abilities: ["sorcery"], count: 1 },
    },
    treasure: {
      1: {
        text: "Religious Object (worth 3 Coins in the town).",
        effect: { kind: "heldValue", name: "Religious Object", amount: 3 },
      },
      2: HEALTH_POTION,
      3: MAGIC_SCROLL,
      4: VALUABLE_JEWEL,
      5: {
        text: "Roll on the Wonders table.",
        effect: { kind: "rerollColumn", column: "wonders" },
      },
      6: {
        text: "Roll on the Magic Item table.",
        effect: { kind: "rerollColumn", column: "magicItem" },
      },
    },
    weapon: {
      1: { name: "Pan", formula: "1d6-1" },
      2: { name: "Machete", formula: "1d6" },
      3: { name: "Sword", formula: "1d6+1" },
      4: { name: "Warhammer", formula: "1d6+1" },
      5: { name: "Mace", formula: "1d6+1" },
      6: { name: "Scythe", formula: "1d6+3", twoHanded: true },
    },
    wonders: {
      1: {
        name: "Protector Candle",
        text: "Protector Candle (Discard and next chest will be double).",
        // Simplified from a one-shot "next chest" consumable to a standing effect while held --
        // matches Leprechaun's [Armor]'s doubleChestCoins exactly, avoiding a separate one-use
        // charge-tracking mechanism for a single item.
        effect: { kind: "doubleChestCoins" },
      },
      2: {
        name: "Blessed Potion",
        text: "Blessed Potion (Destroy a cursed item).",
        effect: { kind: "flavor" },
      },
      3: {
        name: "Potion of Luck",
        text: "Potion of Luck (Ignores the next activated Trap).",
        effect: { kind: "trapImmunity" },
      },
      4: {
        name: "Potion of Fury",
        text: "Potion of Fury (Damage +2 until the end of the fight).",
        effect: { kind: "combatDamageBonus", amount: 2 },
      },
      5: {
        name: "Master key",
        text: "Master key (Open any door).",
        effect: { kind: "opensAnyLock" },
      },
      6: {
        name: "Potion of Luminescence",
        text: "Potion of Luminescence (Worth like two torches).",
        effect: { kind: "grantsTorches", amount: 2 },
      },
    },
    magicItem: {
      1: {
        name: "Priest's [Armor]",
        text: "Priest's [Armor] (Covered by religious symbols).",
        grants: "armor",
        effect: { kind: "flavor" },
      },
      2: {
        name: "[Armor] of the Gods",
        text: "[Armor] of the Gods (ignore Deathtouch).",
        grants: "armor",
        effect: { kind: "ignoresMonsterAbility", ability: "deathtouch" },
      },
      3: {
        name: "Angelic [Armor]",
        text: "Angelic [Armor] (+2 HP).",
        grants: "armor",
        effect: { kind: "extraHp", amount: 2 },
      },
      4: {
        name: "[Weapon] of Destruction",
        text: "[Weapon] of Destruction (Deals +2 damage).",
        grants: "weapon",
        effect: { kind: "weaponDamageBonus", amount: 2 },
      },
      5: {
        name: "Vampiric [Weapon]",
        text: "Vampiric [Weapon] (Recovers 1 HP with each attack).",
        grants: "weapon",
        effect: { kind: "lifesteal", amount: 1 },
      },
      6: {
        name: "Vorpal [Weapon]",
        text: "Vorpal [Weapon] (Kills instantly when get '6' on the die).",
        grants: "weapon",
        effect: { kind: "instantKillOnRoll", roll: 6 },
      },
    },
  },
  temple: {
    trap: {
      1: BLADE_TRAP,
      2: { text: "A giant hammer comes out of the ceiling (5 Damage).", damage: 5 },
      3: DITCH_TRAP,
      4: DART_TRAP,
      5: CLICK_NOTHING,
      6: CLICK_NOTHING,
    },
    roomContent: {
      2: { text: "A magic circle on the floor.", secretPassage: false },
      3: { text: "Bottomless pit.", secretPassage: false },
      4: {
        text: "Torture Room with 1d6 Treasures.",
        secretPassage: false,
        reward: { kind: "treasures", count: { dice: 1, sides: 6 } },
      },
      5: { text: "Unknown creature statues.", secretPassage: true },
      6: {
        text: "Corpse with 1 Treasure.",
        secretPassage: false,
        reward: { kind: "treasures", count: 1 },
      },
      7: { text: "Chest surrounded by melted candles.", secretPassage: false, hasChest: true },
      8: {
        text: "Small altar with 1d6 coins.",
        secretPassage: true,
        reward: { kind: "coins", count: { dice: 1, sides: 6 } },
      },
      9: {
        text: "2d6 paintings of demons (1 coin each).",
        secretPassage: true,
        reward: { kind: "coins", count: { dice: 2, sides: 6 } },
      },
      10: { text: "Carcasses of giant snakes.", secretPassage: true },
      11: { text: "Dry fountain.", secretPassage: true },
      12: {
        text: "Desk with 1d6 Treasures in the drawers.",
        secretPassage: false,
        reward: { kind: "treasures", count: { dice: 1, sides: 6 } },
      },
    },
    monsters: {
      2: {
        name: "Imps",
        singularName: "Imp",
        hp: 2,
        damage: 1,
        abilities: [],
        count: { dice: 2, sides: 6 },
      },
      3: { name: "Fungoid", hp: 4, damage: 2, abilities: ["loot", "regeneration"], count: 3 },
      4: {
        name: "Cultists",
        singularName: "Cultist",
        hp: 4,
        damage: 1,
        abilities: [],
        count: { dice: 1, sides: 6 },
      },
      5: {
        name: "Serpents",
        singularName: "Serpent",
        hp: 2,
        damage: 1,
        abilities: ["poison"],
        count: { dice: 1, sides: 6 },
      },
      6: GOBLINS,
      7: null,
      8: null,
      9: { name: "Orcs", hp: 6, damage: 3, abilities: ["loot"], count: 2 },
      10: { name: "Serpent Golem", hp: 10, damage: 5, abilities: ["poison"], count: 1 },
      11: { name: "Giant Serpent", hp: 17, damage: 3, abilities: ["paralyze"], count: 1 },
      12: { name: "Gargoyle", hp: 12, damage: 3, abilities: ["stoneskin"], count: 1 },
    },
    boss: {
      1: { name: "Tentacle God", hp: 20, damage: 6, abilities: ["regeneration"], count: 1 },
      2: { name: "Bloody Beast", hp: 23, damage: 4, abilities: ["weakness"], count: 1 },
      3: { name: "Meow Horror", hp: 40, damage: 2, abilities: [], count: 1 },
      4: { name: "Watchers", hp: 10, damage: 3, abilities: [], count: 3 },
      5: { name: "Demon Lord", hp: 30, damage: 6, abilities: ["firebreath"], count: 1 },
      6: { name: "Serpent God", hp: 30, damage: 3, abilities: ["poison"], count: 1 },
    },
    treasure: {
      1: {
        text: "Sinister Idol (worth 3 Coins in the town).",
        effect: { kind: "heldValue", name: "Sinister Idol", amount: 3 },
      },
      2: HEALTH_POTION,
      3: MAGIC_SCROLL,
      4: VALUABLE_JEWEL,
      5: {
        text: "Roll on the Wonders table.",
        effect: { kind: "rerollColumn", column: "wonders" },
      },
      6: {
        text: "Roll on the Magic Item table.",
        effect: { kind: "rerollColumn", column: "magicItem" },
      },
    },
    weapon: {
      1: { name: "Hacksaw", formula: "1d6-1" },
      2: { name: "Saber", formula: "1d6" },
      3: { name: "Kukri", formula: "1d6" },
      4: { name: "Scimitar", formula: "1d6+1" },
      5: { name: "Mace", formula: "1d6+1" },
      6: { name: "Sword", formula: "1d6+1" },
    },
    wonders: {
      1: {
        name: "Potion of the Color That Came from Beyond",
        text: "Potion of the Color That Came from Beyond (Hair gets a random color).",
        effect: { kind: "flavor" },
      },
      2: {
        name: "Potion of Luck",
        text: "Potion of Luck (Ignores the next activated Trap).",
        effect: { kind: "trapImmunity" },
      },
      3: {
        name: "Potion of Fury",
        text: "Potion of Fury (Damage +2 until the end of the fight).",
        effect: { kind: "combatDamageBonus", amount: 2 },
      },
      4: {
        name: "Potion of the Helping hand",
        text: "Potion of the Helping hand (Creates a new arm).",
        effect: { kind: "flavor" },
      },
      5: {
        name: "Master key",
        text: "Master key (Open any door).",
        effect: { kind: "opensAnyLock" },
      },
      6: {
        name: "Sapphire of Magic",
        text: "Sapphire of Magic (Learn a random Spell).",
        effect: { kind: "randomSpell" },
      },
    },
    magicItem: {
      1: {
        name: "Cultist's [Armor]",
        text: "Cultist's [Armor] (Discard to ignore a Trap).",
        grants: "armor",
        effect: { kind: "trapImmunity" },
      },
      2: {
        name: "Scaled [Armor]",
        text: "Scaled [Armor] (+1 Damage against Snakes).",
        grants: "armor",
        effect: { kind: "damageBonusVsTag", tags: ["snake"], amount: 1 },
      },
      3: {
        name: "Infernal [Armor]",
        text: "Infernal [Armor] (+3 HP).",
        grants: "armor",
        effect: { kind: "extraHp", amount: 3 },
      },
      4: {
        name: "[Weapon] of Destruction",
        text: "[Weapon] of Destruction (Deals +2 damage).",
        grants: "weapon",
        effect: { kind: "weaponDamageBonus", amount: 2 },
      },
      5: {
        name: "Cosmic [Weapon]",
        text: "Cosmic [Weapon] (On a '1' it opens a Portal).",
        grants: "weapon",
        effect: { kind: "flavor" },
      },
      6: {
        name: "Vorpal [Weapon]",
        text: "Vorpal [Weapon] (Kills instantly when get '6' on the die).",
        grants: "weapon",
        effect: { kind: "instantKillOnRoll", roll: 6 },
      },
    },
  },
  prison: {
    trap: {
      1: BLADE_TRAP,
      2: { text: "Stones collapse from the ceiling (5 Damage).", damage: 5 },
      3: DITCH_TRAP,
      4: DART_TRAP,
      5: CLICK_NOTHING,
      6: CLICK_NOTHING,
    },
    roomContent: {
      2: { text: "A cell with the skeleton of a childhood friend.", secretPassage: true },
      3: { text: "Large table with papers and confessions signed in blood.", secretPassage: false },
      4: { text: "Six cages hanging on the ceiling.", secretPassage: true },
      5: {
        text: "Shelf of belongings with 1d6 Treasures.",
        secretPassage: false,
        reward: { kind: "treasures", count: { dice: 1, sides: 6 } },
      },
      6: { text: "Shackles on the walls and hanging bones.", secretPassage: false },
      7: { text: "Four empty cells.", secretPassage: true },
      8: { text: "Large cell with bones on all sides.", secretPassage: false },
      9: { text: "Torture bed.", secretPassage: true },
      10: { text: "Stack of coffins.", secretPassage: false },
      11: { text: "Slime covered wall.", secretPassage: true },
      12: {
        text: "Arsenal. 2d6 Magic Items.",
        secretPassage: false,
        reward: { kind: "magicItems", count: { dice: 2, sides: 6 } },
      },
    },
    monsters: {
      2: { name: "Cave Troll", hp: 26, damage: 6, abilities: ["regeneration"], count: 1 },
      3: { name: "Orc Leader", hp: 10, damage: 3, abilities: ["loot", "horde"], count: 1 },
      4: { name: "Orcs", hp: 6, damage: 3, abilities: ["loot"], count: 2 },
      5: { name: "Orc", hp: 6, damage: 3, abilities: ["loot"], count: 1 },
      6: GOBLINS,
      7: null,
      8: null,
      9: { name: "Living Armor", hp: 8, damage: 3, abilities: [], count: 2 },
      10: { name: "Fungoid", hp: 4, damage: 2, abilities: ["loot", "regeneration"], count: 3 },
      11: { name: "Golem Ossos", hp: 12, damage: 5, abilities: ["undead"], count: 1 },
      12: { name: "Giant Magic Turtle", hp: 30, damage: 2, abilities: ["sorcery"], count: 1 },
    },
    boss: {
      1: { name: "Fire Serpent", hp: 20, damage: 3, abilities: ["firebreath"], count: 1 },
      2: { name: "Deadly Stinger Giant Wasp", hp: 22, damage: 4, abilities: ["poison"], count: 1 },
      3: { name: "Hell Hounds", hp: 10, damage: 3, abilities: ["firebreath"], count: 2 },
      4: { name: "Medusa", hp: 20, damage: 4, abilities: ["paralyze"], count: 1 },
      5: { name: "Cursed Ogre", hp: 20, damage: 7, abilities: ["weakness"], count: 1 },
      6: { name: "Dragon", hp: 28, damage: 7, abilities: ["firebreath"], count: 1 },
    },
    treasure: {
      1: HEALTH_POTION,
      2: MAGIC_SCROLL,
      3: VALUABLE_JEWEL,
      4: { text: "Roll on the Weapon table.", effect: { kind: "rerollColumn", column: "weapon" } },
      5: {
        text: "Roll on the Wonders table.",
        effect: { kind: "rerollColumn", column: "wonders" },
      },
      6: {
        text: "Roll on the Magic Item table.",
        effect: { kind: "rerollColumn", column: "magicItem" },
      },
    },
    weapon: {
      1: { name: "BBQ Stick", formula: "1d6-2" },
      2: { name: "Machete", formula: "1d6" },
      3: { name: "Spear", formula: "1d6+1" },
      4: { name: "Spear", formula: "1d6+1" },
      5: { name: "Lance", formula: "1d6+2", twoHanded: true },
      6: { name: "Lance", formula: "1d6+2", twoHanded: true },
    },
    wonders: {
      1: {
        name: "Goblin Whistle",
        text: "Goblin Whistle (Summons a friendly Goblin).",
        effect: { kind: "flavor" },
      },
      2: {
        name: "Potion of Luck",
        text: "Potion of Luck (Ignores the next activated Trap).",
        effect: { kind: "trapImmunity" },
      },
      3: {
        name: "Potion of Fury",
        text: "Potion of Fury (Damage +2 until the end of the fight).",
        effect: { kind: "combatDamageBonus", amount: 2 },
      },
      4: {
        name: "Salamander Potion",
        text: "Salamander Potion (Grow a tail).",
        effect: { kind: "flavor" },
      },
      5: {
        name: "Master key",
        text: "Master key (Open any door).",
        effect: { kind: "opensAnyLock" },
      },
      6: {
        name: "Lamp",
        text: "Lamp (A lamp that never runs out of oil).",
        effect: { kind: "flavor" },
      },
    },
    magicItem: {
      1: {
        name: "[Armor] of the Goblin Hero",
        text: "[Armor] of the Goblin Hero (-2 HP, but it's stylish).",
        grants: "armor",
        effect: { kind: "extraHp", amount: -2 },
      },
      2: {
        name: "[Armor] of Strength",
        text: "[Armor] of Strength (+1 Damage).",
        grants: "armor",
        effect: { kind: "weaponDamageBonus", amount: 1 },
      },
      3: {
        name: "Elven [Armor]",
        text: "Elven [Armor] (+2 HP).",
        grants: "armor",
        effect: { kind: "extraHp", amount: 2 },
      },
      4: {
        name: "[Weapon] of Destruction",
        text: "[Weapon] of Destruction (Deals +2 damage).",
        grants: "weapon",
        effect: { kind: "weaponDamageBonus", amount: 2 },
      },
      5: {
        name: "[Weapon] of the Dragon",
        text: "[Weapon] of the Dragon (Immune to Firebreath).",
        grants: "weapon",
        effect: { kind: "ignoresMonsterAbility", ability: "firebreath" },
      },
      6: {
        name: "Vorpal [Weapon]",
        text: "Vorpal [Weapon] (Kills instantly when get '6' on the die).",
        grants: "weapon",
        effect: { kind: "instantKillOnRoll", roll: 6 },
      },
    },
  },
  citadel: {
    trap: {
      1: BLADE_TRAP,
      2: { text: "A giant hammer comes out of the ceiling (5 dmg).", damage: 5 },
      3: { text: "You fall into a hole with stakes (3 damage).", damage: 3 },
      4: DART_TRAP,
      5: DART_TRAP,
      6: CLICK_NOTHING,
    },
    roomContent: {
      2: { text: "Underground Monster Hunting Trophies.", secretPassage: false },
      3: {
        text: "Destroyed kitchen and 1d6 coins on the floor.",
        secretPassage: true,
        reward: { kind: "coins", count: { dice: 1, sides: 6 } },
      },
      4: { text: "Bed with a Chest beside it.", secretPassage: true, hasChest: true },
      5: {
        text: "Wardrobe with 2 Treasures.",
        secretPassage: false,
        reward: { kind: "treasures", count: 2 },
      },
      6: { text: "Desk with a Chest below.", secretPassage: false, hasChest: true },
      7: { text: "Dusted war banners.", secretPassage: true },
      8: {
        text: "Training Room with a Treasure.",
        secretPassage: false,
        reward: { kind: "treasures", count: 1 },
      },
      9: { text: "Trash deposit.", secretPassage: true },
      10: {
        text: "Arsenal. 2d6 Treasures.",
        secretPassage: false,
        reward: { kind: "treasures", count: { dice: 2, sides: 6 } },
      },
      11: { text: "Large table with papers and maps.", secretPassage: true },
      12: { text: "Torture room with bones of orcs.", secretPassage: true },
    },
    monsters: {
      2: { name: "Orc Leader", hp: 12, damage: 5, abilities: ["loot", "horde"], count: 1 },
      3: { name: "Orcs", hp: 6, damage: 3, abilities: ["loot"], count: 3 },
      4: { name: "Orcs", hp: 6, damage: 3, abilities: ["loot"], count: 2 },
      5: { name: "Orc", hp: 6, damage: 3, abilities: ["loot"], count: 1 },
      6: GOBLINS,
      7: null,
      8: null,
      9: {
        name: "Dwarf Skeletons",
        singularName: "Dwarf Skeleton",
        hp: 4,
        damage: 3,
        abilities: ["undead"],
        count: 2,
      },
      10: { name: "Dwarf Ghost", hp: 6, damage: 4, abilities: ["intangible"], count: 1 },
      11: { name: "Golem Bones and Stone", hp: 15, damage: 6, abilities: ["undead"], count: 1 },
      12: {
        name: "Walking Slime",
        hp: 10,
        damage: 1,
        abilities: ["loot", "regeneration"],
        count: 1,
      },
    },
    boss: {
      1: { name: "Grim Reaper", hp: 50, damage: 3, abilities: ["deathtouch"], count: 1 },
      2: { name: "Bolrag", hp: 40, damage: 6, abilities: ["firebreath"], count: 1 },
      3: { name: "The Minotaur", hp: 30, damage: 7, abilities: ["horde"], count: 1 },
      4: {
        name: "Ghost of the Dwarf King",
        hp: 20,
        damage: 5,
        abilities: ["intangible"],
        count: 1,
      },
      5: {
        name: "Orc Shaman Leader",
        hp: 20,
        damage: 2,
        abilities: ["sorcery", "horde"],
        count: 1,
      },
      6: { name: "The Cursed King", hp: 30, damage: 7, abilities: ["necromancy"], count: 1 },
    },
    treasure: {
      1: {
        text: "Dwarf Statuette (worth 6 Coins in the town).",
        effect: { kind: "heldValue", name: "Dwarf Statuette", amount: 6 },
      },
      2: { text: "Dwarf Beer Barrel (Recovers 5 HP).", effect: { kind: "healAll" } },
      3: VALUABLE_JEWEL,
      4: {
        text: "A very valuable jewel (worth 150 Coins in the town).",
        effect: { kind: "heldValue", name: "Very Valuable Jewel", amount: 150 },
      },
      5: {
        text: "Roll on the Wonders table.",
        effect: { kind: "rerollColumn", column: "wonders" },
      },
      6: {
        text: "Roll on the Magic Item table.",
        effect: { kind: "rerollColumn", column: "magicItem" },
      },
    },
    weapon: {
      1: { name: "Pickaxe", formula: "1d6-1" },
      2: { name: "Warhammer", formula: "1d6" },
      3: { name: "Battle Axe", formula: "1d6+1" },
      4: { name: "War Pick", formula: "1d6+1" },
      5: { name: "Machete", formula: "1d6+1" },
      6: { name: "Dwarven Great Axe", formula: "1d6+3", twoHanded: true },
    },
    wonders: {
      1: {
        name: "Dwarven Bracelets",
        text: "Dwarven Bracelets (3 HP).",
        grantsHp: 3,
        effect: { kind: "flavor" },
      },
      2: {
        name: "Dwarven Shoulderpads",
        text: "Dwarven Shoulderpads (4 HP).",
        grantsHp: 4,
        effect: { kind: "flavor" },
      },
      3: {
        name: "Torch Helmet",
        text: "Torch Helmet (3 HP; Fits torches).",
        grantsHp: 3,
        effect: { kind: "flavor" },
      },
      4: {
        name: "Orc Machete",
        text: "Orc Machete (1d6+1 Damage).",
        grantsWeapon: { name: "Orc Machete", formula: "1d6+1" },
        effect: { kind: "flavor" },
      },
      5: {
        name: "Horn of War",
        text: "Horn of War (Increase your damage +1).",
        effect: { kind: "weaponDamageBonus", amount: 1 },
      },
      6: {
        name: "Beheaded Head of the Orc Prince",
        text: "Beheaded Head of the Orc Prince (Orcs deal -1 damage).",
        effect: { kind: "flavor" },
      },
    },
    magicItem: {
      1: {
        name: "Ring of the Dead Man",
        text: "Ring of the Dead Man (Cursed; Cannot wear Armor).",
        grants: "armor",
        fixedArmor: { piece: "ring", maxHp: 0 },
        effect: { kind: "flavor" },
      },
      2: {
        name: "Dwarven Hammer",
        text: "Dwarven Hammer (1d6 dmg; +2 against orcs).",
        grants: "weapon",
        fixedFormula: "1d6",
        effect: { kind: "damageBonusVsTag", tags: ["orc"], amount: 2 },
      },
      3: {
        name: "Dwarven Battle Axe",
        text: "Dwarven Battle Axe (1d6+1 dmg; +2 against orcs).",
        grants: "weapon",
        fixedFormula: "1d6+1",
        effect: { kind: "damageBonusVsTag", tags: ["orc"], amount: 2 },
      },
      4: {
        name: "Dwarf Guard Cloak",
        text: "Dwarf Guard Cloak (+1 damage against orcs).",
        grants: "armor",
        effect: { kind: "damageBonusVsTag", tags: ["orc"], amount: 1 },
      },
      5: {
        name: "Dwarf War Pick",
        text: "Dwarf War Pick (1d6+2 Damage).",
        grants: "weapon",
        fixedFormula: "1d6+2",
        effect: { kind: "flavor" },
      },
      6: {
        name: "Dwarven Breastplate",
        text: "Dwarven Breastplate (10 HP; ignores Poison).",
        grants: "armor",
        fixedArmor: { piece: "breastplate", maxHp: 10 },
        effect: { kind: "ignoresMonsterAbility", ability: "poison" },
      },
    },
    bossBonusLoot: {
      1: {
        kind: "trinket",
        name: "Standard of the Dwarf Empire",
        effect: { kind: "weaponDamageBonus", amount: 1 },
      },
      2: {
        kind: "weapon",
        name: "Annihilation Pick",
        formula: "1d6+2",
      },
      3: {
        kind: "weapon",
        name: "Heavy Axe of the Deeps",
        formula: "1d6+4",
        twoHanded: true,
        bonusEffect: { kind: "damageBonusVsTag", tags: ["demon"], amount: 3 },
      },
      4: {
        kind: "weapon",
        name: "Dwarf God's Sledgehammer",
        formula: "1d6+5",
        twoHanded: true,
      },
      5: {
        kind: "armor",
        name: "Dwarf King's Helm",
        piece: "helm",
        maxHp: 11,
      },
      6: {
        kind: "weapon",
        name: "Dwarf King's Ax",
        formula: "1d6+3",
        bonusEffect: { kind: "damageBonusVsTag", tags: ["orc"], amount: 1 },
      },
    },
  },
  pyramid: {
    trap: {
      // "A huge block of stone falls over you. You died." -- an unconditional instant death, unlike
      // BLADE_TRAP's own roll-of-1-or-2 shape. Modeled as a flat, absurdly large `damage` instead of
      // a new "always fatal" flag -- this reuses every existing death-handling path (Samambro/Raven
      // survival rolls, remains, deathCause) for free, since no realistic HP total could survive it.
      1: { text: "A huge block of stone falls over you. You died.", damage: 999 },
      2: {
        text: "Raise 1d6 Mummified Soldiers (5 HP; 2 dmg; Undead).",
        monsters: MUMMIFIED_SOLDIERS_SWARM,
      },
      3: {
        text: "Raise 1d6 Mummified Soldiers (5 HP; 2 dmg; Undead).",
        monsters: MUMMIFIED_SOLDIERS_SWARM,
      },
      4: {
        text: "Raise 1 Mummy (4 HP; 1 dmg; Undead).",
        monsters: { name: "Mummy", hp: 4, damage: 1, abilities: ["undead"], count: 1 },
      },
      5: { text: "Gas cloud makes you pass out (spend 1 torch).", torchCost: 1 },
      6: CLICK_NOTHING,
    },
    roomContent: {
      2: {
        text: "Sarcophagus with 2d6 Treasures.",
        secretPassage: false,
        reward: { kind: "treasures", count: { dice: 2, sides: 6 } },
      },
      3: { text: "Statues of animal gods.", secretPassage: false },
      4: { text: "A well in the center of the room.", secretPassage: true },
      5: { text: "Wall covered with drawings of animal gods.", secretPassage: true },
      6: { text: "Broken statue of some animal god.", secretPassage: false },
      7: { text: "Sarcophagus with Chest inside.", secretPassage: false, hasChest: true },
      8: { text: "Vases with drawings of animal gods.", secretPassage: true },
      9: { text: "Wall covered with drawings of animal gods.", secretPassage: true },
      10: { text: "Dozens of melted candles everywhere.", secretPassage: true },
      11: { text: "Statue of a god with a crocodile head.", secretPassage: true },
      12: {
        text: "Sarcophagus with 2d6 Treasures.",
        secretPassage: false,
        reward: { kind: "treasures", count: { dice: 2, sides: 6 } },
      },
    },
    monsters: {
      2: { name: "Mummified Priestess", hp: 7, damage: 2, abilities: ["sorcery"], count: 1 },
      3: {
        name: "Mummified Soldiers",
        singularName: "Mummified Soldier",
        hp: 5,
        damage: 2,
        abilities: ["undead"],
        count: 3,
      },
      4: {
        name: "Mummified Soldiers",
        singularName: "Mummified Soldier",
        hp: 5,
        damage: 2,
        abilities: ["undead"],
        count: 2,
      },
      5: { name: "Living Armor", hp: 8, damage: 3, abilities: [], count: 2 },
      6: {
        name: "Giant Scarabs",
        singularName: "Giant Scarab",
        hp: 3,
        damage: 2,
        abilities: [],
        count: { dice: 1, sides: 6 },
      },
      7: null,
      8: null,
      9: {
        name: "Scorpions",
        singularName: "Scorpion",
        hp: 2,
        damage: 1,
        abilities: ["poison"],
        count: { dice: 1, sides: 6 },
      },
      10: { name: "Living Armor", hp: 8, damage: 3, abilities: [], count: 3 },
      11: {
        name: "Jackal God Living Statue",
        hp: 10,
        damage: 3,
        abilities: ["stoneskin"],
        count: 1,
      },
      12: { name: "Giant Spider", hp: 10, damage: 4, abilities: ["paralyze"], count: 1 },
    },
    boss: {
      1: { name: "Emperor Scorpio", hp: 30, damage: 3, abilities: ["poison"], count: 1 },
      2: { name: "Desert King", hp: 20, damage: 7, abilities: ["undead"], count: 1 },
      // "The Eternal Queen (12 HP; 1 dmg; Sorcery) and her 10 Mummified Soldiers (5 HP; 2 dmg;
      // Undead)" -- a two-monster boss encounter the single-MonsterTemplate Boss architecture can't
      // represent directly (unlike an ordinary room, a Boss fight is always exactly one template).
      // Documented simplification: the Queen alone, her entourage dropped rather than folded into
      // an inflated, inaccurate stat-hack.
      3: { name: "Eternal Queen", hp: 12, damage: 1, abilities: ["sorcery"], count: 1 },
      4: { name: "Evil Mirage", hp: 12, damage: 5, abilities: ["intangible"], count: 1 },
      5: { name: "Giant Winged Scarab", hp: 60, damage: 3, abilities: ["firebreath"], count: 1 },
      6: { name: "Jackal God", hp: 50, damage: 7, abilities: ["necromancy"], count: 1 },
    },
    treasure: {
      1: {
        text: "Golden statuette (worth 3d6 Coins in the town).",
        effect: {
          kind: "heldValueRoll",
          name: "Golden statuette",
          dice: 3,
          sides: 6,
          multiplier: 1,
        },
      },
      2: { text: "Health Potion (Recovers all HP).", effect: { kind: "healAll" } },
      3: MAGIC_SCROLL,
      4: VALUABLE_JEWEL,
      5: {
        text: "Roll on the Wonders table.",
        effect: { kind: "rerollColumn", column: "wonders" },
      },
      6: {
        text: "Roll on the Magic Item table.",
        effect: { kind: "rerollColumn", column: "magicItem" },
      },
    },
    weapon: {
      1: { name: "Scepter", formula: "1d6-1" },
      2: { name: "Kukri", formula: "1d6" },
      3: { name: "Katar", formula: "1d6" },
      4: { name: "Kopesh", formula: "1d6+1" },
      5: { name: "Scythe", formula: "1d6+1" },
      6: { name: "Staff", formula: "1d6+1", twoHanded: true },
    },
    wonders: {
      1: {
        name: "Mummified Cat",
        text: "Mummified Cat (Can reroll Traps once).",
        effect: { kind: "flavor" },
      },
      2: {
        name: "Old King's Necklace",
        text: "Old King's Necklace (Same as 3 provisions).",
        effect: { kind: "flavor" },
      },
      3: {
        name: "Scarab amulet",
        text: "Scarab amulet (Ignores traps in chests).",
        effect: { kind: "trapImmunity" },
      },
      4: {
        name: "Sacred Sun Hat",
        text: "Sacred Sun Hat (Gain 1 torch every killed scorpion).",
        effect: { kind: "flavor" },
      },
      5: {
        name: "[Roll in the Armor table]",
        text: "You find a plain piece of armor.",
        effect: { kind: "rerollBaseTable", table: "armor" },
      },
      6: {
        name: "[Roll in the Weapon table]",
        text: "You find a plain weapon.",
        effect: { kind: "rerollBaseTable", table: "weapon" },
      },
    },
    magicItem: {
      1: {
        name: "Jackal God's [Armor]",
        text: "Jackal God's [Armor] (Cursed; Cannot recover HP).",
        grants: "armor",
        effect: { kind: "flavor" },
      },
      2: {
        name: "Owl God's [Armor]",
        text: "Owl God's [Armor] (Gain an Advanced Spell).",
        grants: "armor",
        effect: { kind: "flavor" },
      },
      3: {
        name: "Desert King's [Armor]",
        text: "Desert King's [Armor] (+2 HP).",
        grants: "armor",
        effect: { kind: "extraHp", amount: 2 },
      },
      4: {
        name: "Beltramic Belt",
        text: "Beltramic Belt (Drives away scorpions).",
        grants: "armor",
        effect: { kind: "flavor" },
      },
      5: {
        name: "Desert King's [Weapon]",
        text: "Desert King's [Weapon] (Deals +4 against Stoneskin).",
        grants: "weapon",
        effect: { kind: "flavor" },
      },
      6: {
        name: "Seventy Nights [Weapon]",
        text: "Seventy Nights [Weapon] (Paralyzes the target for 2 turns on the '6').",
        grants: "weapon",
        effect: { kind: "flavor" },
      },
    },
  },
  ziggurat: {
    trap: {
      1: BLADE_TRAP,
      2: {
        text: "Acid squirts from the ceiling, destroying a piece of armor you're wearing.",
        destroysArmor: true,
      },
      3: { text: "You fall into a hole with stakes (3 damage).", damage: 3 },
      4: { text: "A passage opens and a Monster emerges.", rollsMonsterTable: true },
      5: { text: "A passage opens and a Monster emerges.", rollsMonsterTable: true },
      6: CLICK_NOTHING,
    },
    roomContent: {
      2: { text: "Corpses of different races hung on the walls.", secretPassage: false },
      3: { text: "Bone of a giant snake.", secretPassage: true },
      4: { text: "Bed with a Chest beside it.", secretPassage: false, hasChest: true },
      5: {
        text: "Cabinets with a lot of garments made of colored feathers.",
        secretPassage: false,
      },
      6: { text: "Altar of sacrifice.", secretPassage: true },
      7: { text: "Empty room.", secretPassage: false },
      8: { text: "Ceiling covered with star designs.", secretPassage: false },
      9: { text: "Two sarcophagi.", secretPassage: true },
      10: {
        text: "Room of ornaments. 1d6 Treasures.",
        secretPassage: false,
        reward: { kind: "treasures", count: { dice: 1, sides: 6 } },
      },
      11: { text: "Large table with a rotten banquet.", secretPassage: true },
      12: { text: "Torture room with goblin bones.", secretPassage: true },
    },
    monsters: {
      2: { name: "Boar Tribe Leader", hp: 15, damage: 5, abilities: ["loot"], count: 1 },
      3: {
        name: "Boar Soldiers",
        singularName: "Boar Soldier",
        hp: 6,
        damage: 3,
        abilities: ["loot"],
        count: 3,
      },
      4: {
        name: "Boar Soldiers",
        singularName: "Boar Soldier",
        hp: 6,
        damage: 3,
        abilities: ["loot"],
        count: 2,
      },
      5: { name: "Goblin Assassin", hp: 3, damage: 3, abilities: ["explosive"], count: 1 },
      6: GOBLINS,
      7: null,
      8: null,
      9: { name: "Pantera", hp: 5, damage: 4, abilities: [], count: 1 },
      10: { name: "Giant Bat", hp: 10, damage: 4, abilities: ["poison"], count: 1 },
      11: { name: "Sun God Living Statue", hp: 15, damage: 6, abilities: ["stoneskin"], count: 1 },
      12: { name: "Giant Feathered Serpent", hp: 12, damage: 3, abilities: [], count: 1 },
    },
    boss: {
      1: { name: "Medusa", hp: 20, damage: 7, abilities: ["paralyze"], count: 1 },
      2: { name: "Sacred Skull", hp: 20, damage: 6, abilities: ["regeneration"], count: 1 },
      3: { name: "Hagork, God of Orcs", hp: 30, damage: 7, abilities: ["horde"], count: 1 },
      4: { name: "Mysterious Peacock", hp: 17, damage: 5, abilities: ["sorcery"], count: 1 },
      5: { name: "Feathered Priestess", hp: 50, damage: 2, abilities: ["sorcery"], count: 1 },
      6: {
        name: "Sun God of the Feathered Spear",
        hp: 80,
        damage: 8,
        abilities: ["weakness"],
        count: 1,
      },
    },
    treasure: {
      1: {
        text: "Strange Fruit (If eating, recover 1 use of a spell).",
        effect: { kind: "restoreRandomSpellUse" },
      },
      2: { text: "Health Potion (Recovers all HP).", effect: { kind: "healAll" } },
      3: MAGIC_SCROLL,
      4: {
        text: "Gold Ornament and Jewelry (worth 100 Coins in the town).",
        effect: { kind: "heldValue", name: "Gold Ornament and Jewelry", amount: 100 },
      },
      5: {
        text: "Roll on the Wonders table.",
        effect: { kind: "rerollColumn", column: "wonders" },
      },
      6: {
        text: "Roll on the Magic Item table.",
        effect: { kind: "rerollColumn", column: "magicItem" },
      },
    },
    weapon: {
      1: { name: "Sacrificial Dagger", formula: "1d6-1" },
      2: { name: "Kopesh", formula: "1d6" },
      3: { name: "Obsidian Blade", formula: "1d6+1" },
      4: { name: "War Club", formula: "1d6+1" },
      5: { name: "Feathered Spear", formula: "1d6+1" },
      6: { name: "Sun Idol Maul", formula: "1d6+3", twoHanded: true },
    },
    wonders: {
      1: {
        name: "Addictive Sweet Drink",
        text: "Addictive Sweet Drink (Recovers 1 HP).",
        effect: { kind: "healAmount", amount: 1 },
      },
      2: {
        name: "Feathered Breastplate",
        text: "Feathered Breastplate (8 HP).",
        grantsHp: 8,
        effect: { kind: "flavor" },
      },
      3: {
        // Elven Boots' own precedent (town.ts's hasElvenBoots()) -- a dungeon-found item this time,
        // so the travel-cost hook lives in WorldScreen.tsx's hasFeatheredBoots() check instead.
        name: "Feathered Boots",
        text: "Feathered Boots (3 HP; Spend 1 provision on swamps).",
        grantsHp: 3,
        effect: { kind: "flavor" },
      },
      4: {
        name: "Crocodile Helmet",
        text: "Crocodile Helmet (5 HP).",
        grantsHp: 5,
        effect: { kind: "flavor" },
      },
      5: {
        name: "Star Stone",
        text: "Star Stone (Spend 1 Provision to Reroll an Event).",
        effect: { kind: "rerollEvent" },
      },
      6: {
        name: "Purification Potion",
        text: "Purification Potion (Removes a Curse).",
        effect: { kind: "flavor" },
      },
    },
    magicItem: {
      1: {
        name: "Crocodile Ring",
        text: "Crocodile Ring (Cursed; You get scales).",
        grants: "armor",
        fixedArmor: { piece: "ring", maxHp: 0 },
        effect: { kind: "flavor" },
      },
      2: {
        name: "Feathered Ring",
        text: "Feathered Ring (Cursed; Hairs become feathers).",
        grants: "armor",
        fixedArmor: { piece: "ring", maxHp: 0 },
        effect: { kind: "flavor" },
      },
      3: {
        name: "Owl Mask",
        text: "Owl Mask (1 HP; Ignores Intangible).",
        grants: "armor",
        fixedArmor: { piece: "helm", maxHp: 1 },
        effect: { kind: "ignoresMonsterAbility", ability: "intangible" },
      },
      4: {
        name: "Sun God's Sacrifice Dagger",
        text: "Sun God's Sacrifice Dagger (1d6 dmg; +2 inside Sanctuaries).",
        grants: "weapon",
        fixedFormula: "1d6",
        effect: { kind: "flavor" },
      },
      5: {
        name: "Crocodile Sword",
        text: "Crocodile Sword (1d6+2 Damage).",
        grants: "weapon",
        fixedFormula: "1d6+2",
        effect: { kind: "flavor" },
      },
      6: {
        name: "Helmet of the Sun God",
        text: "Helmet of the Sun God.",
        grants: "armor",
        effect: { kind: "flavor" },
      },
    },
  },
  necropolis: {
    trap: {
      1: BLADE_TRAP,
      2: {
        text: "Raise 1d6 Skeleton Soldiers (4 HP; 2 dmg; Undead).",
        monsters: SKELETON_SOLDIERS_SWARM,
      },
      3: {
        text: "Raise 1d6 Skeleton Soldiers (4 HP; 2 dmg; Undead).",
        monsters: SKELETON_SOLDIERS_SWARM,
      },
      4: {
        text: "A cage falls on you. You are trapped and need to spend 1d6 torches to get out.",
        torchCostDice: { dice: 1, sides: 6 },
      },
      5: DART_TRAP,
      6: CLICK_NOTHING,
    },
    roomContent: {
      2: { text: "Empty sarcophagus with your name on it.", secretPassage: false },
      3: { text: "Several pots with dead plants.", secretPassage: false },
      4: { text: "Texts carved across the floor.", secretPassage: true },
      5: { text: "Human bones everywhere.", secretPassage: true },
      6: {
        text: "Bone pile and 1d6 coins on the floor.",
        secretPassage: false,
        reward: { kind: "coins", count: { dice: 1, sides: 6 } },
      },
      7: { text: "Sarcophagus with Chest inside.", secretPassage: false, hasChest: true },
      8: { text: "Various wooden coffins.", secretPassage: true },
      9: { text: "Skulls walls.", secretPassage: true },
      10: { text: "Dozens of melted candles everywhere.", secretPassage: true },
      11: { text: "Broken statue of a person.", secretPassage: true },
      12: {
        text: "Treasure Room with 2d6 Treasures.",
        secretPassage: false,
        reward: { kind: "treasures", count: { dice: 2, sides: 6 } },
      },
    },
    monsters: {
      2: { name: "Lich", hp: 22, damage: 6, abilities: ["necromancy", "undead"], count: 1 },
      3: { name: "Ghost King", hp: 10, damage: 4, abilities: ["intangible"], count: 1 },
      4: { name: "Bone Golem", hp: 20, damage: 5, abilities: ["undead"], count: 1 },
      5: { name: "Living Armor", hp: 8, damage: 3, abilities: [], count: 2 },
      6: {
        name: "Skeleton Soldiers",
        singularName: "Skeleton Soldier",
        hp: 4,
        damage: 2,
        abilities: ["undead"],
        count: 2,
      },
      7: null,
      8: null,
      9: { name: "Living Armor", hp: 8, damage: 3, abilities: [], count: 2 },
      10: { name: "Giant Spider", hp: 10, damage: 4, abilities: ["paralyze"], count: 1 },
      11: {
        name: "Giant Spiders",
        singularName: "Giant Spider",
        hp: 10,
        damage: 4,
        abilities: ["paralyze"],
        count: 2,
      },
      12: { name: "Queen of the Blade Hands", hp: 18, damage: 10, abilities: [], count: 1 },
    },
    // Necropolis's own Boss is a 3-dice combinator (dungeon.ts's resolveNecropolisBoss()), not a
    // flat table -- `boss` is deliberately omitted (see DungeonTypeTables' own doc comment).
    treasure: {
      1: { text: "Mana Potion (Recovers all Spells).", effect: { kind: "restoreAllSpells" } },
      2: { text: "Health Potion (Recovers all HP).", effect: { kind: "healAll" } },
      3: MAGIC_SCROLL,
      4: VALUABLE_JEWEL,
      5: {
        text: "Roll on the Wonders table.",
        effect: { kind: "rerollColumn", column: "wonders" },
      },
      6: {
        text: "Roll on the Magic Item table.",
        effect: { kind: "rerollColumn", column: "magicItem" },
      },
    },
    weapon: {
      1: { name: "Bone Shard", formula: "1d6-1" },
      2: { name: "Rusted Sword", formula: "1d6" },
      3: { name: "Grave Digger's Shovel", formula: "1d6" },
      4: { name: "Sacrificial Blade", formula: "1d6+1" },
      5: { name: "Skeletal Claymore", formula: "1d6+1" },
      6: { name: "Executioner's Axe", formula: "1d6+3", twoHanded: true },
    },
    wonders: {
      1: {
        name: "Crown of the Beheaded Prince",
        text: "Crown of the Beheaded Prince (Don't die in blade traps).",
        effect: { kind: "flavor" },
      },
      2: {
        name: "Luck Potion",
        text: "Luck Potion (Ignores the next activated Trap).",
        effect: { kind: "trapImmunity" },
      },
      3: {
        name: "Fury Potion",
        text: "Fury Potion (+2 damage until the end of the fight).",
        effect: { kind: "combatDamageBonus", amount: 2 },
      },
      4: {
        name: "Sapphire of Magic",
        text: "Sapphire of Magic (Learn a Random Basic Spell).",
        effect: { kind: "randomSpell" },
      },
      5: {
        name: "Durability Ruby",
        text: "Durability Ruby (Attach to an armor for +2 HP).",
        effect: { kind: "flavor" },
      },
      6: {
        name: "Enchantment Ruby",
        text: "Enchantment Ruby (Attach to Armor for +1 Damage).",
        effect: { kind: "flavor" },
      },
    },
    magicItem: {
      1: {
        name: "Fool's Potion",
        text: "Fool's Potion (Learn 3 Random Basic Spells).",
        grants: "weapon", // unused -- grantsSpells short-circuits before any roll
        grantsSpells: 3,
        effect: { kind: "flavor" },
      },
      2: {
        name: "Dwarf King's Helm",
        text: "Dwarf King's Helm (11 HP).",
        grants: "armor",
        fixedArmor: { piece: "helm", maxHp: 11 },
        effect: { kind: "flavor" },
      },
      3: {
        name: "Breastplate of the Little Ones",
        text: "Breastplate of the Little Ones (13 HP).",
        grants: "armor",
        fixedArmor: { piece: "breastplate", maxHp: 13 },
        effect: { kind: "flavor" },
      },
      4: {
        name: "Scythe of Destruction",
        text: "Scythe of Destruction (1d6+2 Damage).",
        grants: "weapon",
        fixedFormula: "1d6+2",
        effect: { kind: "flavor" },
      },
      5: {
        name: "Vampiric Trident",
        text: "Vampiric Trident (1d6+2 Damage; Two-handed; Restores 1 HP with each attack).",
        grants: "weapon",
        fixedFormula: "1d6+2",
        twoHanded: true,
        effect: { kind: "lifesteal", amount: 1 },
      },
      6: {
        name: "Vorpal Battle Ax",
        text: "Vorpal Battle Ax (1d6+1 Damage; Kills instantly on the '6').",
        grants: "weapon",
        fixedFormula: "1d6+1",
        effect: { kind: "instantKillOnRoll", roll: 6 },
      },
    },
    bossBonusLoot: {
      1: {
        kind: "trinket",
        name: "Magic Stone Dog",
        grantsHp: 4,
        effect: { kind: "weaponDamageBonus", amount: 2 },
      },
      2: {
        kind: "weapon",
        name: "Dagger of Souls",
        formula: "1d6-1",
      },
      3: {
        kind: "armor",
        name: "Giant King's Shoulderpads",
        piece: "shoulderpads",
        maxHp: 10,
      },
      4: {
        kind: "armor",
        name: "Monster Tamer Boots",
        piece: "boots",
        maxHp: 6,
      },
      5: {
        kind: "weapon",
        name: "Halberd of the Infernal Soldiers",
        formula: "1d6+4",
        twoHanded: true,
      },
      6: {
        kind: "weapon",
        name: "Sword of the Nameless Gods",
        formula: "1d6+4",
        bonusEffect: { kind: "lifesteal", amount: 1 },
      },
    },
  },

  /** Sewers (issue #30, rules 1809-1907). The one dungeon type with **no Boss and no Final Room** --
   * `boss` is omitted entirely (the field is optional; Necropolis is the only other type without
   * one, and that's because it builds its Boss from a combinator instead). A Sewers run is finished
   * by climbing out: Room Content 10's metal ladder, see `RoomContentEntry.isExit`.
   *
   * Its printed Armor table is byte-for-byte the shared `ARMOR_TABLE`, so unlike Pyramid there's no
   * deviation to document here. */
  sewers: {
    trap: {
      1: BLADE_TRAP,
      2: { text: "An explosion! (4 damage).", damage: 4 },
      3: { text: "Gust of acid (3 damage).", damage: 3 },
      4: DART_TRAP,
      5: CLICK_NOTHING,
      6: CLICK_NOTHING,
    },
    roomContent: {
      // "Spend 1 torch to leave the room" has no hook: nothing models *leaving* a room as an action
      // with a cost, so this is flavor -- the same tier as `bladeTrap`'s roll-of-2.
      2: { text: "It's all flooded. Spend 1 torch to leave the room.", secretPassage: false },
      3: { text: "Destroyed closet with a Chest inside.", secretPassage: false, hasChest: true },
      4: { text: "Destroyed furniture. It may have Secret Passage.", secretPassage: true },
      // The per-crate investigation loop (8 crates, each a trap-or-treasure roll) has no UI to
      // drive it and no existing shape -- flavor, documented rather than invented.
      5: {
        text: "8 stacked crates. If you investigate roll 1 dice for each. If '1', it activates a Trap. If '5' or more, you have found 1 Treasure.",
        secretPassage: false,
      },
      6: {
        text: "Trash pile with a Treasure inside.",
        secretPassage: false,
        reward: { kind: "treasures", count: 1 },
      },
      7: { text: "Dirt everywhere. It may have Secret Passage.", secretPassage: true },
      8: {
        text: "A dirty bed and a sign of a recent fire. It may have Secret Passage.",
        secretPassage: true,
      },
      9: {
        text: "Trash pile with a Treasure inside.",
        secretPassage: false,
        reward: { kind: "treasures", count: 1 },
      },
      10: { text: "A metal ladder leads to the surface.", secretPassage: false, isExit: true },
      // The Laboratory dungeon type isn't built (the rest of #30) -- flavor until it is.
      11: {
        text: "A trapdoor that leads to a Laboratory. It is sealed shut.",
        secretPassage: false,
      },
      12: { text: "A lost Chest.", secretPassage: false, hasChest: true },
    },
    monsters: {
      2: { name: "Rat swarm", hp: 20, damage: 2, abilities: ["regeneration"], count: 1 },
      3: { name: "Cockroaches swarm", hp: 26, damage: 1, abilities: ["regeneration"], count: 1 },
      4: GOBLINS,
      5: { name: "Sewer Worm", hp: 10, damage: 3, abilities: ["poison"], count: 1 },
      6: {
        name: "Giant Rats",
        singularName: "Giant Rat",
        hp: 2,
        damage: 1,
        abilities: [],
        count: { dice: 1, sides: 6 },
      },
      9: { name: "Trash Golem", hp: 15, damage: 4, abilities: ["weakness"], count: 1 },
      10: {
        name: "Bandits",
        singularName: "Bandit",
        hp: 5,
        damage: 2,
        abilities: ["loot"],
        count: 4,
      },
      11: {
        name: "Walking Slime",
        hp: 10,
        damage: 1,
        abilities: ["loot", "regeneration"],
        count: 1,
      },
      12: { name: "Giant Crocodile", hp: 30, damage: 5, abilities: [], count: 1 },
    },
    treasure: {
      1: { text: "1d6 Torches.", effect: { kind: "grantTorchesRoll", dice: 1, sides: 6 } },
      2: HEALTH_POTION,
      3: MAGIC_SCROLL,
      4: {
        text: "Lost jewel (worth 2d6 Coins in the town).",
        effect: { kind: "heldValueRoll", name: "Lost jewel", dice: 2, sides: 6, multiplier: 1 },
      },
      5: {
        text: "[Roll in the 'Wonders' column]",
        effect: { kind: "rerollColumn", column: "wonders" },
      },
      6: {
        text: "[Roll in the 'Magic Item' column]",
        effect: { kind: "rerollColumn", column: "magicItem" },
      },
    },
    weapon: {
      1: { name: "Broken Pipe", formula: "1d6-1" },
      2: { name: "Sword", formula: "1d6" },
      3: { name: "Wrench", formula: "1d6" },
      4: { name: "Long Fork", formula: "1d6" },
      5: { name: "Spear", formula: "1d6+1", twoHanded: true },
      6: { name: "Maul", formula: "1d6+2", twoHanded: true },
    },
    wonders: {
      1: { name: "Perfume", text: "Perfume (It won't stink anymore).", effect: { kind: "flavor" } },
      2: {
        name: "Potty",
        text: "Potty (It's like a Helm; 3 HP).",
        grantsHp: 3,
        effect: { kind: "flavor" },
      },
      // "Makes monsters open the door" / "Goblins flee on hearing" both need a monster-behavior
      // system this codebase doesn't have -- flavor, same tier as the Tiger's dungeon-presence rule.
      3: { name: "Bell", text: "Bell (Makes monsters open the door).", effect: { kind: "flavor" } },
      4: {
        name: "Goblin Whistle",
        text: "Goblin Whistle (Goblins flee on hearing).",
        effect: { kind: "flavor" },
      },
      5: {
        name: "Master key",
        text: "Master key (Open any door).",
        effect: { kind: "opensAnyLock" },
      },
      6: {
        name: "Rusty Glaive",
        text: "Rusty Glaive (Two-handed; 1d6+3 Damage).",
        grantsWeapon: { name: "Rusty Glaive", formula: "1d6+3", twoHanded: true },
        effect: { kind: "flavor" },
      },
    },
    magicItem: {
      // The two Cursed rows are the first negative rewards in the game. Tetanus Armor's "-2 HP" is
      // applied as a real penalty via `extraHp`; the Ring of Bad Luck's "reroll the 6" needs an
      // attack-reroll hook that doesn't exist, so it stays flavor.
      1: {
        name: "Tetanus",
        grants: "armor",
        text: "Tetanus [Armor] (Cursed; -2 HP).",
        effect: { kind: "extraHp", amount: -2 },
      },
      2: {
        name: "Ring of Bad Luck",
        grants: "armor",
        text: "Ring of Bad Luck (Cursed; Reroll the '6' on attacks).",
        effect: { kind: "flavor" },
      },
      3: {
        name: "Hamelin flute",
        grants: "armor",
        text: "Hamelin flute (Rats, worms and insects flee).",
        effect: { kind: "flavor" },
      },
      4: {
        name: "of the Rat Swarm",
        grants: "armor",
        text: "[Armor] of the Rat Swarm (+1 HP, but it stinks).",
        effect: { kind: "extraHp", amount: 1 },
      },
      5: {
        name: "of the Fly",
        grants: "weapon",
        text: "[Weapon] of the Fly (+1 against Swarms).",
        effect: { kind: "damageBonusVsTag", tags: ["swarm"], amount: 1 },
      },
      6: {
        name: "Tetanus",
        grants: "weapon",
        text: "Tetanus [Weapon] (+3 against humanoids).",
        effect: { kind: "damageBonusVsTag", tags: ["goblin", "bandit", "orc"], amount: 3 },
      },
    },
  },

  /** Laboratory (issue #30, rules 2230-2336). Two things make it structurally distinct: its third
   * Reward column is **Potions** rather than Magic Item, and its Special Rule -- "any hero or
   * creature that leaves this dungeon will mutate" -- is the first effect in the game that fires on
   * *leaving* a dungeon rather than inside it (see `src/data/mutations.ts`). */
  laboratory: {
    trap: {
      // "A blade cuts off one of your hands" -- the same shape as the shared Blade Trap's roll-of-2
      // arm loss, and flavor-only for the same reason: there is no hand economy (see #100).
      1: { text: "A blade cuts off one of your hands." },
      2: {
        text: "Acid squirts from the ceiling, destroying a piece of armor you're wearing.",
        destroysArmor: true,
      },
      3: { text: "You fall into a hole with stakes (3 damage).", damage: 3 },
      4: {
        text: "Emerges a Killer Blob (9 HP; 3 dmg; Regen).",
        monsters: { name: "Killer Blob", hp: 9, damage: 3, abilities: ["regeneration"], count: 1 },
      },
      5: CLICK_NOTHING,
      6: CLICK_NOTHING,
    },
    roomContent: {
      2: {
        text: "Cabinets with bodies of dead creatures stuffed or in glass jars. It may have Secret Passage.",
        secretPassage: true,
      },
      3: { text: "Table with a dry human body. It may have Secret Passage.", secretPassage: true },
      4: {
        text: "Three cells with dead animals. It may have Secret Passage.",
        secretPassage: true,
      },
      5: {
        text: "Wardrobe with 1d6 Treasures.",
        secretPassage: false,
        reward: { kind: "treasures", count: { dice: 1, sides: 6 } },
      },
      6: { text: "Large library of alchemy books.", secretPassage: false },
      7: {
        text: "Large table with 1d6 Treasures.",
        secretPassage: false,
        reward: { kind: "treasures", count: { dice: 1, sides: 6 } },
      },
      8: { text: "Table with some books and notes.", secretPassage: false },
      // "If you drink, roll on the Potion table" -- an optional action with its own sub-roll and no UI
      // to drive it, so flavor for now, same call the Sewers' 8-crate investigation gets.
      9: {
        text: "Large cauldron with strange liquid. If you drink, roll on the Potion table.",
        secretPassage: false,
      },
      10: {
        text: "Well covered by garbage and 1 treasure.",
        secretPassage: false,
        reward: { kind: "treasures", count: 1 },
      },
      11: {
        text: "Table with various kitchen items. It may have Secret Passage.",
        secretPassage: true,
      },
      12: {
        text: "Room with a crown under the bed and a Chest.",
        secretPassage: false,
        hasChest: true,
      },
    },
    monsters: {
      2: { name: "Sewn Ogre", hp: 40, damage: 3, abilities: ["undead", "weakness"], count: 1 },
      3: { name: "Floating Evil Eye", hp: 20, damage: 2, abilities: ["paralyze"], count: 1 },
      4: {
        name: "Toxic Zombies",
        singularName: "Toxic Zombie",
        hp: 4,
        damage: 3,
        abilities: ["undead", "poison"],
        count: 2,
      },
      5: { name: "Toxic Zombie", hp: 4, damage: 3, abilities: ["undead", "poison"], count: 1 },
      6: {
        name: "Living Chairs",
        singularName: "Living Chair",
        hp: 2,
        damage: 1,
        abilities: [],
        count: { dice: 1, sides: 6 },
      },
      7: null,
      8: null,
      9: { name: "Killer Blob", hp: 9, damage: 3, abilities: ["regeneration"], count: 1 },
      10: {
        name: "Mutant Rats",
        singularName: "Mutant Rat",
        hp: 6,
        damage: 3,
        abilities: [],
        count: 3,
      },
      11: {
        name: "Toxic Hounds",
        singularName: "Toxic Hound",
        hp: 5,
        damage: 3,
        abilities: ["poison"],
        count: 3,
      },
      12: { name: "Aberration", hp: 29, damage: 4, abilities: ["weakness"], count: 1 },
    },
    treasure: {
      1: { text: "Mana Potion (Recovers all Spells).", effect: { kind: "restoreAllSpells" } },
      2: HEALTH_POTION,
      3: MAGIC_SCROLL,
      4: {
        text: "Bottle with Gold Powder (worth 20 coins in the town).",
        effect: { kind: "heldValue", name: "Bottle of Gold Powder", amount: 20 },
      },
      5: {
        text: "[Roll in the 'Wonders' column]",
        effect: { kind: "rerollColumn", column: "wonders" },
      },
      6: {
        text: "[Roll in the 'Potions' column]",
        effect: { kind: "rerollColumn", column: "potions" },
      },
    },
    // Laboratory prints no Weapon table of its own; the Alchemist King's Sword in its Wonders column
    // is the only weapon it grants, so this falls back to the Palace's for any base-table roll.
    weapon: {
      1: { name: "Dagger", formula: "1d6-1" },
      2: { name: "Sword", formula: "1d6" },
      3: { name: "Mace", formula: "1d6" },
      4: { name: "Axe", formula: "1d6" },
      5: { name: "Spear", formula: "1d6+1", twoHanded: true },
      6: { name: "Great Sword", formula: "1d6+2", twoHanded: true },
    },
    wonders: {
      // "You appear anywhere in the world" is the Portal table's roll-11 picker (issue #21) in potion
      // form, but nothing outside a portal can open that picker yet -- flavor, documented.
      1: {
        name: "Distant Place Potion",
        text: "Distant Place Potion (You appear anywhere in the world).",
        effect: { kind: "flavor" },
      },
      // No Cursed-item removal exists to hook; the two Cursed items shipped in Sewers are the only
      // ones, and nothing tracks "cursed" as a state.
      2: {
        name: "Purification Potion",
        text: "Purification Potion (remove a Cursed item).",
        effect: { kind: "flavor" },
      },
      // "Load up to 3 potions" is a carry-capacity rule with no potion inventory to apply it to.
      3: {
        name: "Leather breastplate",
        text: "Leather breastplate (6 HP; Load up to 3 potions).",
        grantsHp: 6,
        effect: { kind: "flavor" },
      },
      4: {
        name: "Alchemist's Mask",
        text: "Alchemist's Mask (3 HP).",
        grantsHp: 3,
        effect: { kind: "flavor" },
      },
      5: {
        name: "Alchemist King's Sword",
        text: "Alchemist King's Sword (1d6 Damage; +3 if it has Poison).",
        grantsWeapon: { name: "Alchemist King's Sword", formula: "1d6" },
        effect: { kind: "flavor" },
      },
      6: {
        name: "Philosophical Stone",
        text: "Philosophical Stone (Talking Stone; doesn't shut up).",
        effect: { kind: "flavor" },
      },
    },
    // Laboratory's third Reward column is Potions, not Magic Item -- it prints no Magic Item table
    // at all, so this falls back to the Palace's, exactly like `weapon` above. Unreachable today by
    // construction (nothing in Laboratory's own tables redirects to "magicItem"), but the field is
    // required and a plausible table beats an invented one.
    magicItem: {
      1: {
        name: "[Armor] of Royalty",
        text: "[Armor] of Royalty (It is very elegant).",
        grants: "armor",
        effect: { kind: "flavor" },
      },
      2: {
        name: "Leprechaun's [Armor]",
        text: "Leprechaun's [Armor] (Earn double coins in chests).",
        grants: "armor",
        effect: { kind: "doubleChestCoins" },
      },
      3: {
        name: "Centurion's [Armor]",
        text: "Centurion's [Armor] (+1 HP).",
        grants: "armor",
        effect: { kind: "extraHp", amount: 1 },
      },
      4: {
        name: "[Weapon] of Destruction",
        text: "[Weapon] of Destruction (Deals +2 damage).",
        grants: "weapon",
        effect: { kind: "weaponDamageBonus", amount: 2 },
      },
      5: {
        name: "[Weapon] of War",
        text: "[Weapon] of War (Deals +2 damage to Angels).",
        grants: "weapon",
        effect: { kind: "damageBonusVsTag", tags: ["angel"], amount: 2 },
      },
      6: {
        name: "[Weapon] of the Dragon Slayer",
        text: "[Weapon] of the Dragon Slayer (Double damage against Dragons).",
        grants: "weapon",
        effect: { kind: "damageMultiplierVsTag", tags: ["dragon"], multiplier: 2 },
      },
    },
    potions: {
      1: {
        name: "Mutation Potion",
        text: "Mutation Potion (roll in the Mutation table).",
        effect: { kind: "flavor" },
        rollsMutation: true,
      },
      2: {
        name: "Goblin Potion",
        text: "Goblin Potion (visually transforms into goblin).",
        effect: { kind: "flavor" },
      },
      // "If dies, returns with 1 HP max" -- a revive-on-death, distinct from the Mutation table's own
      // zombie row (which returns you with *half* max HP, halving each time). Left flavor: the
      // mutation version is the one the Special Rule makes reachable, and two subtly different
      // revive rules would be worse than one.
      3: {
        name: "Zombie Potion",
        text: "Zombie Potion (if dies, returns with 1 HP max).",
        effect: { kind: "flavor" },
      },
      4: {
        name: "Luminescence Potion",
        text: "Luminescence Potion (equal to 2 torches).",
        effect: { kind: "grantsTorches", amount: 2 },
      },
      5: {
        name: "Extra Hand Potion",
        text: "Extra Hand Potion (Create a new arm).",
        effect: { kind: "flavor" },
      },
      6: {
        name: "Fool's Potion",
        text: "Fool's Potion (Learn 3 Random Basic Spells).",
        effect: { kind: "randomSpell" },
      },
    },
    boss: {
      1: {
        name: "Undead Alchemist King",
        hp: 20,
        damage: 5,
        abilities: ["undead", "poison"],
        count: 1,
      },
      2: {
        name: "Alchemical Abomination",
        hp: 50,
        damage: 3,
        abilities: ["poison", "paralyze"],
        count: 1,
      },
      3: {
        name: "Explosive Blob",
        hp: 60,
        damage: 2,
        abilities: ["poison", "explosive"],
        count: 1,
      },
      4: { name: "Toxic Beast", hp: 40, damage: 3, abilities: ["poison"], count: 1 },
      5: { name: "Flammable Monster", hp: 35, damage: 4, abilities: ["firebreath"], count: 1 },
      6: {
        name: "Undead Alchemist King",
        hp: 30,
        damage: 5,
        abilities: ["undead", "poison"],
        count: 1,
      },
    },
  },
};
