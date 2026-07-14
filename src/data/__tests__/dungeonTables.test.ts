import { describe, expect, it } from "vitest";
import { describeItemEffect, type ItemEffect } from "../dungeonTables.ts";

describe("describeItemEffect", () => {
  it("describes each mechanical effect kind in plain language", () => {
    const cases: [ItemEffect, string][] = [
      [{ kind: "weaponDamageBonus", amount: 2 }, "+2 damage"],
      [{ kind: "damageBonusVsTag", tags: ["vampire", "ghoul"], amount: 1 }, "+1 damage vs vampire and ghoul"],
      [{ kind: "damageMultiplierVsTag", tags: ["dragon"], multiplier: 2 }, "2x damage vs dragon"],
      [{ kind: "ignoresMonsterAbility", ability: "intangible" }, "Ignores Intangible"],
      [{ kind: "trapImmunity" }, "Ignores the next activated trap"],
      [{ kind: "doubleChestCoins" }, "Doubles coins found in chests"],
      [{ kind: "combatDamageBonus", amount: 2 }, "+2 damage until the end of the fight"],
      [{ kind: "grantsTorches", amount: 2 }, "Grants 2 torches"],
      [{ kind: "grantsTorches", amount: 1 }, "Grants 1 torch"],
      [{ kind: "randomSpell" }, "Grants a random Spell"],
      [{ kind: "lifesteal", amount: 1 }, "Recovers 1 HP with each attack"],
      [{ kind: "instantKillOnRoll", roll: 6 }, "Kills instantly on a roll of 6"],
    ];
    for (const [effect, expected] of cases) {
      expect(describeItemEffect(effect)).toBe(expected);
    }
  });

  it("returns null for extraHp and flavor -- nothing extra to explain beyond the piece's own HP/name", () => {
    expect(describeItemEffect({ kind: "extraHp", amount: 2 })).toBeNull();
    expect(describeItemEffect({ kind: "flavor" })).toBeNull();
  });
});
