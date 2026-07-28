import type { OtherWorldKey } from "./portals.ts";

/** Which map the player is standing in (issue #105). `"overworld"` is the ordinary hexcrawl every
 * other system assumes; the other four are the Other Worlds a portal can strand you in.
 *
 * Its own tiny module rather than living in `otherWorlds.ts` because `hexState.ts` needs the type
 * and `otherWorlds.ts` imports from `hexState.ts` -- putting it there would be a cycle. */
export type RealmKey = "overworld" | OtherWorldKey;

export const OVERWORLD: RealmKey = "overworld";
