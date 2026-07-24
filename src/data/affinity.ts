import type { LocationKind } from "./hexTables.ts";

/** The 6 cultures a City/Fortress hex can belong to -- matches `LOCATION_TABLE`'s own
 * orc/goblin/human/dwarven/elven/gnome city/fortress outcomes exactly (Goblin and Gnome only ever
 * roll a City, never a Fortress, per `LocationKind`). */
export type CityCulture = "human" | "dwarven" | "elven" | "gnome" | "goblin" | "orc";

export const CULTURE_BY_LOCATION: Partial<Record<LocationKind, CityCulture>> = {
  humanCity: "human",
  humanFortress: "human",
  dwarvenCity: "dwarven",
  dwarvenFortress: "dwarven",
  elvenCity: "elven",
  elvenFortress: "elven",
  gnomeCity: "gnome",
  goblinCity: "goblin",
  orcCity: "orc",
  orcFortress: "orc",
};

/** "Table: Affinity" (`docs/game-rules-reference.md` lines 954-976) -- whether a given race can
 * enter/trade at a given culture's City/Fortress at all. Keyed by exact `RaceDef.name` (the same
 * "no formal taxonomy, just match the string" precedent used throughout this codebase), covering
 * every one of this app's playable races that has its own explicit rulebook row (Catfolk ->
 * "Cat-Person", Slimeman -> "Slimemen"). The rulebook lists Orc and Ogre as one combined "Orc/Ogre"
 * row (they behave identically) -- split into two exact-name rows here now that issue #22 made
 * both independently playable, rather than needing `hasAffinity()` to special-case a combined key.
 * Every other New Races addition (Centaur, Fungoid, Samambro, Corvino, Patovsky, Pandakhan,
 * Sharkin, Pumpkinkin, Half-Human) has no explicit row in the rulebook's own table either --
 * they fall through to `DEFAULT_AFFINITY` below exactly like the "Other race..." catch-all row
 * intends, so they deliberately aren't added here. */
export const RACE_AFFINITY: Record<string, Record<CityCulture, boolean>> = {
  Human: { human: true, dwarven: true, elven: true, gnome: true, goblin: false, orc: false },
  Dwarf: { human: true, dwarven: true, elven: false, gnome: true, goblin: false, orc: false },
  Elf: { human: true, dwarven: false, elven: true, gnome: true, goblin: false, orc: false },
  Gnome: { human: true, dwarven: true, elven: true, gnome: true, goblin: true, orc: false },
  Halfling: { human: true, dwarven: true, elven: true, gnome: true, goblin: true, orc: false },
  Pixie: { human: true, dwarven: false, elven: true, gnome: true, goblin: true, orc: false },
  "Cat-Person": { human: true, dwarven: true, elven: true, gnome: true, goblin: true, orc: false },
  Rinoceroid: { human: true, dwarven: true, elven: true, gnome: true, goblin: true, orc: false },
  Lightbugster: { human: true, dwarven: true, elven: true, gnome: true, goblin: true, orc: false },
  Slimemen: { human: true, dwarven: true, elven: true, gnome: true, goblin: true, orc: true },
  Dragonkin: { human: true, dwarven: false, elven: false, gnome: true, goblin: true, orc: true },
  Goblin: { human: true, dwarven: false, elven: false, gnome: true, goblin: true, orc: true },
  Orc: { human: false, dwarven: false, elven: false, gnome: false, goblin: true, orc: true },
  Ogre: { human: false, dwarven: false, elven: false, gnome: false, goblin: true, orc: true },
};

/** The rulebook's "Other race..." catch-all row -- covers every New Races addition with no
 * explicit row of its own (see the comment above). */
const DEFAULT_AFFINITY: Record<CityCulture, boolean> = {
  human: true,
  dwarven: true,
  elven: true,
  gnome: true,
  goblin: true,
  orc: false,
};

/** True if `raceName` can enter/trade at `location` at all. Non-city locations (or a City/Fortress
 * culture with no Affinity restriction anywhere -- none currently) are always `true`; a race with
 * no explicit row falls back to `DEFAULT_AFFINITY`. */
export function hasAffinity(raceName: string, location: LocationKind | null): boolean {
  const culture = location ? CULTURE_BY_LOCATION[location] : undefined;
  if (!culture) return true;
  return (RACE_AFFINITY[raceName] ?? DEFAULT_AFFINITY)[culture];
}

/** "Table: Political Affinity" (Politics, issue #27, `docs/game-rules-reference.md` lines
 * 1706-1720) -- a genuinely different table from `RACE_AFFINITY` above: that one is a boolean
 * "can you even enter" gate, this one is a numeric target number for the Political Affinity roll
 * ("go to the city or fortress and roll on the Affinity table below. If you get an equal or higher
 * number, you got the affinity of this one"). Same race-row shape (Orc/Ogre split into two
 * identical rows for the same reason `RACE_AFFINITY`'s own doc comment explains), reusing
 * `CityCulture` rather than redefining it. */
export const POLITICAL_AFFINITY_TABLE: Record<string, Record<CityCulture, number>> = {
  Human: { human: 4, dwarven: 5, elven: 5, gnome: 5, goblin: 5, orc: 7 },
  Dwarf: { human: 5, dwarven: 4, elven: 6, gnome: 5, goblin: 6, orc: 8 },
  Elf: { human: 5, dwarven: 6, elven: 4, gnome: 5, goblin: 6, orc: 7 },
  Gnome: { human: 5, dwarven: 5, elven: 5, gnome: 4, goblin: 5, orc: 7 },
  Halfling: { human: 4, dwarven: 4, elven: 4, gnome: 3, goblin: 4, orc: 5 },
  Pixie: { human: 5, dwarven: 6, elven: 5, gnome: 5, goblin: 5, orc: 7 },
  Slimemen: { human: 5, dwarven: 5, elven: 5, gnome: 5, goblin: 5, orc: 5 },
  Dragonkin: { human: 5, dwarven: 6, elven: 6, gnome: 4, goblin: 4, orc: 4 },
  Goblin: { human: 5, dwarven: 6, elven: 5, gnome: 4, goblin: 4, orc: 4 },
  Orc: { human: 7, dwarven: 8, elven: 7, gnome: 6, goblin: 4, orc: 4 },
  Ogre: { human: 7, dwarven: 8, elven: 7, gnome: 6, goblin: 4, orc: 4 },
};

/** The rulebook's "Others..." catch-all row -- every New Races addition with no explicit row of
 * its own, same fallback precedent as `DEFAULT_AFFINITY`. */
export const DEFAULT_POLITICAL_AFFINITY: Record<CityCulture, number> = {
  human: 5,
  dwarven: 6,
  elven: 5,
  gnome: 5,
  goblin: 5,
  orc: 6,
};

/** The target number a Political Affinity roll must meet or beat at a `culture` hex. */
export function politicalAffinityTarget(raceName: string, culture: CityCulture): number {
  return (POLITICAL_AFFINITY_TABLE[raceName] ?? DEFAULT_POLITICAL_AFFINITY)[culture];
}
