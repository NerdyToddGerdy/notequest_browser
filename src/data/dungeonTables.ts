import type { DungeonTypeKey } from "./dungeonTypes.ts";

export interface RoomContentEntry {
  text: string;
  secretPassage: boolean;
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

export interface DungeonTypeTables {
  /** Table: Trap (1d6). Row 1 is identical across all types. */
  trap: Record<number, TrapEntry>;
  /** Table: Room Content (2d6). */
  roomContent: Record<number, RoomContentEntry>;
  /** Table: Monsters (2d6). Rows 7 and 8 are both null ("no monsters in this room"). */
  monsters: Record<number, MonsterTemplate | null>;
  /** Table: Boss (1d6). Rolled once when the Final Room is placed; no Content/Monsters roll alongside it. */
  boss: Record<number, MonsterTemplate>;
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

const BLADE_TRAP: TrapEntry = {
  text: "A blade falls from the ceiling. Roll the dice. On a 2 you lose one of your arms and on a 1 you die.",
};
const CLICK_NOTHING: TrapEntry = { text: "You hear a click, but nothing happens." };
const DITCH_TRAP: TrapEntry = { text: "You fall into a ditch (spend 1 torch to go out).", torchCost: 1 };

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
      6: { text: "Desk with a Chest.", secretPassage: false },
      7: { text: "Dirt everywhere.", secretPassage: true },
      8: { text: "Bed with a Chest on the side.", secretPassage: false },
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
      7: { text: "Casket with Chest inside.", secretPassage: false },
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
      7: { text: "Sarcophagus with Chest inside.", secretPassage: false },
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
      7: { text: "Large Chest on an altar.", secretPassage: false },
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
      7: { text: "Chest surrounded by melted candles.", secretPassage: false },
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
  },
};
