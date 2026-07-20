import { describe, expect, it } from "vitest";
import { EXOTIC_RACE_TABLE, MONSTROUS_RACE_TABLE, RACE_TABLE, UNCOMMON_RACE_TABLE } from "../../data/races.ts";
import { CLASS_TABLE } from "../../data/classes.ts";
import { SPELL_TABLE } from "../../data/spells.ts";
import { FIRST_NAME_TABLE, LAST_NAME_TABLE } from "../../data/names.ts";
import {
  computeSpellRequirements,
  computeSpellUses,
  computeTotalHp,
  rollClass,
  rollName,
  rollRace,
  rollRaceFromTable,
  rollSpell,
} from "../character.ts";
import { sequenceDie } from "../../test/mulberry32.ts";

describe("table completeness", () => {
  it("defines a Race for every 2d6 sum (2-12)", () => {
    for (let sum = 2; sum <= 12; sum++) {
      expect(RACE_TABLE[sum], `missing race for roll ${sum}`).toBeDefined();
    }
  });

  it("defines a Class for every 2d6 sum (2-12)", () => {
    for (let sum = 2; sum <= 12; sum++) {
      expect(CLASS_TABLE[sum], `missing class for roll ${sum}`).toBeDefined();
    }
  });

  it("defines a Basic Spell for every 1d6 face (1-6)", () => {
    for (let roll = 1; roll <= 6; roll++) {
      expect(SPELL_TABLE[roll], `missing spell for roll ${roll}`).toBeDefined();
    }
  });

  it("defines a full 1d6 first/last name table for every race, plus the default fallback", () => {
    const raceNames = Object.values(RACE_TABLE).map((r) => r.name);
    for (const key of [...raceNames, "default"]) {
      for (let roll = 1; roll <= 6; roll++) {
        expect(FIRST_NAME_TABLE[key]?.[roll], `missing first name for ${key} roll ${roll}`).toBeDefined();
        expect(LAST_NAME_TABLE[key]?.[roll], `missing last name for ${key} roll ${roll}`).toBeDefined();
      }
    }
  });

  it("defines a full 1d6 row for each New Races table (Uncommon/Exotic/Monstrous)", () => {
    for (const table of [UNCOMMON_RACE_TABLE, EXOTIC_RACE_TABLE, MONSTROUS_RACE_TABLE]) {
      for (let roll = 1; roll <= 6; roll++) {
        expect(table[roll], `missing race for roll ${roll}`).toBeDefined();
      }
    }
  });
});

describe("rollRace / rollClass / rollSpell", () => {
  it("resolves the table entry matching the summed dice", () => {
    const result = rollRace(sequenceDie([2, 2])); // sum 4 -> Pixie
    expect(result.dice).toEqual([2, 2]);
    expect(result.entry.name).toBe("Pixie");
  });

  it("resolves a class from its dice sum", () => {
    const result = rollClass(sequenceDie([3, 2])); // sum 5 -> Scholar
    expect(result.entry.name).toBe("Scholar");
  });

  it("resolves a spell from a single die", () => {
    const result = rollSpell(sequenceDie([6]));
    expect(result.entry.name).toBe("Fireball");
  });
});

describe("rollRaceFromTable (New Races, issue #22)", () => {
  it("'core' delegates straight to rollRace's own 2d6 sum", () => {
    const result = rollRaceFromTable("core", sequenceDie([2, 2])); // sum 4 -> Pixie
    expect(result.dice).toEqual([2, 2]);
    expect(result.entry.name).toBe("Pixie");
  });

  it("rolls a flat 1d6 against the Uncommon table", () => {
    const result = rollRaceFromTable("uncommon", sequenceDie([4])); // Pumpkinkin
    expect(result.dice).toEqual([4]);
    expect(result.entry.name).toBe("Pumpkinkin");
  });

  it("rolls a flat 1d6 against the Exotic table", () => {
    const result = rollRaceFromTable("exotic", sequenceDie([2])); // Samambro
    expect(result.entry.name).toBe("Samambro");
  });

  it("rolls a flat 1d6 against the Monstrous table", () => {
    const result = rollRaceFromTable("monstrous", sequenceDie([5])); // Ogre
    expect(result.entry.name).toBe("Ogre");
  });

  it("reuses the Core table's own entry for a row that re-lists an existing race", () => {
    const result = rollRaceFromTable("uncommon", sequenceDie([3])); // Slimemen
    expect(result.entry.name).toBe("Slimemen");
    expect(result.entry.hp).toBe(RACE_TABLE[2]!.hp);
    expect(result.entry.ability).toBe(RACE_TABLE[2]!.ability);
  });

  it("Half-Human rerolls on the Core table and inherits its ability/spell grants", () => {
    // 6 -> Half-Human, then Core 2d6 [3,3] (sum 6) -> Elf (1 random Basic Spell).
    const result = rollRaceFromTable("uncommon", sequenceDie([6, 3, 3]));
    expect(result.dice).toEqual([6, 3, 3]);
    expect(result.entry.name).toBe("Half-Human"); // keeps its own identity/HP
    expect(result.entry.hp).toBe(20);
    expect(result.entry.randomSpells).toBe(1); // inherited from Elf
    expect(result.entry.ability).toContain("Elf");
  });

  it("Half-Human can inherit a fixedSpell grant too", () => {
    // 6 -> Half-Human, then Core 2d6 [1,2] (sum 3) -> Lightbugster (3 uses of Light).
    const result = rollRaceFromTable("uncommon", sequenceDie([6, 1, 2]));
    expect(result.entry.fixedSpell).toEqual({ spellRoll: 2, uses: 3 });
  });
});

describe("rollName", () => {
  it("resolves a first and last name from a race's own table", () => {
    const result = rollName("Dwarf", sequenceDie([1, 2]));
    expect(result.dice).toEqual([1, 2]);
    expect(result.entry).toBe("Thrain Stonefist");
  });

  it("falls back to the default table for a race with no table of its own", () => {
    const result = rollName("Some Future Race", sequenceDie([3, 4]));
    expect(result.entry).toBe("Sage Nightroad");
  });
});

describe("computeSpellRequirements", () => {
  it("is empty for a build with no spell-granting race or class", () => {
    const req = computeSpellRequirements(RACE_TABLE[7]!, CLASS_TABLE[7]!); // Human Guard
    expect(req.randomSlots).toBe(0);
    expect(req.fixedGrants).toEqual([]);
  });

  it("sums random slots from both race and class", () => {
    const req = computeSpellRequirements(RACE_TABLE[4]!, CLASS_TABLE[5]!); // Pixie (5) + Scholar (3)
    expect(req.randomSlots).toBe(8);
    expect(req.fixedGrants).toEqual([]);
  });

  it("surfaces a race's fixed spell grant instead of a random roll", () => {
    const req = computeSpellRequirements(RACE_TABLE[3]!, CLASS_TABLE[7]!); // Lightbugster + Guard
    expect(req.randomSlots).toBe(0);
    expect(req.fixedGrants).toEqual([{ spellRoll: 2, uses: 3 }]); // Light x3
  });

  it("handles a null race or class before either has been rolled", () => {
    expect(computeSpellRequirements(null, null)).toEqual({ randomSlots: 0, fixedGrants: [] });
  });
});

describe("computeSpellUses", () => {
  it("is empty with no spells or grants", () => {
    expect(computeSpellUses([], [])).toEqual({});
  });

  it("counts each rolled spell as one use, keyed by its table roll", () => {
    const uses = computeSpellUses([SPELL_TABLE[2]!, SPELL_TABLE[6]!], []);
    expect(uses).toEqual({ 2: 1, 6: 1 });
  });

  it("stacks duplicate rolled spells into extra uses of the same roll", () => {
    const uses = computeSpellUses([SPELL_TABLE[2]!, SPELL_TABLE[2]!], []);
    expect(uses).toEqual({ 2: 2 });
  });

  it("combines fixed grants and rolled spells for the same spell roll", () => {
    const uses = computeSpellUses([SPELL_TABLE[2]!], [{ spellRoll: 2, uses: 3 }]);
    expect(uses).toEqual({ 2: 4 });
  });
});

describe("computeTotalHp", () => {
  it("adds race HP and class HP bonus", () => {
    expect(computeTotalHp(RACE_TABLE[7]!, CLASS_TABLE[7]!)).toBe(24); // Human 20 + Guard +4
  });
});
