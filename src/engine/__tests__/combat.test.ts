import { describe, expect, it } from "vitest";
import type { MonsterTemplate } from "../../data/dungeonTables.ts";
import {
  checkUndeadRevival,
  HORDE_ORC,
  NECROMANCY_SKELETON,
  parseWeaponFormula,
  resolveMonsterCount,
  resolveMonsterTurn,
  resolvePlayerAttack,
  resolveSpellDamage,
  rollLoot,
  rollWeaponDamage,
  spawnMonsters,
} from "../combat.ts";
import type { CombatMonsterState } from "../dungeonState.ts";
import { fixedDie, sequenceDie } from "../../test/mulberry32.ts";

function makeMonster(overrides: Partial<CombatMonsterState> = {}): CombatMonsterState {
  return {
    id: 1,
    name: "Orc",
    hp: 6,
    maxHp: 6,
    damage: 3,
    abilities: [],
    bonusDamage: 0,
    deathtouchPending: false,
    paralyzePending: 0,
    skipNextAttack: false,
    silencedTurns: 0,
    ...overrides,
  };
}

describe("resolveMonsterCount", () => {
  it("returns a fixed count as-is", () => {
    expect(resolveMonsterCount(2)).toBe(2);
  });

  it("sums a dice-based count deterministically", () => {
    const rng = sequenceDie([3, 5]);
    expect(resolveMonsterCount({ dice: 2, sides: 6 }, rng)).toBe(8);
  });
});

describe("spawnMonsters", () => {
  it("spawns one instance per fixed count, with ids from the provided generator", () => {
    const template: MonsterTemplate = { name: "Orc", hp: 6, damage: 3, abilities: ["loot"], count: 2 };
    let nextId = 10;
    const monsters = spawnMonsters(template, () => nextId++, Math.random);
    expect(monsters).toHaveLength(2);
    expect(monsters.map((m) => m.id)).toEqual([10, 11]);
    for (const m of monsters) {
      expect(m).toMatchObject({ name: "Orc", hp: 6, maxHp: 6, damage: 3, abilities: ["loot"], bonusDamage: 0 });
    }
  });

  it("spawns a dice-resolved number of instances", () => {
    const template: MonsterTemplate = { name: "Goblins", hp: 3, damage: 1, abilities: [], count: { dice: 1, sides: 6 } };
    const rng = fixedDie(4);
    const monsters = spawnMonsters(template, () => 1, rng);
    expect(monsters).toHaveLength(4);
  });

  it("uses the plural name when more than one spawns, even with a singularName set (issue #65)", () => {
    const template: MonsterTemplate = {
      name: "Goblins",
      singularName: "Goblin",
      hp: 3,
      damage: 1,
      abilities: [],
      count: { dice: 1, sides: 6 },
    };
    const monsters = spawnMonsters(template, () => 1, fixedDie(4));
    expect(monsters).toHaveLength(4);
    expect(monsters.every((m) => m.name === "Goblins")).toBe(true);
  });

  it("uses singularName instead of name when the dice-rolled count is exactly 1 (issue #65)", () => {
    const template: MonsterTemplate = {
      name: "Goblins",
      singularName: "Goblin",
      hp: 3,
      damage: 1,
      abilities: [],
      count: { dice: 1, sides: 6 },
    };
    const monsters = spawnMonsters(template, () => 1, fixedDie(1));
    expect(monsters).toHaveLength(1);
    expect(monsters[0]!.name).toBe("Goblin");
  });

  it("falls back to the plural name at count 1 if no singularName is set", () => {
    const template: MonsterTemplate = { name: "Orcs", hp: 6, damage: 3, abilities: [], count: { dice: 1, sides: 6 } };
    const monsters = spawnMonsters(template, () => 1, fixedDie(1));
    expect(monsters).toHaveLength(1);
    expect(monsters[0]!.name).toBe("Orcs");
  });

  it("a fixed count of 1 is unaffected -- name is already correctly singular in the data", () => {
    const template: MonsterTemplate = { name: "Orc", hp: 6, damage: 3, abilities: ["loot"], count: 1 };
    const monsters = spawnMonsters(template, () => 1, Math.random);
    expect(monsters[0]!.name).toBe("Orc");
  });
});

describe("parseWeaponFormula", () => {
  it("parses a bare Nd-sides formula", () => {
    expect(parseWeaponFormula("1d6")).toEqual({ sides: 6, modifier: 0 });
  });
  it("parses positive and negative modifiers", () => {
    expect(parseWeaponFormula("1d6+1")).toEqual({ sides: 6, modifier: 1 });
    expect(parseWeaponFormula("1d6-2")).toEqual({ sides: 6, modifier: -2 });
  });
  it("throws on an unrecognized formula", () => {
    expect(() => parseWeaponFormula("2d6")).not.toThrow();
    expect(() => parseWeaponFormula("garbage")).toThrow();
  });
});

describe("rollWeaponDamage", () => {
  it("clamps total damage at zero", () => {
    const rng = fixedDie(1);
    expect(rollWeaponDamage("1d6-2", rng)).toEqual({ rawRoll: 1, total: 0 });
  });
  it("adds a positive modifier", () => {
    const rng = fixedDie(3);
    expect(rollWeaponDamage("1d6+1", rng)).toEqual({ rawRoll: 3, total: 4 });
  });
});

describe("resolvePlayerAttack: plain monster", () => {
  it("deals ordinary damage and reports defeat once HP is exhausted", () => {
    const monster = makeMonster({ hp: 3 });
    const result = resolvePlayerAttack(monster, 4, 4, Math.random);
    expect(result).toEqual({ damageDealt: 3, monsterDefeated: true, selfDestructDamageToPlayer: 0, events: [] });
  });

  it("leaves the monster alive when damage is insufficient", () => {
    const monster = makeMonster({ hp: 6 });
    const result = resolvePlayerAttack(monster, 4, 4, Math.random);
    expect(result).toEqual({ damageDealt: 4, monsterDefeated: false, selfDestructDamageToPlayer: 0, events: [] });
  });
});

describe("resolvePlayerAttack: Stoneskin", () => {
  it("ignores damage of 3 or less", () => {
    const monster = makeMonster({ abilities: ["stoneskin"] });
    const result = resolvePlayerAttack(monster, 3, 3, Math.random);
    expect(result.damageDealt).toBe(0);
    expect(result.events).toContainEqual({ kind: "stoneskin" });
  });
  it("takes full damage above 3", () => {
    const monster = makeMonster({ abilities: ["stoneskin"] });
    const result = resolvePlayerAttack(monster, 4, 4, Math.random);
    expect(result.damageDealt).toBe(4);
  });
});

describe("resolvePlayerAttack: Intangible", () => {
  it("takes no damage when the total is even", () => {
    const monster = makeMonster({ abilities: ["intangible"] });
    const result = resolvePlayerAttack(monster, 4, 4, Math.random);
    expect(result.damageDealt).toBe(0);
    expect(result.events).toContainEqual({ kind: "intangible" });
  });
  it("takes full damage when the total is odd", () => {
    const monster = makeMonster({ abilities: ["intangible"] });
    const result = resolvePlayerAttack(monster, 5, 5, Math.random);
    expect(result.damageDealt).toBe(5);
  });
});

describe("resolvePlayerAttack: Weakness", () => {
  it("doubles damage on a raw roll of 6", () => {
    const monster = makeMonster({ hp: 6, abilities: ["weakness"] });
    const result = resolvePlayerAttack(monster, 6, 4, Math.random);
    expect(result.damageDealt).toBe(6); // 4*2=8, capped at 6 hp
    expect(result.events).toContainEqual({ kind: "weakness" });
  });
  it("does not double on other rolls", () => {
    const monster = makeMonster({ hp: 6, abilities: ["weakness"] });
    const result = resolvePlayerAttack(monster, 4, 4, Math.random);
    expect(result.damageDealt).toBe(4);
  });
});

describe("resolvePlayerAttack: Explosive", () => {
  it("destroys itself on a raw roll of 1 and deals its current HP to the player", () => {
    const monster = makeMonster({ hp: 5, abilities: ["explosive"] });
    const result = resolvePlayerAttack(monster, 1, 0, Math.random);
    expect(result).toEqual({
      damageDealt: 5,
      monsterDefeated: true,
      selfDestructDamageToPlayer: 5,
      events: [{ kind: "explosive" }],
    });
  });
  it("behaves normally on other rolls", () => {
    const monster = makeMonster({ hp: 6, abilities: ["explosive"] });
    const result = resolvePlayerAttack(monster, 4, 4, Math.random);
    expect(result.selfDestructDamageToPlayer).toBe(0);
    expect(result.damageDealt).toBe(4);
  });
});

describe("resolvePlayerAttack: roll-of-1 triggers", () => {
  it("Firebreath fires on a 1", () => {
    const monster = makeMonster({ abilities: ["firebreath"] });
    const result = resolvePlayerAttack(monster, 1, 0, Math.random);
    expect(result.events).toContainEqual({ kind: "firebreath" });
  });

  it("Horde fires on a 1", () => {
    const monster = makeMonster({ abilities: ["horde"] });
    const result = resolvePlayerAttack(monster, 1, 0, Math.random);
    expect(result.events).toContainEqual({ kind: "horde" });
  });

  it("Sorcery rolls a bonus die on a 1", () => {
    const monster = makeMonster({ abilities: ["sorcery"] });
    const result = resolvePlayerAttack(monster, 1, 0, fixedDie(5));
    expect(result.events).toContainEqual({ kind: "sorcery", bonus: 5 });
  });

  it("Deathtouch fires on a 1", () => {
    const monster = makeMonster({ abilities: ["deathtouch"] });
    const result = resolvePlayerAttack(monster, 1, 0, Math.random);
    expect(result.events).toContainEqual({ kind: "deathtouch" });
  });

  it("Necromancy fires on a 1", () => {
    const monster = makeMonster({ abilities: ["necromancy"] });
    const result = resolvePlayerAttack(monster, 1, 0, Math.random);
    expect(result.events).toContainEqual({ kind: "necromancy" });
  });

  it("Regeneration fires on a 1", () => {
    const monster = makeMonster({ abilities: ["regeneration"] });
    const result = resolvePlayerAttack(monster, 1, 0, Math.random);
    expect(result.events).toContainEqual({ kind: "regeneration", amount: 6 });
  });

  it("Paralyze rolls a duration on a 1", () => {
    const monster = makeMonster({ abilities: ["paralyze"] });
    const result = resolvePlayerAttack(monster, 1, 0, fixedDie(3));
    expect(result.events).toContainEqual({ kind: "paralyze", turns: 3 });
  });

  it("none of the roll-of-1 abilities fire on other rolls", () => {
    const monster = makeMonster({ abilities: ["firebreath", "horde", "sorcery", "deathtouch", "regeneration", "paralyze"] });
    const result = resolvePlayerAttack(monster, 4, 4, Math.random);
    expect(result.events).toEqual([]);
  });
});

describe("resolveSpellDamage", () => {
  it("deals ordinary damage and reports defeat once HP is exhausted", () => {
    const monster = makeMonster({ hp: 4 });
    const result = resolveSpellDamage(monster, 6); // Lightning
    expect(result).toEqual({ damageDealt: 4, monsterDefeated: true, blocked: null });
  });

  it("leaves the monster alive when damage is insufficient", () => {
    const monster = makeMonster({ hp: 10 });
    const result = resolveSpellDamage(monster, 5); // Fireball
    expect(result).toEqual({ damageDealt: 5, monsterDefeated: false, blocked: null });
  });

  it("Stoneskin ignores spell damage of 3 or less, but not Cold Ray's 4", () => {
    const monster = makeMonster({ abilities: ["stoneskin"] });
    expect(resolveSpellDamage(monster, 3).blocked).toBe("stoneskin");
    expect(resolveSpellDamage(monster, 4).blocked).toBeNull(); // Cold Ray
  });

  it("Intangible ignores even-numbered spell damage (blocks Cold Ray and Lightning, not Fireball)", () => {
    const monster = makeMonster({ abilities: ["intangible"] });
    expect(resolveSpellDamage(monster, 4).blocked).toBe("intangible"); // Cold Ray
    expect(resolveSpellDamage(monster, 6).blocked).toBe("intangible"); // Lightning
    expect(resolveSpellDamage(monster, 5).blocked).toBeNull(); // Fireball
  });

  it("does not trigger roll-of-1 abilities like a weapon attack would", () => {
    const monster = makeMonster({ hp: 20, abilities: ["explosive", "firebreath"] });
    const result = resolveSpellDamage(monster, 5);
    expect(result.damageDealt).toBe(5);
    expect(result.monsterDefeated).toBe(false);
  });
});

describe("checkUndeadRevival", () => {
  it("revives on a roll of 1", () => {
    const monster = makeMonster({ abilities: ["undead"] });
    expect(checkUndeadRevival(monster, fixedDie(1))).toBe(true);
  });
  it("does not revive on other rolls", () => {
    const monster = makeMonster({ abilities: ["undead"] });
    expect(checkUndeadRevival(monster, fixedDie(2))).toBe(false);
  });
  it("never revives without the Undead ability", () => {
    const monster = makeMonster({ abilities: [] });
    expect(checkUndeadRevival(monster, fixedDie(1))).toBe(false);
  });
});

describe("resolveMonsterTurn", () => {
  it("sums damage across every monster, including queued bonus damage", () => {
    const monsters = [makeMonster({ id: 1, damage: 3 }), makeMonster({ id: 2, damage: 1, bonusDamage: 10 })];
    const result = resolveMonsterTurn(monsters);
    expect(result.totalDamage).toBe(14);
    expect(result.deathtouchKill).toBe(false);
  });

  it("reports a Deathtouch kill when any monster has it pending", () => {
    const monsters = [makeMonster({ id: 1, deathtouchPending: true })];
    expect(resolveMonsterTurn(monsters).deathtouchKill).toBe(true);
  });
});

describe("rollLoot", () => {
  it("splits rolls into treasures (6), keys (5), and coins (<=4)", () => {
    const rng = sequenceDie([6, 5, 4, 1]);
    expect(rollLoot(4, rng)).toEqual({ coins: 2, treasures: 1, keys: 1 });
  });
  it("returns all zeros for zero rolls", () => {
    expect(rollLoot(0, Math.random)).toEqual({ coins: 0, treasures: 0, keys: 0 });
  });
});

describe("fixed spawn stat blocks", () => {
  it("Horde's Orc matches the ability text (6 HP, Damage 3, no abilities)", () => {
    expect(HORDE_ORC).toMatchObject({ name: "Orc", hp: 6, maxHp: 6, damage: 3, abilities: [] });
  });
  it("Necromancy's Skeleton matches the ability text (4 HP, Damage 1, Undead)", () => {
    expect(NECROMANCY_SKELETON).toMatchObject({ name: "Skeleton", hp: 4, maxHp: 4, damage: 1, abilities: ["undead"] });
  });
});
