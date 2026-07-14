import type { DungeonTypeKey } from "./dungeonTypes.ts";

export interface RoomContentEntry {
  text: string;
  secretPassage: boolean;
  /** True for rows describing an actual Chest to open (see the "Open a Chest" dungeon action). */
  hasChest?: boolean;
}

export interface TrapEntry {
  text: string;
  /** Set for traps that mechanically cost torches (e.g. the ditch trap) rather than being flavor-only. */
  torchCost?: number;
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
  name: string;
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
  | { kind: "healAll" }
  | { kind: "restoreAllSpells" }
  | { kind: "randomSpell" }
  | { kind: "rerollColumn"; column: "wonders" | "magicItem" | "weapon" }
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
export type ArmorPieceKind = "ring" | "bracelets" | "boots" | "shoulderpads" | "helm" | "breastplate" | "wonderItem";

export const ARMOR_PIECE_LABELS: Record<ArmorPieceKind, string> = {
  ring: "Ring",
  bracelets: "Bracelets",
  boots: "Boots",
  shoulderpads: "Shoulderpads",
  helm: "Helm",
  breastplate: "Breastplate",
  wonderItem: "Trinket",
};

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
   * other consciously-deferred rules -- see the stub list in CLAUDE.md). */
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
  | { kind: "flavor" };

export interface WonderEntry {
  name: string;
  text: string;
  /** Set only for Wonders that are themselves a wearable item with its own HP (e.g. "Jester Hat
   * (2 HP)") -- granted as a `"wonderItem"` ArmorPiece, not rolled on the Armor table. */
  grantsHp?: number;
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
}

export interface DungeonTypeTables {
  /** Table: Trap (1d6). Row 1 is identical across all types. */
  trap: Record<number, TrapEntry>;
  /** Table: Room Content (2d6). */
  roomContent: Record<number, RoomContentEntry>;
  /** Table: Monsters (2d6). Rows 7 and 8 are both null ("no monsters in this room"). */
  monsters: Record<number, MonsterTemplate | null>;
  /** Table: Boss (1d6). Rolled once when the Final Room is placed; no Content/Monsters roll alongside it. */
  boss: Record<number, MonsterTemplate>;
  /** Table: Reward (1d6), "Treasure" column. */
  treasure: Record<number, RewardOutcome>;
  /** Table: Weapon (1d6). */
  weapon: Record<number, WeaponEntry>;
  /** Table: Reward's "Wonders" column (1d6). */
  wonders: Record<number, WonderEntry>;
  /** Table: Reward's "Magic Item" column (1d6). */
  magicItem: Record<number, MagicItemEntry>;
}

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
    case "extraHp":
    case "flavor":
      return null;
  }
}

const BLADE_TRAP: TrapEntry = {
  text: "A blade falls from the ceiling. Roll the dice. On a 2 you lose one of your arms and on a 1 you die.",
};
const CLICK_NOTHING: TrapEntry = { text: "You hear a click, but nothing happens." };
const DITCH_TRAP: TrapEntry = { text: "You fall into a ditch (spend 1 torch to go out).", torchCost: 1 };

// Table: Reward, "Treasure" column -- these five rows repeat, word-for-word or in spirit,
// across every Core Book dungeon type; only the "worth N Coins" row (and Tomb's Mana Potion
// row 1) actually varies per type.
const HEALTH_POTION: RewardOutcome = { text: "Health Potion (Recovers all HP).", effect: { kind: "healAll" } };
const MAGIC_SCROLL: RewardOutcome = {
  text: "Magic Scroll (a random Basic Spell, 1 use).",
  effect: { kind: "randomSpell" },
};
const VALUABLE_JEWEL: RewardOutcome = {
  text: "Valuable jewel (worth 2d6 x 10 Coins in the town).",
  effect: { kind: "heldValueRoll", name: "Valuable jewel", dice: 2, sides: 6, multiplier: 10 },
};
export const DUNGEON_TABLES: Record<DungeonTypeKey, DungeonTypeTables> = {
  palace: {
    trap: {
      1: BLADE_TRAP,
      2: { text: "Acid Spout (5 Damage)." },
      3: DITCH_TRAP,
      4: { text: "A dart hits you (1 Damage)." },
      5: CLICK_NOTHING,
      6: CLICK_NOTHING,
    },
    roomContent: {
      2: { text: "Dust-filled library.", secretPassage: true },
      3: { text: "Destroyed kitchen with 1d6 coins on the floor.", secretPassage: false },
      4: { text: "Large table with a few chairs.", secretPassage: true },
      5: { text: "Bookshelf with 1d6 Magic Scrolls.", secretPassage: false },
      6: { text: "Desk with a Chest.", secretPassage: false, hasChest: true },
      7: { text: "Dirt everywhere.", secretPassage: true },
      8: { text: "Bed with a Chest on the side.", secretPassage: false, hasChest: true },
      9: { text: "Garden covered by plants.", secretPassage: true },
      10: { text: "Trash deposit.", secretPassage: true },
      11: { text: "Large table with papers and maps.", secretPassage: true },
      12: { text: "Armory. 2d6 Magic Items.", secretPassage: false },
    },
    monsters: {
      2: { name: "Minotaur", hp: 14, damage: 7, abilities: [], count: 1 },
      3: { name: "Orcs", hp: 6, damage: 3, abilities: ["loot"], count: 2 },
      4: { name: "Orc", hp: 6, damage: 3, abilities: ["loot"], count: 1 },
      5: { name: "Giant Rats", hp: 2, damage: 1, abilities: [], count: { dice: 1, sides: 6 } },
      6: { name: "Goblins", hp: 3, damage: 1, abilities: ["explosive"], count: { dice: 1, sides: 6 } },
      7: null,
      8: null,
      9: { name: "Living Armor", hp: 8, damage: 3, abilities: [], count: 2 },
      10: { name: "Fungoid", hp: 4, damage: 2, abilities: ["loot", "regeneration"], count: 3 },
      11: { name: "Bone Golem", hp: 12, damage: 5, abilities: ["undead"], count: 1 },
      12: { name: "Walking Slime", hp: 10, damage: 1, abilities: ["loot", "regeneration"], count: 1 },
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
      1: { text: "Ornament (worth 5 Coins in the town).", effect: { kind: "heldValue", name: "Ornament", amount: 5 } },
      2: HEALTH_POTION,
      3: MAGIC_SCROLL,
      4: VALUABLE_JEWEL,
      5: { text: "Roll on the Wonders table.", effect: { kind: "rerollColumn", column: "wonders" } },
      6: { text: "Roll on the Magic Item table.", effect: { kind: "rerollColumn", column: "magicItem" } },
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
      2: { text: "Acid Spout (5 Damage)." },
      3: { text: "Appears 1d6 Bats (1 HP; 1 Damage; Poison)." },
      4: CLICK_NOTHING,
      5: CLICK_NOTHING,
      6: CLICK_NOTHING,
    },
    roomContent: {
      2: { text: "Tombstone carved with your name.", secretPassage: false },
      3: { text: "Several pots with dead plants.", secretPassage: false },
      4: { text: "Texts sculpted on the floor.", secretPassage: true },
      5: { text: "Human bones everywhere.", secretPassage: true },
      6: { text: "A pile of bones and 1d6 coins.", secretPassage: false },
      7: { text: "Casket with Chest inside.", secretPassage: false, hasChest: true },
      8: { text: "Various wooden coffins.", secretPassage: true },
      9: { text: "Walls made of skulls.", secretPassage: true },
      10: { text: "Dozens of burned candles everywhere.", secretPassage: true },
      11: { text: "Broken statue of a forgotten person.", secretPassage: true },
      12: { text: "Treasure room with 2d6 Treasures.", secretPassage: false },
    },
    monsters: {
      2: { name: "Vampire Servant", hp: 9, damage: 4, abilities: ["regeneration"], count: 1 },
      3: { name: "Giant Leech", hp: 12, damage: 5, abilities: [], count: 1 },
      4: { name: "Skeletons", hp: 4, damage: 1, abilities: ["undead"], count: 3 },
      5: { name: "Ghoul", hp: 6, damage: 3, abilities: ["regeneration"], count: 1 },
      6: { name: "Goblins", hp: 3, damage: 1, abilities: ["explosive"], count: { dice: 1, sides: 6 } },
      7: null,
      8: null,
      9: { name: "Bats", hp: 1, damage: 1, abilities: ["poison"], count: { dice: 1, sides: 6 } },
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
      5: { text: "Roll on the Wonders table.", effect: { kind: "rerollColumn", column: "wonders" } },
      6: { text: "Roll on the Magic Item table.", effect: { kind: "rerollColumn", column: "magicItem" } },
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
        effect: { kind: "flavor" },
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
      2: { text: "Raise 1d6 Skeleton Soldiers (4 HP; 2 Damage; Undead)." },
      3: { text: "Raise 1d6 Skeleton Soldiers (4 HP; 2 Damage; Undead)." },
      4: { text: "Raise 1 Skeleton (3 HP; 1 Damage; Undead)." },
      5: CLICK_NOTHING,
      6: CLICK_NOTHING,
    },
    roomContent: {
      2: { text: "Empty sarcophagus with your name.", secretPassage: false },
      3: { text: "Several pots with dead plants.", secretPassage: false },
      4: { text: "Texts sculpted on the floor.", secretPassage: true },
      5: { text: "Human bones everywhere.", secretPassage: true },
      6: { text: "Pile of bones and 1d6 coins.", secretPassage: false },
      7: { text: "Sarcophagus with Chest inside.", secretPassage: false, hasChest: true },
      8: { text: "Several wooden coffins.", secretPassage: true },
      9: { text: "Walls made of skulls.", secretPassage: true },
      10: { text: "A destroyed sarcophagus.", secretPassage: true },
      11: { text: "Broken statue of a hero.", secretPassage: true },
      12: { text: "Treasure Room with 2d6 Treasures.", secretPassage: false },
    },
    monsters: {
      2: { name: "Ghost of the Prince", hp: 6, damage: 4, abilities: ["intangible"], count: 1 },
      3: { name: "Bone Golem", hp: 12, damage: 5, abilities: ["undead"], count: 1 },
      4: { name: "Skeleton Soldiers", hp: 4, damage: 2, abilities: ["undead"], count: 2 },
      5: { name: "Living Armor", hp: 8, damage: 3, abilities: [], count: 1 },
      6: { name: "Goblins", hp: 3, damage: 1, abilities: ["explosive"], count: { dice: 1, sides: 6 } },
      7: null,
      8: null,
      9: { name: "Scorpions", hp: 2, damage: 1, abilities: ["poison"], count: { dice: 1, sides: 6 } },
      10: { name: "Living Armor", hp: 8, damage: 3, abilities: [], count: 2 },
      11: { name: "Fungoid", hp: 4, damage: 2, abilities: ["loot", "regeneration"], count: 3 },
      12: { name: "Giant Spider", hp: 10, damage: 4, abilities: ["paralyze"], count: 1 },
    },
    boss: {
      1: { name: "Emperor Scorpio", hp: 20, damage: 3, abilities: ["poison"], count: 1 },
      2: { name: "Skeleton King", hp: 12, damage: 7, abilities: ["undead"], count: 1 },
      3: { name: "Queen of Bladed Hands", hp: 11, damage: 10, abilities: [], count: 1 },
      4: { name: "Ghost King of the Lost Swamp", hp: 10, damage: 4, abilities: ["intangible"], count: 1 },
      5: { name: "Necrotic Kings", hp: 4, damage: 1, abilities: ["undead"], count: 7 },
      6: { name: "Lich King of the Ethernal Wars", hp: 22, damage: 6, abilities: ["necromancy", "undead"], count: 1 },
    },
    treasure: {
      1: { text: "Mana Potion (Recovers all Spells).", effect: { kind: "restoreAllSpells" } },
      2: HEALTH_POTION,
      3: MAGIC_SCROLL,
      4: VALUABLE_JEWEL,
      5: { text: "Roll on the Wonders table.", effect: { kind: "rerollColumn", column: "wonders" } },
      6: { text: "Roll on the Magic Item table.", effect: { kind: "rerollColumn", column: "magicItem" } },
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
      2: { text: "Spears come out of the ground (5 Damage)." },
      3: DITCH_TRAP,
      4: CLICK_NOTHING,
      5: CLICK_NOTHING,
      6: CLICK_NOTHING,
    },
    roomContent: {
      2: { text: "A magic circle on the floor.", secretPassage: false },
      3: { text: "10 chairs lined up.", secretPassage: false },
      4: { text: "Torture Room with 1d6 Treasures.", secretPassage: false },
      5: { text: "Creature or deity statues.", secretPassage: true },
      6: { text: "Corpse with 1 Treasure.", secretPassage: false },
      7: { text: "Large Chest on an altar.", secretPassage: false, hasChest: true },
      8: { text: "Small altar with 1d6 coins.", secretPassage: true },
      9: { text: "2d6 paintings of gods (2 coins each).", secretPassage: true },
      10: { text: "Melted candles everywhere.", secretPassage: true },
      11: { text: "Fountain with running water.", secretPassage: true },
      12: { text: "Shelves with 1d6 Treasures.", secretPassage: false },
    },
    monsters: {
      2: { name: "Wisp", hp: 2, damage: 1, abilities: [], count: 8 },
      3: { name: "Fungoid", hp: 4, damage: 2, abilities: ["loot", "regeneration"], count: 3 },
      4: { name: "Warrior Angels", hp: 4, damage: 2, abilities: [], count: 3 },
      5: { name: "Sentinel Angel", hp: 5, damage: 3, abilities: ["sorcery"], count: 1 },
      6: { name: "Goblins", hp: 3, damage: 1, abilities: ["explosive"], count: { dice: 1, sides: 6 } },
      7: null,
      8: null,
      9: { name: "Orcs", hp: 6, damage: 3, abilities: ["loot"], count: 2 },
      10: { name: "Giant Angel Statue", hp: 10, damage: 5, abilities: ["stoneskin"], count: 1 },
      11: { name: "Giant Spider", hp: 10, damage: 4, abilities: ["paralyze"], count: 1 },
      12: { name: "Fallen Angel of Putrification", hp: 21, damage: 4, abilities: ["poison"], count: 1 },
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
      5: { text: "Roll on the Wonders table.", effect: { kind: "rerollColumn", column: "wonders" } },
      6: { text: "Roll on the Magic Item table.", effect: { kind: "rerollColumn", column: "magicItem" } },
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
        effect: { kind: "flavor" },
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
      2: { text: "A giant hammer comes out of the ceiling (5 Damage)." },
      3: DITCH_TRAP,
      4: { text: "A dart hits you (1 Damage)." },
      5: CLICK_NOTHING,
      6: CLICK_NOTHING,
    },
    roomContent: {
      2: { text: "A magic circle on the floor.", secretPassage: false },
      3: { text: "Bottomless pit.", secretPassage: false },
      4: { text: "Torture Room with 1d6 Treasures.", secretPassage: false },
      5: { text: "Unknown creature statues.", secretPassage: true },
      6: { text: "Corpse with 1 Treasure.", secretPassage: false },
      7: { text: "Chest surrounded by melted candles.", secretPassage: false, hasChest: true },
      8: { text: "Small altar with 1d6 coins.", secretPassage: true },
      9: { text: "2d6 paintings of demons (1 coin each).", secretPassage: true },
      10: { text: "Carcasses of giant snakes.", secretPassage: true },
      11: { text: "Dry fountain.", secretPassage: true },
      12: { text: "Desk with 1d6 Treasures in the drawers.", secretPassage: false },
    },
    monsters: {
      2: { name: "Imps", hp: 2, damage: 1, abilities: [], count: { dice: 2, sides: 6 } },
      3: { name: "Fungoid", hp: 4, damage: 2, abilities: ["loot", "regeneration"], count: 3 },
      4: { name: "Cultists", hp: 4, damage: 1, abilities: [], count: { dice: 1, sides: 6 } },
      5: { name: "Serpents", hp: 2, damage: 1, abilities: ["poison"], count: { dice: 1, sides: 6 } },
      6: { name: "Goblins", hp: 3, damage: 1, abilities: ["explosive"], count: { dice: 1, sides: 6 } },
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
      5: { text: "Roll on the Wonders table.", effect: { kind: "rerollColumn", column: "wonders" } },
      6: { text: "Roll on the Magic Item table.", effect: { kind: "rerollColumn", column: "magicItem" } },
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
        effect: { kind: "flavor" },
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
      2: { text: "Stones collapse from the ceiling (5 Damage)." },
      3: DITCH_TRAP,
      4: { text: "A dart hits you (1 Damage)." },
      5: CLICK_NOTHING,
      6: CLICK_NOTHING,
    },
    roomContent: {
      2: { text: "A cell with the skeleton of a childhood friend.", secretPassage: true },
      3: { text: "Large table with papers and confessions signed in blood.", secretPassage: false },
      4: { text: "Six cages hanging on the ceiling.", secretPassage: true },
      5: { text: "Shelf of belongings with 1d6 Treasures.", secretPassage: false },
      6: { text: "Shackles on the walls and hanging bones.", secretPassage: false },
      7: { text: "Four empty cells.", secretPassage: true },
      8: { text: "Large cell with bones on all sides.", secretPassage: false },
      9: { text: "Torture bed.", secretPassage: true },
      10: { text: "Stack of coffins.", secretPassage: false },
      11: { text: "Slime covered wall.", secretPassage: true },
      12: { text: "Arsenal. 2d6 Magic Items.", secretPassage: false },
    },
    monsters: {
      2: { name: "Cave Troll", hp: 26, damage: 6, abilities: ["regeneration"], count: 1 },
      3: { name: "Orc Leader", hp: 10, damage: 3, abilities: ["loot", "horde"], count: 1 },
      4: { name: "Orcs", hp: 6, damage: 3, abilities: ["loot"], count: 2 },
      5: { name: "Orc", hp: 6, damage: 3, abilities: ["loot"], count: 1 },
      6: { name: "Goblins", hp: 3, damage: 1, abilities: ["explosive"], count: { dice: 1, sides: 6 } },
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
      5: { text: "Roll on the Wonders table.", effect: { kind: "rerollColumn", column: "wonders" } },
      6: { text: "Roll on the Magic Item table.", effect: { kind: "rerollColumn", column: "magicItem" } },
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
        effect: { kind: "flavor" },
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
};
