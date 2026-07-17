import { describe, expect, it } from "vitest";
import { RACE_TABLE } from "../../data/races.ts";
import { CLASS_TABLE } from "../../data/classes.ts";
import { SPELL_TABLE } from "../../data/spells.ts";
import {
  computeSpellRequirements,
  computeSpellUses,
  computeTotalHp,
  rollClass,
  rollRace,
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
