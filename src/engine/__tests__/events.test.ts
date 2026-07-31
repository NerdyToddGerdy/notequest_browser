import { describe, expect, it } from "vitest";
import { EVENT_TABLE, eventBandFor, type EventBand } from "../../data/events.ts";
import type { OverworldTerrain } from "../../data/hexTables.ts";
import { fixedDie } from "../../test/mulberry32.ts";
import { spellKey } from "../character.ts";
import {
  applyEventEffect,
  applyEventVictory,
  canIgnoreEvent,
  canRerollEvent,
  eventSkipReason,
  hasStarStone,
  ignoreEvent,
  rerollEvent,
  resolveEventRound,
  rollTravelEvent,
  startEventCombat,
  type EventCombatState,
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

describe("Event combat", () => {
  it("returns null for a non-monster Event row", () => {
    expect(startEventCombat(EVENT_TABLE.desert[34], fixedDie(3))).toBeNull();
  });

  it("spawns a fixed-count group with distinct ids", () => {
    const state = startEventCombat(EVENT_TABLE.water[34], fixedDie(3))!;
    expect(state.monsters).toHaveLength(4);
    expect(new Set(state.monsters.map((m) => m.id)).size).toBe(4);
    expect(state.monsters[0]!.name).toBe("Pirates");
    expect(state.outcome).toBe("ongoing");
  });

  it("uses the singular name when a dice-based count rolls 1", () => {
    const state = startEventCombat(EVENT_TABLE.forest[34], fixedDie(1))!;
    expect(state.monsters).toHaveLength(1);
    expect(state.monsters[0]!.name).toBe("Goblin");
  });

  it("only the targeted monster takes damage; survivors all counter-attack", () => {
    const state = startEventCombat(EVENT_TABLE.mountain[34], fixedDie(3))!; // 2 Orcs, 6 HP, 3 dmg
    // Weapon rolls 4 -> 4 damage to Orc #1 (survives at 2 HP), then both Orcs hit for 3 each.
    const result = resolveEventRound(state, 20, "1d6", 1, 4, fixedDie(4));
    expect(result.state.monsters[0]!.hp).toBe(2);
    expect(result.state.monsters[1]!.hp).toBe(6);
    expect(result.hp).toBe(14);
    expect(result.state.outcome).toBe("ongoing");
  });

  it("a downed monster stops counter-attacking", () => {
    const state = startEventCombat(EVENT_TABLE.mountain[34], fixedDie(3))!;
    // 6 damage kills Orc #1 outright; only Orc #2 counters, for 3.
    const result = resolveEventRound(state, 20, "1d6", 1, 6, fixedDie(6));
    expect(result.state.monsters[0]!.hp).toBe(0);
    expect(result.hp).toBe(17);
    expect(result.state.outcome).toBe("ongoing");
  });

  it("rolls Loot once per Loot-tagged monster on victory", () => {
    // A single Orc (Loot), 6 HP: weapon roll 6 kills it, then one loot die of 6 -> 1 Treasure.
    const state = startEventCombat(EVENT_TABLE.plain[34], fixedDie(3))!;
    const result = resolveEventRound(state, 20, "1d6", 1, 6, fixedDie(6));
    expect(result.state.outcome).toBe("victory");
    expect(result.state.loot).toEqual({ coins: 0, treasures: 1, keys: 0 });
    expect(result.hp).toBe(20); // dead monsters don't counter
  });

  it("grants no loot for an untagged monster", () => {
    // Moss Giant: 20 HP, no Loot. Whittle it down with a big fixed weapon.
    let state = startEventCombat(EVENT_TABLE.swamp[2], fixedDie(3))!;
    let hp = 100;
    for (let i = 0; i < 4 && state.outcome === "ongoing"; i++) {
      const r = resolveEventRound(state, hp, "1d6+5", 1, 6, fixedDie(6));
      state = r.state;
      hp = r.hp;
    }
    expect(state.outcome).toBe("victory");
    expect(state.loot).toBeNull();
  });

  it("Firebreath queues a +10 counterattack on a raw roll of 1", () => {
    const state = startEventCombat(EVENT_TABLE.plain[2], fixedDie(3))!; // Wyvern, 12 HP, 6 dmg
    const result = resolveEventRound(state, 40, "1d6", 1, 1, fixedDie(1));
    expect(result.state.monsters[0]!.bonusDamage).toBe(10);
    expect(result.state.monsters[0]!.hp).toBe(11); // the raw-1 roll still dealt its 1 damage
    expect(result.hp).toBe(40 - (6 + 10)); // base 6 plus the queued Firebreath 10
  });

  it("Regeneration heals the monster on a raw roll of 1", () => {
    const state = startEventCombat(EVENT_TABLE.forest[2], fixedDie(3))!; // Troll, 10 HP, Regen
    const damaged: EventCombatState = {
      ...state,
      monsters: [{ ...state.monsters[0]!, hp: 2 }],
    };
    const result = resolveEventRound(damaged, 40, "1d6", 1, 1, fixedDie(1));
    // 1 damage takes it to 1, then Regeneration's 6 heals back up (capped at maxHp 10).
    expect(result.state.monsters[0]!.hp).toBe(7);
  });

  it("Explosive kills the player in the same blast that defeats the monster", () => {
    const state = startEventCombat(EVENT_TABLE.forest[34], fixedDie(1))!; // 1 Goblin, 3 HP, Explosive
    const result = resolveEventRound(state, 3, "1d6", 1, 1, fixedDie(1));
    expect(result.died).toBe(true);
    expect(result.hp).toBe(0);
    expect(result.state.outcome).toBe("defeat");
  });

  it("defeat when the counter-attack takes the last HP", () => {
    const state = startEventCombat(EVENT_TABLE.mountain[2], fixedDie(3))!; // Dragon, 7 dmg
    const result = resolveEventRound(state, 5, "1d6", 1, 4, fixedDie(4));
    expect(result.died).toBe(true);
    expect(result.state.outcome).toBe("defeat");
  });

  it("is a no-op once the fight is over, or against an already-downed target", () => {
    const won: EventCombatState = { monsters: [], outcome: "victory", loot: null };
    expect(resolveEventRound(won, 10, "1d6", 1, 6, fixedDie(6)).hp).toBe(10);

    const state = startEventCombat(EVENT_TABLE.mountain[34], fixedDie(3))!;
    const downed: EventCombatState = {
      ...state,
      monsters: [{ ...state.monsters[0]!, hp: 0 }, state.monsters[1]!],
    };
    const result = resolveEventRound(downed, 10, "1d6", 1, 6, fixedDie(6));
    expect(result.hp).toBe(10); // no round consumed, no counter-attack
    expect(result.state).toBe(downed);
  });
});

describe("applyEventVictory", () => {
  it("credits loot, HP, and kill tallies", () => {
    const state: EventCombatState = {
      monsters: [],
      outcome: "victory",
      loot: { coins: 2, treasures: 1, keys: 1 },
    };
    const after = applyEventVictory(makeResources({ hp: 20, coins: 5 }), state, 14, "Orcs", 2);
    expect(after.hp).toBe(14);
    expect(after.coins).toBe(7);
    expect(after.treasures).toBe(1);
    expect(after.keys).toBe(1);
    expect(after.monsterKills).toBe(2);
    expect(after.killsByName).toEqual({ orcs: 2 });
  });

  it("adds to an existing tally for the same name rather than replacing it", () => {
    const state: EventCombatState = { monsters: [], outcome: "victory", loot: null };
    const after = applyEventVictory(
      makeResources({ monsterKills: 3, killsByName: { orc: 3 } }),
      state,
      10,
      "Orc",
      1,
    );
    expect(after.monsterKills).toBe(4);
    expect(after.killsByName).toEqual({ orc: 4 });
  });
});
