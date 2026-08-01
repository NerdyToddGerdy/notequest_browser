import { describe, expect, it } from "vitest";
import { EVENT_TABLE, eventBandFor, type EventBand } from "../../data/events.ts";
import type { OverworldTerrain } from "../../data/hexTables.ts";
import type { CombatState } from "../dungeonState.ts";
import { fixedDie } from "../../test/mulberry32.ts";
import { spellKey } from "../character.ts";
import {
  applyEventEffect,
  eventAnimalAttack,
  eventFightRound,
  eventHirelingAttack,
  eventResolveDamage,
  fleeEvent,
  type FighterIdentity,
  canIgnoreEvent,
  canRerollEvent,
  eventSkipReason,
  hasStarStone,
  ignoreEvent,
  rerollEvent,
  rollTravelEvent,
  startEventCombat,
} from "../events.ts";
import { createInitialMilestones, createInitialTravelStats } from "../town.ts";
import type { AdventurerResources } from "../town.ts";

function makeResources(overrides: Partial<AdventurerResources> = {}): AdventurerResources {
  return {
    torches: 5,
    hp: 20,
    maxHp: 20,
    coins: 0,
    treasures: 0,
    keys: 0,
    heldItems: [],
    consumables: [],
    armor: [],
    weapon: null,
    spareWeapons: [],
    spareArmor: [],
    spellUses: {},
    maxSpellUses: {},
    monsterKills: 0,
    bossKills: 0,
    killsByName: {},
    killsByAbility: {},
    provisions: 10,
    advancedClasses: [],
    hireling: null,
    hirelingHp: null,
    curiosities: {},
    animals: [],
    milestones: createInitialMilestones(),
    buildings: [],
    troops: 0,
    troopSources: [],
    travelStats: createInitialTravelStats(),
    survivedRunIds: [],
    flyActive: false,
    catatonic: false,
    mutations: [],
    zombieRevivals: 0,
    nextDungeonDamageBonus: 0,
    ...overrides,
  };
}

const STAR_STONE = {
  piece: "wonderItem" as const,
  hp: 0,
  maxHp: 0,
  itemName: "Star Stone",
};

describe("eventBandFor", () => {
  it("maps the printed table's three outcome bands, and nothing at 7+", () => {
    expect(eventBandFor(2)).toBe(2);
    expect(eventBandFor(3)).toBe(34);
    expect(eventBandFor(4)).toBe(34);
    expect(eventBandFor(5)).toBe(56);
    expect(eventBandFor(6)).toBe(56);
    for (const total of [7, 8, 9, 10, 11, 12]) expect(eventBandFor(total)).toBeNull();
  });
});

describe("EVENT_TABLE completeness", () => {
  const terrains: OverworldTerrain[] = [
    "plain",
    "mountain",
    "forest",
    "swamp",
    "desert",
    "tundra",
    "water",
    "glacier",
  ];
  const bands: EventBand[] = [2, 34, 56];

  it("has a row for every terrain in all three bands", () => {
    for (const terrain of terrains) {
      for (const band of bands) {
        const row = EVENT_TABLE[terrain][band];
        expect(row, `${terrain} band ${band}`).toBeDefined();
        expect(row.text.length, `${terrain} band ${band}`).toBeGreaterThan(0);
      }
    }
  });

  it("gives every row exactly one of monsters/effect", () => {
    for (const terrain of terrains) {
      for (const band of bands) {
        const row = EVENT_TABLE[terrain][band];
        const hasMonsters = row.monsters !== undefined;
        const hasEffect = row.effect !== undefined;
        expect(hasMonsters !== hasEffect, `${terrain} band ${band}`).toBe(true);
      }
    }
  });

  it("puts a monster in the result-2 slot of every terrain except glacier", () => {
    for (const terrain of terrains) {
      if (terrain === "glacier") continue;
      expect(EVENT_TABLE[terrain][2].monsters, terrain).toBeDefined();
    }
    // Glacier's own result-2 is Cracked Ice -- the one instantly-fatal Event.
    expect(EVENT_TABLE.glacier[2].effect).toEqual({ kind: "instantDeath" });
  });
});

describe("rollTravelEvent", () => {
  it('finds no Event on a 2d6 of 7 or more ("nothing happened")', () => {
    // 4 + 4 = 8.
    const roll = rollTravelEvent(makeResources(), "Human", "plain", fixedDie(4));
    expect(roll).toEqual({ kind: "none", total: 8, dice: [4, 4] });
  });

  it("finds the terrain's own Event on a total of 6 or less", () => {
    // 1 + 1 = 2 -> the result-2 column.
    const roll = rollTravelEvent(makeResources(), "Human", "mountain", fixedDie(1));
    expect(roll.kind).toBe("event");
    if (roll.kind !== "event") return;
    expect(roll.total).toBe(2);
    expect(roll.band).toBe(2);
    expect(roll.row.monsters?.name).toBe("Dragon");
  });

  it("reads the band boundaries off the same terrain row", () => {
    // 2 + 2 = 4 -> the 3-or-4 column; 3 + 3 = 6 -> the 5-or-6 column.
    const band34 = rollTravelEvent(makeResources(), "Human", "forest", fixedDie(2));
    expect(band34.kind === "event" && band34.row.monsters?.name).toBe("Goblins");
    const band56 = rollTravelEvent(makeResources(), "Human", "forest", fixedDie(3));
    expect(band56.kind === "event" && band56.row.effect).toEqual({
      kind: "loseProvisions",
      amount: 1,
    });
  });
});

describe("eventSkipReason (passive skips)", () => {
  it("skips the roll entirely for Patovsky", () => {
    expect(eventSkipReason(makeResources(), "Patovsky")).not.toBeNull();
    const roll = rollTravelEvent(makeResources(), "Patovsky", "mountain", fixedDie(1));
    expect(roll.kind).toBe("skipped");
  });

  it("skips the roll entirely while an Elf Ranger is employed", () => {
    const withRanger = makeResources({ hireling: "Elf Ranger" });
    expect(eventSkipReason(withRanger, "Human")).not.toBeNull();
    expect(rollTravelEvent(withRanger, "Human", "mountain", fixedDie(1)).kind).toBe("skipped");
  });

  it("does not skip for an ordinary race with an unrelated hireling", () => {
    expect(eventSkipReason(makeResources({ hireling: "Mercenary" }), "Human")).toBeNull();
    // Sharkin shares Patovsky's water-walking but not its Event immunity.
    expect(eventSkipReason(makeResources(), "Sharkin")).toBeNull();
  });
});

describe("Camouflage (canIgnoreEvent / ignoreEvent)", () => {
  const withCamouflage = (uses: number) =>
    makeResources({
      spellUses: { [spellKey("nature", 3)]: uses },
      maxSpellUses: { [spellKey("nature", 3)]: 2 },
    });

  it("is offered only in a forest or swamp, and only with a use left", () => {
    expect(canIgnoreEvent(withCamouflage(1), "forest")).toBe(true);
    expect(canIgnoreEvent(withCamouflage(1), "swamp")).toBe(true);
    expect(canIgnoreEvent(withCamouflage(1), "mountain")).toBe(false);
    expect(canIgnoreEvent(withCamouflage(0), "forest")).toBe(false);
    expect(canIgnoreEvent(makeResources(), "forest")).toBe(false);
  });

  it("spends exactly one use", () => {
    const after = ignoreEvent(withCamouflage(2), "forest");
    expect(after.spellUses[spellKey("nature", 3)]).toBe(1);
  });

  it("spends nothing when it isn't usable", () => {
    const before = withCamouflage(1);
    expect(ignoreEvent(before, "desert")).toBe(before);
  });
});

describe("Star Stone (canRerollEvent / rerollEvent)", () => {
  it("needs both the item and a provision to spend", () => {
    expect(hasStarStone(makeResources({ armor: [STAR_STONE] }))).toBe(true);
    expect(canRerollEvent(makeResources({ armor: [STAR_STONE] }))).toBe(true);
    expect(canRerollEvent(makeResources({ armor: [STAR_STONE], provisions: 0 }))).toBe(false);
    expect(canRerollEvent(makeResources({ provisions: 5 }))).toBe(false);
  });

  it("spends the provision and rerolls, even into another Event", () => {
    const before = makeResources({ armor: [STAR_STONE], provisions: 4 });
    // 1 + 1 = 2 again -- the provision is still spent ("pay then roll").
    const result = rerollEvent(before, "Human", "mountain", fixedDie(1));
    expect(result.resources.provisions).toBe(3);
    expect(result.roll.kind).toBe("event");
  });

  it("can reroll into nothing at all, which is the point", () => {
    const before = makeResources({ armor: [STAR_STONE], provisions: 4 });
    const result = rerollEvent(before, "Human", "mountain", fixedDie(5)); // 5 + 5 = 10
    expect(result.resources.provisions).toBe(3);
    expect(result.roll).toEqual({ kind: "none", total: 10, dice: [5, 5] });
  });

  it("spends nothing when unusable", () => {
    const before = makeResources({ provisions: 4 });
    const result = rerollEvent(before, "Human", "mountain", fixedDie(1));
    expect(result.resources).toBe(before);
  });
});

describe("applyEventEffect (non-combat outcomes)", () => {
  it("loses provisions, flooring at 0 rather than converting to HP damage", () => {
    const result = applyEventEffect(makeResources({ provisions: 1 }), {
      kind: "loseProvisions",
      amount: 2,
    });
    expect(result.resources.provisions).toBe(0);
    expect(result.resources.hp).toBe(20); // unlike payTravelCost, a shortfall is not a debt
    expect(result.died).toBe(false);
  });

  it("loses HP but can never kill (floored at 1)", () => {
    const result = applyEventEffect(makeResources({ hp: 2 }), { kind: "loseHp", amount: 2 });
    expect(result.resources.hp).toBe(1);
    expect(result.died).toBe(false);
  });

  it("takes the full HP loss when there is room for it", () => {
    const result = applyEventEffect(makeResources({ hp: 20 }), { kind: "loseHp", amount: 2 });
    expect(result.resources.hp).toBe(18);
  });

  it("flags a relocation for Storm without touching resources", () => {
    const before = makeResources();
    const result = applyEventEffect(before, { kind: "moveToRandomHex" });
    expect(result.relocate).toBe(true);
    expect(result.died).toBe(false);
    expect(result.resources).toBe(before);
  });

  it("flags death for Cracked Ice", () => {
    const result = applyEventEffect(makeResources(), { kind: "instantDeath" });
    expect(result.died).toBe(true);
    expect(result.relocate).toBe(false);
  });
});

/** Race and class aren't on `AdventurerResources` -- they're threaded into a fight (issue #120). */
const HUMAN: FighterIdentity = { raceName: "Human", className: "Fighter" };

describe("Event combat", () => {
  /** Issue #120: a wilderness fight now runs the shared core, so it takes the whole character --
   * these helpers pass real `AdventurerResources` where the old signature took a bare `hp`. */
  function fight(row: Parameters<typeof startEventCombat>[0], resources = makeResources()) {
    return startEventCombat(row, resources, fixedDie(3));
  }

  it("returns null for a non-monster Event row", () => {
    expect(fight(EVENT_TABLE.desert[34])).toBeNull();
  });

  it("spawns a fixed-count group with distinct ids", () => {
    const combat = fight(EVENT_TABLE.water[34])!;
    expect(combat.monsters).toHaveLength(4);
    expect(new Set(combat.monsters.map((m) => m.id)).size).toBe(4);
    expect(combat.monsters[0]!.name).toBe("Pirates");
    expect(combat.outcome).toBe("ongoing");
  });

  it("uses the singular name when a dice-based count rolls 1", () => {
    const combat = startEventCombat(EVENT_TABLE.forest[34], makeResources(), fixedDie(1))!;
    expect(combat.monsters).toHaveLength(1);
    expect(combat.monsters[0]!.name).toBe("Goblin");
  });

  it("only the targeted monster takes damage; survivors all counter-attack", () => {
    const resources = makeResources({ hp: 20, maxHp: 20 });
    const combat = fight(EVENT_TABLE.mountain[34], resources)!; // 2 Orcs, 6 HP, 3 dmg
    const result = eventFightRound(resources, HUMAN, combat, 1, 4, "1d6", fixedDie(4));
    expect(result.combat.monsters[0]!.hp).toBe(2);
    expect(result.combat.monsters[1]!.hp).toBe(6);
    expect(result.resources.hp).toBe(14);
    expect(result.combat.outcome).toBe("ongoing");
  });

  it("a downed monster stops counter-attacking", () => {
    const resources = makeResources({ hp: 20, maxHp: 20 });
    const combat = fight(EVENT_TABLE.mountain[34], resources)!;
    const result = eventFightRound(resources, HUMAN, combat, 1, 6, "1d6", fixedDie(6));
    expect(result.combat.monsters).toHaveLength(1); // the dead one is removed, as in a dungeon
    expect(result.resources.hp).toBe(17);
    expect(result.combat.outcome).toBe("ongoing");
  });

  it("rolls Loot once per Loot-tagged monster on victory, crediting it directly", () => {
    const resources = makeResources({ hp: 20, maxHp: 20 });
    const combat = fight(EVENT_TABLE.plain[34], resources)!; // a single Orc (Loot), 6 HP
    const result = eventFightRound(resources, HUMAN, combat, 1, 6, "1d6", fixedDie(6));
    expect(result.combat.outcome).toBe("victory");
    expect(result.resources.treasures).toBe(1); // one loot die of 6
    expect(result.resources.hp).toBe(20); // dead monsters don't counter
    expect(result.resources.monsterKills).toBe(1);
    expect(result.resources.killsByName).toEqual({ orc: 1 });
  });

  it("grants no loot for an untagged monster", () => {
    let resources = makeResources({ hp: 100, maxHp: 100 });
    let combat = fight(EVENT_TABLE.swamp[2], resources)!; // Moss Giant, 20 HP, no Loot
    for (let i = 0; i < 4 && combat.outcome === "ongoing"; i++) {
      const r = eventFightRound(resources, HUMAN, combat, 1, 6, "1d6+5", fixedDie(6));
      resources = r.resources;
      combat = r.combat;
    }
    expect(combat.outcome).toBe("victory");
    expect(resources.treasures).toBe(0);
    expect(resources.coins).toBe(0);
  });

  it("Firebreath queues a +10 counterattack on a raw roll of 1", () => {
    const resources = makeResources({ hp: 40, maxHp: 40 });
    const combat = fight(EVENT_TABLE.plain[2], resources)!; // Wyvern, 12 HP, 6 dmg
    const result = eventFightRound(resources, HUMAN, combat, 1, 1, "1d6", fixedDie(1));
    expect(result.combat.monsters[0]!.hp).toBe(11); // the raw-1 roll still dealt its 1 damage
    expect(result.resources.hp).toBe(40 - (6 + 10)); // base 6 plus the queued Firebreath 10
  });

  it("Regeneration heals the monster on a raw roll of 1", () => {
    const resources = makeResources({ hp: 40, maxHp: 40 });
    const combat = fight(EVENT_TABLE.forest[2], resources)!; // Troll, 10 HP, Regen
    const damaged: CombatState = { ...combat, monsters: [{ ...combat.monsters[0]!, hp: 2 }] };
    const result = eventFightRound(resources, HUMAN, damaged, 1, 1, "1d6", fixedDie(1));
    // 1 damage takes it to 1, then Regeneration's 6 heals back up (capped at maxHp 10).
    expect(result.combat.monsters[0]!.hp).toBe(7);
  });

  it("Explosive kills the player in the same blast that defeats the monster", () => {
    const resources = makeResources({ hp: 3, maxHp: 3 });
    const combat = startEventCombat(EVENT_TABLE.forest[34], resources, fixedDie(1))!; // 1 Goblin, Explosive
    const result = eventFightRound(resources, HUMAN, combat, 1, 1, "1d6", fixedDie(1));
    expect(result.died).toBe(true);
    expect(result.resources.hp).toBe(0);
    expect(result.combat.outcome).toBe("defeat");
  });

  it("defeat when the counter-attack takes the last HP", () => {
    const resources = makeResources({ hp: 5, maxHp: 5 });
    const combat = fight(EVENT_TABLE.mountain[2], resources)!; // Dragon, 7 dmg
    const result = eventFightRound(resources, HUMAN, combat, 1, 4, "1d6", fixedDie(4));
    expect(result.died).toBe(true);
    expect(result.combat.outcome).toBe("defeat");
  });

  it("is a no-op once the fight is over, or against an already-downed target", () => {
    const resources = makeResources({ hp: 10, maxHp: 10 });
    const combat = fight(EVENT_TABLE.mountain[34], resources)!;
    const won: CombatState = { ...combat, monsters: [], outcome: "victory" };
    expect(eventFightRound(resources, HUMAN, won, 1, 6, "1d6", fixedDie(6)).resources.hp).toBe(10);

    const downed: CombatState = {
      ...combat,
      monsters: [{ ...combat.monsters[0]!, hp: 0 }, combat.monsters[1]!],
    };
    const result = eventFightRound(resources, HUMAN, downed, 1, 6, "1d6", fixedDie(6));
    expect(result.resources.hp).toBe(10); // no round consumed, no counter-attack
  });
});

describe("issue #120: a wilderness fight is the character you built", () => {
  const ORCS = EVENT_TABLE.mountain[34]; // 2 Orcs, 6 HP, 3 dmg each

  it("armor absorbs, instead of every hit landing on HP", () => {
    const resources = makeResources({
      hp: 20,
      maxHp: 20,
      armor: [{ piece: "breastplate", hp: 10, maxHp: 10 }],
    });
    const combat = startEventCombat(ORCS, resources, fixedDie(3))!;
    const round = eventFightRound(resources, HUMAN, combat, 1, 4, "1d6", fixedDie(4));
    // The 6 incoming damage waits on a choice now, rather than silently hitting HP.
    expect(round.resources.hp).toBe(20);
    expect(round.combat.pendingDamage).toBe(6);

    const absorbed = eventResolveDamage(round.resources, HUMAN, round.combat, 0);
    expect(absorbed.resources.hp).toBe(20);
    expect(absorbed.resources.armor[0]!.hp).toBe(4);
  });

  it("attack bonuses and weapon effects apply -- an Ogre really does hit for +2", () => {
    const plain = makeResources({ hp: 30, maxHp: 30 });
    const OGRE: FighterIdentity = { raceName: "Ogre", className: "Fighter" };
    const combat = startEventCombat(ORCS, plain, fixedDie(3))!;
    const a = eventFightRound(plain, HUMAN, combat, 1, 3, "1d6", fixedDie(3));
    const b = eventFightRound(plain, OGRE, combat, 1, 3, "1d6", fixedDie(3));
    expect(a.combat.monsters[0]!.hp).toBe(3);
    expect(b.combat.monsters[0]!.hp).toBe(1);
  });

  it("a Hireling shows up, can absorb a hit, and can swing", () => {
    const resources = makeResources({
      hp: 20,
      maxHp: 20,
      hireling: "Mercenary",
      hirelingHp: 14,
    });
    const combat = startEventCombat(ORCS, resources, fixedDie(3))!;
    expect(combat.hireling).toEqual({ name: "Mercenary", hp: 14, maxHp: 14 });

    const swung = eventHirelingAttack(resources, HUMAN, combat, 1, 4);
    expect(swung.combat.monsters[0]!.hp).toBeLessThan(6);
    expect(swung.combat.hirelingAttackedThisRound).toBe(true);
  });

  it("a Samambro survives a killing blow out here too, which they never did before", () => {
    const resources = makeResources({ hp: 1, maxHp: 20 });
    const samambro: FighterIdentity = { raceName: "Samambro", className: "Fighter" };
    const combat = startEventCombat(EVENT_TABLE.mountain[2], resources, fixedDie(3))!; // Dragon
    // fixedDie(4) covers both the attack and Samambro's own 3+ survival roll.
    const result = eventFightRound(resources, samambro, combat, 1, 1, "1d6", fixedDie(4));
    expect(result.died).toBe(false);
    expect(result.resources.hp).toBe(1);
  });

  it("a Snake bites for free, once per round", () => {
    const resources = makeResources({ hp: 20, maxHp: 20, animals: ["Snake"] });
    const combat = startEventCombat(ORCS, resources, fixedDie(3))!;
    const bitten = eventAnimalAttack(resources, HUMAN, combat, 1);
    expect(bitten.combat.monsters[0]!.hp).toBe(5);
    expect(bitten.combat.animalAttackedThisRound).toBe(true);
    // Capped: a second bite in the same round does nothing.
    expect(
      eventAnimalAttack(bitten.resources, HUMAN, bitten.combat, 1).combat.monsters[0]!.hp,
    ).toBe(5);
  });

  it("running away is always possible, and costs a provision when you have one", () => {
    const stocked = fleeEvent(makeResources({ provisions: 4 }));
    expect(stocked.resources.provisions).toBe(3);

    // Never blocked by having nothing to pay with -- the point is that there's always an exit.
    const broke = fleeEvent(makeResources({ provisions: 0 }));
    expect(broke.resources.provisions).toBe(0);
    expect(broke.message).toBeTruthy();
  });
});
