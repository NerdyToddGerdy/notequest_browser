import { describe, expect, it } from "vitest";
import { LOCATION_EFFECTS, LOCATION_EFFECT_NOTES } from "../../data/locationEffects.ts";
import { RUINS_DUNGEON_TYPE, isRuinsTerrain, LOCATION_TABLE } from "../../data/hexTables.ts";
import { DUNGEON_TYPES } from "../../data/dungeonTypes.ts";
import { fixedDie, mulberry32 } from "../../test/mulberry32.ts";
import { createInitialWorldState, rollRuinsDungeon, withUniqueDungeonPlaced } from "../hexState.ts";
import { hexReducer } from "../hexReducer.ts";
import { effectForLocation, resolveLocationEffect } from "../locationEffects.ts";
import {
  createInitialMilestones,
  createInitialTravelStats,
  type AdventurerResources,
} from "../town.ts";

/** Issue #98: location entry effects, and the Ruins' own 2d6 dungeon table. */

function makeResources(overrides: Partial<AdventurerResources> = {}): AdventurerResources {
  return {
    torches: 5,
    hp: 10,
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
    provisions: 5,
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

describe("which locations have an entry effect", () => {
  it("covers Oasis, Thin Ice and Reef", () => {
    expect(effectForLocation("oasis")).toEqual({ kind: "oasis" });
    expect(effectForLocation("thinIce")).toEqual({ kind: "thinIce" });
    expect(effectForLocation("reef")).toEqual({ kind: "reef" });
  });

  it("deliberately excludes Volcano -- its only content is a Volcanic Cave (#30)", () => {
    expect(effectForLocation("volcano")).toBeNull();
    // ...but it isn't left silent: the hex says what's there and why you can't enter.
    expect(LOCATION_EFFECT_NOTES.volcano).toContain("Volcanic Cave");
  });

  it("leaves every location that already had real behavior alone", () => {
    for (const loc of [
      "humanCity",
      "humanFortress",
      "ruins",
      "rocks",
      "portal",
      "nothing",
    ] as const) {
      expect(LOCATION_EFFECTS[loc], loc).toBeUndefined();
    }
  });
});

describe("Oasis", () => {
  it("is a mirage on 4 or less", () => {
    for (const roll of [1, 2, 3, 4]) {
      const r = resolveLocationEffect({ kind: "oasis" }, makeResources({ hp: 10 }), fixedDie(roll));
      expect(r.resources.hp, `roll ${roll}`).toBe(10);
      expect(r.message, `roll ${roll}`).toContain("never there");
    }
  });

  it("recovers all lost HP on 5 or 6", () => {
    for (const roll of [5, 6]) {
      const r = resolveLocationEffect(
        { kind: "oasis" },
        makeResources({ hp: 10, maxHp: 20 }),
        fixedDie(roll),
      );
      expect(r.resources.hp, `roll ${roll}`).toBe(20);
    }
  });

  it("never exceeds maxHp", () => {
    const r = resolveLocationEffect(
      { kind: "oasis" },
      makeResources({ hp: 20, maxHp: 20 }),
      fixedDie(6),
    );
    expect(r.resources.hp).toBe(20);
  });
});

describe("Thin Ice", () => {
  it("kills on a 1 -- no survival floor, as written", () => {
    const r = resolveLocationEffect({ kind: "thinIce" }, makeResources({ hp: 999 }), fixedDie(1));
    expect(r.died).toBe(true);
  });

  it("is harmless on 2 through 6", () => {
    for (const roll of [2, 3, 4, 5, 6]) {
      const r = resolveLocationEffect({ kind: "thinIce" }, makeResources(), fixedDie(roll));
      expect(r.died, `roll ${roll}`).toBe(false);
      expect(r.resources.hp, `roll ${roll}`).toBe(10);
    }
  });

  it("only generates on cold terrain, which is why it needed #101 to be reachable at all", () => {
    const onCold = Object.values(LOCATION_TABLE).some((row) => row.glacier === "thinIce");
    expect(onCold).toBe(true);
    const onAnyHot = Object.values(LOCATION_TABLE).some((row) =>
      [row.plain, row.mountain, row.forest, row.swamp, row.desert, row.water].includes("thinIce"),
    );
    expect(onAnyHot).toBe(false);
  });
});

describe("Reef", () => {
  it("runs aground on a 1, costing a provision", () => {
    const r = resolveLocationEffect(
      { kind: "reef" },
      makeResources({ provisions: 5 }),
      fixedDie(1),
    );
    expect(r.resources.provisions).toBe(4);
    expect(r.foundUnbuiltCave).toBe(false);
  });

  it("can't drive provisions negative", () => {
    const r = resolveLocationEffect(
      { kind: "reef" },
      makeResources({ provisions: 0 }),
      fixedDie(1),
    );
    expect(r.resources.provisions).toBe(0);
  });

  it("does nothing on a 2 -- the rulebook's own gap", () => {
    const before = makeResources({ provisions: 5 });
    const r = resolveLocationEffect({ kind: "reef" }, before, fixedDie(2));
    expect(r.resources.provisions).toBe(5);
    expect(r.foundUnbuiltCave).toBe(false);
    expect(r.died).toBe(false);
  });

  it("finds an Underwater Cave on 3 or more, flagged rather than substituted", () => {
    for (const roll of [3, 4, 5, 6]) {
      const r = resolveLocationEffect({ kind: "reef" }, makeResources(), fixedDie(roll));
      expect(r.foundUnbuiltCave, `roll ${roll}`).toBe(true);
      expect(r.message, `roll ${roll}`).toContain("Underwater Cave");
    }
  });
});

describe("the Ruins 2d6 dungeon table", () => {
  const terrains = ["plain", "mountain", "forest", "tundra"] as const;

  it("has a column for exactly the terrains Ruins can generate on", () => {
    for (const t of terrains) expect(isRuinsTerrain(t), t).toBe(true);
    for (const t of ["swamp", "desert", "water", "glacier"] as const) {
      expect(isRuinsTerrain(t), t).toBe(false);
    }
    // ...and LOCATION_TABLE agrees -- Ruins never appear anywhere else.
    for (const row of Object.values(LOCATION_TABLE)) {
      for (const [terrain, loc] of Object.entries(row)) {
        if (loc === "ruins") expect(isRuinsTerrain(terrain as never), terrain).toBe(true);
      }
    }
  });

  it("covers every 2d6 total on every column, and every value is a real dungeon type", () => {
    for (const t of terrains) {
      for (let total = 2; total <= 12; total++) {
        const cell = RUINS_DUNGEON_TYPE[t][total];
        expect(cell, `${t} ${total}`).toBeDefined();
        expect(DUNGEON_TYPES[cell!.typeRoll], `${t} ${total} -> ${cell!.typeRoll}`).toBeDefined();
      }
    }
  });

  it("marks exactly one asterisked cell per column, all on a 12", () => {
    for (const t of terrains) {
      const unique = Object.entries(RUINS_DUNGEON_TYPE[t]).filter(([, c]) => c.unique);
      expect(unique, t).toHaveLength(1);
      expect(Number(unique[0]![0]), t).toBe(12);
    }
  });

  it("rolls a type for a Ruins hex", () => {
    const world = createInitialWorldState(mulberry32(1));
    // 1 + 1 = 2 -> the Cave band.
    const rolled = rollRuinsDungeon(world, "plain", fixedDie(1));
    expect(rolled?.typeRoll).toBe(RUINS_DUNGEON_TYPE.plain[2]!.typeRoll);
    expect(rolled?.placed).toBeNull();
  });

  it("reports a unique dungeon as newly placed the first time", () => {
    const world = createInitialWorldState(mulberry32(1));
    // 6 + 6 = 12 -> the asterisked row.
    const rolled = rollRuinsDungeon(world, "plain", fixedDie(6));
    expect(rolled?.placed).toBe("entrails");
  });

  it("re-rolls a unique dungeon that this world already placed", () => {
    let world = createInitialWorldState(mulberry32(1));
    world = withUniqueDungeonPlaced(world, "entrails");
    // A constant 6 would land on 12 forever; the re-roll must escape it and place nothing.
    const rolled = rollRuinsDungeon(world, "plain", fixedDie(6));
    expect(rolled?.placed).toBeNull();
  });

  it("tracks uniqueness by the notional rulebook type, not the substitute it builds", () => {
    // Plains 12 (Entrails) and Plains 10-11 (Pyramid) currently share a typeRoll, since Entrails
    // isn't built. Marking Entrails used must not lock Pyramid out of the world.
    expect(RUINS_DUNGEON_TYPE.plain[12]!.typeRoll).toBe(RUINS_DUNGEON_TYPE.plain[10]!.typeRoll);
    let world = createInitialWorldState(mulberry32(1));
    world = withUniqueDungeonPlaced(world, "entrails");
    // 5 + 5 = 10 -> the non-unique row with the same typeRoll; still perfectly rollable.
    const rolled = rollRuinsDungeon(world, "plain", fixedDie(5));
    expect(rolled?.typeRoll).toBe(RUINS_DUNGEON_TYPE.plain[10]!.typeRoll);
    expect(rolled?.placed).toBeNull();
  });

  it("records a placement once, idempotently", () => {
    const world = withUniqueDungeonPlaced(createInitialWorldState(mulberry32(1)), "megaDungeon");
    expect(withUniqueDungeonPlaced(world, "megaDungeon").uniqueDungeonsPlaced).toEqual([
      "megaDungeon",
    ]);
  });

  it("returns null for a Ruins on terrain the table has no column for", () => {
    const world = createInitialWorldState(mulberry32(1));
    expect(rollRuinsDungeon(world, "desert", fixedDie(3))).toBeNull();
  });
});

describe("reaching a Reef at all", () => {
  it("needs a boat -- a Reef only ever generates on water", () => {
    // Confirms the location table's own placement, which is what makes Reef the one entry effect
    // that can't be reached on foot.
    const onWaterOnly = Object.values(LOCATION_TABLE).every(
      (row) =>
        !["plain", "mountain", "forest", "swamp", "desert", "glacier", "tundra"].some(
          (t) => row[t as keyof typeof row] === "reef",
        ),
    );
    expect(onWaterOnly).toBe(true);
    expect(Object.values(LOCATION_TABLE).some((row) => row.water === "reef")).toBe(true);
  });

  it("MOVE onto a water Reef succeeds with a boat and is refused without one", () => {
    const world = {
      climate: "hot" as const,
      home: { q: 0, r: 0 },
      player: { q: 0, r: 0 },
      hasBoat: false,
      bannedHexes: [],
      tiles: {
        "0,0": { terrain: "plain" as const, location: null },
        "1,0": { terrain: "water" as const, location: "reef" as const },
      },
    };
    const move = { type: "MOVE" as const, to: { q: 1, r: 0 }, raceName: "Human" };
    expect(hexReducer(world, move, mulberry32(1)).player).toEqual({ q: 0, r: 0 }); // no boat
    expect(hexReducer({ ...world, hasBoat: true }, move, mulberry32(1)).player).toEqual({
      q: 1,
      r: 0,
    });
  });
});
