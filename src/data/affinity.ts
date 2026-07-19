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
 * all 11 of this app's currently-playable races (each matches an explicit rulebook row 1:1 --
 * Catfolk -> "Cat-Person", Slimeman -> "Slimemen") plus the Goblin and "Orc/Ogre" rows, which are
 * unreachable until issue #22 (New Races) adds them as playable, included here for
 * forward-compatibility rather than left for that issue to also touch this table. */
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
  "Orc/Ogre": { human: false, dwarven: false, elven: false, gnome: false, goblin: true, orc: true },
};

/** The rulebook's "Other race..." catch-all row -- not hit by anything currently playable (every
 * race above has its own explicit row), kept for the same forward-compatibility reason. */
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
