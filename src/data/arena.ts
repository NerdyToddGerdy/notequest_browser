import type { MonsterTemplate } from "./dungeonTables.ts";

/** "Table: Arena Champion" (3d6) -- `docs/game-rules-reference.md` lines 1054-1071. Every entry's
 * `count` is a flat 1: the Arena is always a single 1v1 duel ("You never know who your opponent
 * will be"), never a group encounter the way a dungeon room can be. 16-18 all name the same
 * "Ogre in thong" champion, matching the rulebook's own merged row. */
export const ARENA_CHAMPION_TABLE: Record<number, MonsterTemplate> = {
  3: { name: "The Reaper", hp: 30, damage: 6, abilities: ["deathtouch"], count: 1 },
  4: { name: "The Rock", hp: 50, damage: 4, abilities: ["stoneskin"], count: 1 },
  5: { name: "Giant Worm", hp: 30, damage: 10, abilities: [], count: 1 },
  6: { name: "Green Ogre", hp: 23, damage: 11, abilities: [], count: 1 },
  7: { name: "War Spider", hp: 18, damage: 5, abilities: ["poison"], count: 1 },
  8: { name: "Barbarian in Loincloth", hp: 16, damage: 7, abilities: [], count: 1 },
  9: { name: "Ogre & Goblin", hp: 30, damage: 6, abilities: ["weakness"], count: 1 },
  10: { name: "Gladiator Orc", hp: 7, damage: 4, abilities: [], count: 1 },
  11: { name: "Gladiator Goblin", hp: 4, damage: 2, abilities: ["explosive"], count: 1 },
  12: { name: "Furious Dwarf", hp: 9, damage: 4, abilities: [], count: 1 },
  13: { name: "Berserker Elf", hp: 8, damage: 3, abilities: [], count: 1 },
  14: { name: "Bronze Sentry", hp: 20, damage: 6, abilities: [], count: 1 },
  15: { name: "The Masked Warrior", hp: 20, damage: 9, abilities: [], count: 1 },
  16: { name: "Ogre in Thong", hp: 22, damage: 7, abilities: [], count: 1 },
  17: { name: "Ogre in Thong", hp: 22, damage: 7, abilities: [], count: 1 },
  18: { name: "Ogre in Thong", hp: 22, damage: 7, abilities: [], count: 1 },
};
