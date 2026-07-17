import { describe, expect, it } from "vitest";
import { RACE_TABLE } from "../races.ts";
import { CULTURE_BY_LOCATION, RACE_AFFINITY, hasAffinity, type CityCulture } from "../affinity.ts";
import { CITY_OR_FORTRESS, type LocationKind } from "../hexTables.ts";

const ALL_CULTURES: CityCulture[] = ["human", "dwarven", "elven", "gnome", "goblin", "orc"];

describe("RACE_AFFINITY completeness", () => {
  it("defines an answer for every playable race, for every culture", () => {
    const raceNames = Object.values(RACE_TABLE).map((r) => r.name);
    for (const name of raceNames) {
      for (const culture of ALL_CULTURES) {
        expect(RACE_AFFINITY[name]?.[culture], `missing ${name}/${culture}`).toBeDefined();
      }
    }
  });

  it("maps every City/Fortress LocationKind to a culture", () => {
    for (const loc of CITY_OR_FORTRESS) {
      expect(CULTURE_BY_LOCATION[loc], `missing culture for ${loc}`).toBeDefined();
    }
  });
});

describe("hasAffinity", () => {
  it("is always true for non-city locations", () => {
    expect(hasAffinity("Human", "ruins")).toBe(true);
    expect(hasAffinity("Human", "rocks")).toBe(true);
    expect(hasAffinity("Human", null)).toBe(true);
  });

  it("Human can enter every city except Goblin/Orc", () => {
    expect(hasAffinity("Human", "humanCity")).toBe(true);
    expect(hasAffinity("Human", "dwarvenCity")).toBe(true);
    expect(hasAffinity("Human", "elvenFortress")).toBe(true);
    expect(hasAffinity("Human", "gnomeCity")).toBe(true);
    expect(hasAffinity("Human", "goblinCity")).toBe(false);
    expect(hasAffinity("Human", "orcFortress")).toBe(false);
  });

  it("Dwarf is banned from Elven cities specifically", () => {
    expect(hasAffinity("Dwarf", "elvenCity")).toBe(false);
    expect(hasAffinity("Dwarf", "dwarvenFortress")).toBe(true);
  });

  it("Elf is banned from Dwarven cities specifically", () => {
    expect(hasAffinity("Elf", "dwarvenCity")).toBe(false);
    expect(hasAffinity("Elf", "elvenFortress")).toBe(true);
  });

  it("Slimemen alone has full affinity everywhere, including Orc", () => {
    for (const loc of CITY_OR_FORTRESS as Set<LocationKind>) {
      expect(hasAffinity("Slimemen", loc), loc).toBe(true);
    }
  });

  it("Dragonkin is banned from Dwarven and Elven, but welcome at Goblin/Orc", () => {
    expect(hasAffinity("Dragonkin", "dwarvenCity")).toBe(false);
    expect(hasAffinity("Dragonkin", "elvenFortress")).toBe(false);
    expect(hasAffinity("Dragonkin", "goblinCity")).toBe(true);
    expect(hasAffinity("Dragonkin", "orcCity")).toBe(true);
  });

  it("falls back to the default row for a race with no explicit entry", () => {
    expect(hasAffinity("Some Future Race", "humanCity")).toBe(true);
    expect(hasAffinity("Some Future Race", "orcCity")).toBe(false);
  });
});
