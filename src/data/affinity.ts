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
