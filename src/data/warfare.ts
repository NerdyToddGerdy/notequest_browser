/** Warfare (Expanded World, issue #28, `docs/game-rules-reference.md` lines 1722-1763). */

/** "You will need to spend 200 coins for each" troop recruited. */
export const TROOP_COST = 200;

/** "If you choose to Loot, you destroy the place completely... and gain 200 coins if it's a
 * castle, 600 coins if it's a city, or 1000 coins if it's a fortress." The "castle" branch is
 * unreachable in this codebase -- no NPC-generated hex is ever a `Castle` `LocationKind`, only
 * City/Fortress locations exist on the map -- so only those two are modeled. */
export function stormingLootPayout(isFortress: boolean): number {
  return isFortress ? 1000 : 600;
}
