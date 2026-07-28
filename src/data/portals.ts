/** "Portals" (`docs/game-rules-reference.md` lines 1091-1116, issue #21): "During exploration you can
 * find portals all over the world. When going through a portal there is no turning back and you will
 * never know where you'll end up. When entering a portal, roll 3d6 on the table below. Once you've
 * established where a portal leads, you don't need to roll again for it."
 *
 * That last sentence is why `HexTile.portalTotal` exists -- a portal hex remembers its own rolled
 * total forever, so it becomes a fixed piece of geography rather than a slot machine.
 *
 * **Stage 1 scope** (this release): the 12 outcomes resolvable on the existing single map. The six
 * rows that lead to one of the four Other Worlds (Hell/Pesadelum/Underworld/Candy World) carry a
 * real `otherWorld` outcome here -- the data is complete and correct -- but `portals.ts`'s
 * `rollPortal()` currently *re-rolls* when it hits one, because those worlds need a multi-map model
 * that doesn't exist yet (issue #21 stage 2). Keeping the rows honest rather than substituting a
 * different effect means stage 2 only has to stop re-rolling them.
 */
export type OtherWorldKey = "hell" | "pesadelum" | "underworld" | "candyWorld";

export type PortalOutcome =
  /** 3: "Your character has disappeared from existence." No Graveyard-worthy body, but the
   * character is gone -- treated as a death, since that's the only "this character is over" path
   * this app has. */
  | { kind: "vanish" }
  /** 4/5/8/16/17/18 -- stage 2. See the module doc for why these are authored but not yet reachable. */
  | { kind: "otherWorld"; world: OtherWorldKey }
  /** 6: "You went to the future, and all cities are destroyed (Ruins)." */
  | { kind: "futureRuins" }
  /** 7: "You appeared at the beginning of a new Dungeon but no door to exit. In the Boss's room
   * there will be a Portal." */
  | { kind: "noExitDungeon" }
  /** 9: "the middle of the nearest town (even if it's an enemy town)" -- any City/Fortress. */
  | { kind: "nearestTown" }
  /** 10: "the middle of the nearest human city" -- specifically a Human City/Fortress. */
  | { kind: "nearestHumanCity" }
  /** 11: "You go to whatever hexagon you want (even from another world)." */
  | { kind: "chooseAnyHex" }
  /** 12: "You went to another reality. Create a new map from scratch." */
  | { kind: "newMap" }
  /** 13: "You are still in the same place but now whenever you reveal a Plain you find Water." */
  | { kind: "plainsBecomeWater" }
  /** 14: the Slimemen's cloud city -- "If you want, they open a new portal to send you back wherever
   * you want." Mechanically the same destination picker as `chooseAnyHex`, different framing. */
  | { kind: "slimemenCity" }
  /** 15: "a golden room with no doors. In the center there are 300 coins and on the back wall
   * another Portal." The only outcome that chains: the coins are credited and then the *second*
   * portal is rolled, since a doorless room offers no other way out. */
  | { kind: "goldenRoom"; coins: number };

export interface PortalRow {
  /** Printed close to verbatim -- this is the only description the player gets of where they ended up. */
  text: string;
  outcome: PortalOutcome;
}

export const PORTAL_TABLE: Record<number, PortalRow> = {
  3: { text: "Your character has disappeared from existence.", outcome: { kind: "vanish" } },
  4: { text: "You went to Hell.", outcome: { kind: "otherWorld", world: "hell" } },
  5: { text: "You went to Pesadelum.", outcome: { kind: "otherWorld", world: "pesadelum" } },
  6: {
    text: "You went to the future, and every city you knew lies in ruins.",
    outcome: { kind: "futureRuins" },
  },
  7: {
    text: "You appeared at the beginning of a new dungeon, with no door to exit. There will be a Portal in the Boss's room.",
    outcome: { kind: "noExitDungeon" },
  },
  8: { text: "You went to the Underworld.", outcome: { kind: "otherWorld", world: "underworld" } },
  9: {
    text: "You appeared in the middle of the nearest town — even an unfriendly one.",
    outcome: { kind: "nearestTown" },
  },
  10: {
    text: "You appeared in the middle of the nearest human city.",
    outcome: { kind: "nearestHumanCity" },
  },
  11: { text: "The portal opens onto anywhere you choose.", outcome: { kind: "chooseAnyHex" } },
  12: {
    text: "You went to another reality — an entirely new map, unknown to you.",
    outcome: { kind: "newMap" },
  },
  13: {
    text: "You are still in the same place, but the world has changed: every plain you find from now on turns out to be water.",
    outcome: { kind: "plainsBecomeWater" },
  },
  14: {
    text: "You appeared in a city in the clouds where the Slimemen live. They are very nice and hospitable, and will open a new portal to send you wherever you want.",
    outcome: { kind: "slimemenCity" },
  },
  15: {
    text: "You appeared in a golden room with no doors. In the center are 300 coins, and on the back wall another Portal.",
    outcome: { kind: "goldenRoom", coins: 300 },
  },
  16: { text: "You went to Pesadelum.", outcome: { kind: "otherWorld", world: "pesadelum" } },
  17: { text: "You went to Candy World.", outcome: { kind: "otherWorld", world: "candyWorld" } },
  18: { text: "You went to Hell.", outcome: { kind: "otherWorld", world: "hell" } },
};

/** Human-readable names for the stage-2 worlds, used only in the "the portal fights you" flavor line
 * `rollPortal()` emits when it re-rolls one. Keeps that copy honest about what was actually rolled
 * instead of pretending nothing happened. */
export const OTHER_WORLD_LABELS: Record<OtherWorldKey, string> = {
  hell: "Hell",
  pesadelum: "Pesadelum",
  underworld: "the Underworld",
  candyWorld: "Candy World",
};
