import { describe, expect, it } from "vitest";
import { PORTAL_TABLE } from "../../data/portals.ts";
import { fixedDie, sequenceDie } from "../../test/mulberry32.ts";
import {
  createInitialWorldState,
  findNearestTown,
  hexKey,
  revealNeighborsInPlace,
  withAllCitiesRazed,
  withNewReality,
  withPortalTotal,
  type HexTile,
  type WorldState,
} from "../hexState.ts";
import { establishedPortal, resolvePortalOutcome, rollPortal } from "../portals.ts";
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

/** A hand-built world, so tests never depend on what the terrain tables happen to roll. */
function makeWorld(tiles: Record<string, HexTile>, player = { q: 0, r: 0 }): WorldState {
  return { climate: "hot", home: { q: 0, r: 0 }, player, tiles, hasBoat: false, bannedHexes: [] };
}

describe("PORTAL_TABLE completeness", () => {
  it("covers every 3d6 total from 3 to 18", () => {
    for (let total = 3; total <= 18; total++) {
      const row = PORTAL_TABLE[total];
      expect(row, `total ${total}`).toBeDefined();
      expect(row!.text.length, `total ${total}`).toBeGreaterThan(0);
    }
  });

  it("has no rows outside 3-18", () => {
    expect(
      Object.keys(PORTAL_TABLE)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
  });

  it("authors the six Other-World rows the rulebook prints, at their printed totals", () => {
    const worldRows = Object.entries(PORTAL_TABLE)
      .filter(([, row]) => row.outcome.kind === "otherWorld")
      .map(([total]) => Number(total))
      .sort((a, b) => a - b);
    expect(worldRows).toEqual([4, 5, 8, 16, 17, 18]);
  });
});

describe("rollPortal", () => {
  it("settles on whatever the dice say", () => {
    // 3 + 3 + 3 = 9 -> nearest town.
    const roll = rollPortal(fixedDie(3));
    expect(roll.total).toBe(9);
    expect(roll.dice).toEqual([3, 3, 3]);
    expect(roll.row.outcome).toEqual({ kind: "nearestTown" });
    expect(roll.skippedWorlds).toEqual([]);
  });

  it("reaches the Other Worlds -- they are no longer re-rolled past (issue #105)", () => {
    // 1 + 1 + 2 = 4 -> Hell. Stage 1 used to discard this and roll again.
    const roll = rollPortal(sequenceDie([1, 1, 2]));
    expect(roll.total).toBe(4);
    expect(roll.row.outcome).toEqual({ kind: "otherWorld", world: "hell" });
    expect(roll.skippedWorlds).toEqual([]);
  });

  it("reaches every world row at its printed total", () => {
    const worlds: Record<number, string> = {
      4: "hell",
      5: "pesadelum",
      8: "underworld",
      16: "pesadelum",
      17: "candyWorld",
      18: "hell",
    };
    for (const [total, world] of Object.entries(worlds)) {
      const outcome = PORTAL_TABLE[Number(total)]!.outcome;
      expect(outcome, `total ${total}`).toEqual({ kind: "otherWorld", world });
    }
  });

  it("a constant 6 now lands on Hell rather than falling back", () => {
    // 6 + 6 + 6 = 18. Stage 1's fallback existed only because this row was unresolvable.
    const roll = rollPortal(fixedDie(6));
    expect(roll.total).toBe(18);
    expect(roll.row.outcome).toEqual({ kind: "otherWorld", world: "hell" });
  });
});

describe("establishedPortal", () => {
  it("returns a remembered destination without rolling", () => {
    const established = establishedPortal(15);
    expect(established?.row.outcome).toEqual({ kind: "goldenRoom", coins: 300 });
  });

  it("replays an Other-World total -- a portal that led to Hell keeps leading to Hell (issue #105)", () => {
    for (const total of [4, 5, 8, 16, 17, 18]) {
      expect(establishedPortal(total)?.row.outcome.kind, `total ${total}`).toBe("otherWorld");
    }
  });

  it("refuses a nonsense total", () => {
    expect(establishedPortal(2)).toBeNull();
    expect(establishedPortal(19)).toBeNull();
  });
});

describe("findNearestTown", () => {
  const world = makeWorld({
    "0,0": { terrain: "plain", location: "portal" },
    "1,0": { terrain: "plain", location: "orcCity", name: "Grimhold" },
    "3,0": { terrain: "plain", location: "humanCity", name: "Haven" },
    "5,0": { terrain: "plain", location: null },
  });

  it("finds the closest City/Fortress of any culture", () => {
    expect(findNearestTown(world, { q: 0, r: 0 }, false)).toEqual({ q: 1, r: 0 });
  });

  it("narrows to a human city when asked, even though it's further", () => {
    expect(findNearestTown(world, { q: 0, r: 0 }, true)).toEqual({ q: 3, r: 0 });
  });

  it("excludes the hex being measured from", () => {
    const standingInTown = makeWorld({
      "0,0": { terrain: "plain", location: "humanCity", name: "Here" },
      "2,0": { terrain: "plain", location: "humanCity", name: "There" },
    });
    expect(findNearestTown(standingInTown, { q: 0, r: 0 }, true)).toEqual({ q: 2, r: 0 });
  });

  it("returns null when nothing qualifies", () => {
    const townless = makeWorld({
      "0,0": { terrain: "plain", location: "portal" },
      "1,0": { terrain: "plain", location: null },
    });
    expect(findNearestTown(townless, { q: 0, r: 0 }, false)).toBeNull();
  });
});

describe("withAllCitiesRazed (roll of 6)", () => {
  const world = makeWorld({
    "0,0": { terrain: "plain", location: "humanCity", name: "Haven", dungeonRunId: "run-1" },
    "1,0": { terrain: "mountain", location: "orcFortress", name: "Grimhold" },
    "2,0": { terrain: "plain", location: "ruins" },
    "3,0": { terrain: "plain", location: null, building: "Castle" },
    "4,0": { terrain: "water", location: null },
  });
  const razed = withAllCitiesRazed(world);

  it("turns every City and Fortress into Ruins and drops their names", () => {
    expect(razed.tiles["0,0"]).toMatchObject({ location: "ruins" });
    expect(razed.tiles["0,0"]!.name).toBeUndefined();
    expect(razed.tiles["1,0"]).toMatchObject({ location: "ruins" });
    expect(razed.tiles["1,0"]!.name).toBeUndefined();
  });

  it("keeps a dungeon already tied to a razed hex", () => {
    expect(razed.tiles["0,0"]!.dungeonRunId).toBe("run-1");
  });

  it("leaves non-city hexes -- including the player's own buildings -- untouched", () => {
    expect(razed.tiles["2,0"]).toEqual(world.tiles["2,0"]);
    expect(razed.tiles["3,0"]).toEqual(world.tiles["3,0"]);
    expect(razed.tiles["4,0"]).toEqual(world.tiles["4,0"]);
  });
});

describe("withNewReality (roll of 12)", () => {
  it("replaces the map entirely and drops the boat", () => {
    const old = { ...createInitialWorldState(fixedDie(3)), hasBoat: true };
    const fresh = withNewReality(old, fixedDie(4));
    expect(fresh.hasBoat).toBe(false);
    expect(fresh.player).toEqual({ q: 0, r: 0 });
    expect(fresh.tiles).not.toBe(old.tiles);
  });

  it("carries the plains-become-water curse across realities", () => {
    const cursed = { ...createInitialWorldState(fixedDie(3)), plainsRevealAsWater: true };
    expect(withNewReality(cursed, fixedDie(4)).plainsRevealAsWater).toBe(true);
  });
});

describe("plainsRevealAsWater (roll of 13)", () => {
  it("turns newly-revealed plains into water, leaving already-known tiles alone", () => {
    const tiles: Record<string, HexTile> = { "0,0": { terrain: "plain", location: null } };
    // Terrain roll 6 off a plain yields "plain" in HOT_TERRAIN_TABLE; the location roll then misses.
    revealNeighborsInPlace(tiles, { q: 0, r: 0 }, "hot", sequenceDie([6, 1]), true);
    expect(tiles["0,0"]!.terrain).toBe("plain"); // the origin is untouched
    for (const [key, tile] of Object.entries(tiles)) {
      if (key === "0,0") continue;
      expect(tile.terrain, key).toBe("water");
    }
  });

  it("leaves plains alone when the curse isn't active", () => {
    const tiles: Record<string, HexTile> = { "0,0": { terrain: "plain", location: null } };
    revealNeighborsInPlace(tiles, { q: 0, r: 0 }, "hot", sequenceDie([6, 1]), false);
    expect(
      Object.entries(tiles)
        .filter(([k]) => k !== "0,0")
        .every(([, t]) => t.terrain === "plain"),
    ).toBe(true);
  });
});

describe("withPortalTotal", () => {
  it("remembers a portal's established destination", () => {
    const world = makeWorld({ "0,0": { terrain: "plain", location: "portal" } });
    expect(withPortalTotal(world, { q: 0, r: 0 }, 11).tiles["0,0"]!.portalTotal).toBe(11);
  });

  it("is a no-op for a hex that doesn't exist", () => {
    const world = makeWorld({ "0,0": { terrain: "plain", location: "portal" } });
    expect(withPortalTotal(world, { q: 9, r: 9 }, 11)).toBe(world);
  });
});

describe("resolvePortalOutcome", () => {
  const from = { q: 0, r: 0 };
  const world = makeWorld({
    "0,0": { terrain: "plain", location: "portal" },
    "1,0": { terrain: "plain", location: "orcCity", name: "Grimhold" },
    "3,0": { terrain: "plain", location: "humanCity", name: "Haven" },
  });

  it("flags death for the vanish row, touching nothing else", () => {
    const r = resolvePortalOutcome({ kind: "vanish" }, makeResources(), world, from);
    expect(r.died).toBe(true);
    expect(r.world).toBe(world);
  });

  it("moves the player to the nearest town and names it", () => {
    const r = resolvePortalOutcome({ kind: "nearestTown" }, makeResources(), world, from);
    expect(r.world.player).toEqual({ q: 1, r: 0 });
    expect(r.message).toContain("Grimhold");
  });

  it("moves the player to the nearest human city specifically", () => {
    const r = resolvePortalOutcome({ kind: "nearestHumanCity" }, makeResources(), world, from);
    expect(r.world.player).toEqual({ q: 3, r: 0 });
    expect(r.message).toContain("Haven");
  });

  it("leaves the player put when no town qualifies, rather than stranding them", () => {
    const townless = makeWorld({ "0,0": { terrain: "plain", location: "portal" } });
    const r = resolvePortalOutcome({ kind: "nearestTown" }, makeResources(), townless, from);
    expect(r.world.player).toEqual(from);
    expect(r.died).toBe(false);
    expect(r.message).toContain("no town");
  });

  it("drops a hired boat when a portal deposits you inland", () => {
    const sailing = { ...world, hasBoat: true };
    const r = resolvePortalOutcome({ kind: "nearestTown" }, makeResources(), sailing, from);
    expect(r.world.hasBoat).toBe(false);
  });

  it("razes every city for the future row", () => {
    const r = resolvePortalOutcome({ kind: "futureRuins" }, makeResources(), world, from);
    expect(r.world.tiles["1,0"]!.location).toBe("ruins");
    expect(r.world.tiles["3,0"]!.location).toBe("ruins");
  });

  it("asks for a destination rather than moving, for both picker rows", () => {
    for (const kind of ["chooseAnyHex", "slimemenCity"] as const) {
      const r = resolvePortalOutcome({ kind }, makeResources(), world, from);
      expect(r.awaitDestination, kind).toBe(true);
      expect(r.world.player, kind).toEqual(from);
    }
  });

  it("sets the curse flag for the plains row without moving anyone", () => {
    const r = resolvePortalOutcome({ kind: "plainsBecomeWater" }, makeResources(), world, from);
    expect(r.world.plainsRevealAsWater).toBe(true);
    expect(r.world.player).toEqual(from);
  });

  it("credits the golden room's coins and chains a second portal", () => {
    const r = resolvePortalOutcome(
      { kind: "goldenRoom", coins: 300 },
      makeResources({ coins: 7 }),
      world,
      from,
    );
    expect(r.resources.coins).toBe(307);
    expect(r.chainAnotherPortal).toBe(true);
  });

  it("flags the exit-less dungeon row for the caller", () => {
    const r = resolvePortalOutcome({ kind: "noExitDungeon" }, makeResources(), world, from);
    expect(r.enterNoExitDungeon).toBe(true);
  });

  it("regenerates the map for the new-reality row", () => {
    const real = { ...createInitialWorldState(fixedDie(3)), player: { q: 1, r: 0 } };
    const r = resolvePortalOutcome(
      { kind: "newMap" },
      makeResources(),
      real,
      { q: 1, r: 0 },
      fixedDie(4),
    );
    expect(r.world.player).toEqual({ q: 0, r: 0 });
    expect(r.world.tiles[hexKey({ q: 0, r: 0 })]!.location).toBe("humanCity");
  });
});
