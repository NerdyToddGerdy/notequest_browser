import { describe, expect, it } from "vitest";
import {
  canAttack,
  canRecruitTroop,
  recruitTroop,
  resolveAttack,
  resolveStorming,
} from "../warfare.ts";
import { hexKey, politicalStatusFor, type HexTile, type WorldState } from "../hexState.ts";
import { createInitialMilestones, createInitialTravelStats, type AdventurerResources } from "../town.ts";
import { sequenceDie } from "../../test/mulberry32.ts";

function makeResources(overrides: Partial<AdventurerResources> = {}): AdventurerResources {
  return {
    torches: 5,
    hp: 20,
    maxHp: 20,
    coins: 1000,
    treasures: 0,
    keys: 0,
    heldItems: [],
    armor: [],
    weapon: null,
    spareWeapons: [],
    spellUses: {},
    maxSpellUses: {},
    monsterKills: 0,
    bossKills: 0,
    killsByName: {},
    killsByAbility: {},
    provisions: 20,
    advancedClasses: [],
    hireling: null,
    animals: [],
    milestones: createInitialMilestones(),
    buildings: [],
    troops: 0,
    troopSources: [],
    travelStats: createInitialTravelStats(),
    ...overrides,
  };
}

const HOME = { q: 0, r: 0 };
const TARGET = { q: 1, r: 0 };

function makeWorld(tiles: Record<string, HexTile>, politicalStatus?: WorldState["politicalStatus"]): WorldState {
  return {
    climate: "hot",
    home: HOME,
    player: HOME,
    tiles,
    hasBoat: false,
    ...(politicalStatus ? { politicalStatus } : {}),
  };
}

describe("canRecruitTroop", () => {
  it("allows recruiting at an owned Castle/City/Fortress-tier building", () => {
    const world = makeWorld({ "0,0": { terrain: "plain", location: null, building: "Castle" } });
    expect(canRecruitTroop(makeResources(), world, HOME, world.tiles["0,0"])).toBe(true);
  });

  it("rejects House/Tower -- they can't muster troops", () => {
    const world = makeWorld({ "0,0": { terrain: "plain", location: null, building: "Tower" } });
    expect(canRecruitTroop(makeResources(), world, HOME, world.tiles["0,0"])).toBe(false);
  });

  it("allows recruiting at a Vassal hex with no player building at all", () => {
    const world = makeWorld({ "0,0": { terrain: "plain", location: "humanCity" } }, { "0,0": "vassal" });
    expect(canRecruitTroop(makeResources(), world, HOME, world.tiles["0,0"])).toBe(true);
  });

  it("rejects a plain ally/enemy hex with no building", () => {
    const world = makeWorld({ "0,0": { terrain: "plain", location: "humanCity" } }, { "0,0": "ally" });
    expect(canRecruitTroop(makeResources(), world, HOME, world.tiles["0,0"])).toBe(false);
  });

  it("rejects a hex that already has an unspent troop recruited", () => {
    const world = makeWorld({ "0,0": { terrain: "plain", location: null, building: "Castle" } });
    const resources = makeResources({ troopSources: ["0,0"] });
    expect(canRecruitTroop(resources, world, HOME, world.tiles["0,0"])).toBe(false);
  });

  it("requires enough coins", () => {
    const world = makeWorld({ "0,0": { terrain: "plain", location: null, building: "Castle" } });
    expect(canRecruitTroop(makeResources({ coins: 199 }), world, HOME, world.tiles["0,0"])).toBe(false);
    expect(canRecruitTroop(makeResources({ coins: 200 }), world, HOME, world.tiles["0,0"])).toBe(true);
  });
});

describe("recruitTroop", () => {
  it("spends 200 coins, adds a troop, and marks the source spent", () => {
    const world = makeWorld({ "0,0": { terrain: "plain", location: null, building: "Castle" } });
    const next = recruitTroop(makeResources({ coins: 1000 }), world, HOME, world.tiles["0,0"]);
    expect(next.coins).toBe(800);
    expect(next.troops).toBe(1);
    expect(next.troopSources).toEqual(["0,0"]);
  });

  it("is a no-op when canRecruitTroop would reject it", () => {
    const world = makeWorld({ "0,0": { terrain: "plain", location: null, building: "Tower" } });
    const resources = makeResources();
    expect(recruitTroop(resources, world, HOME, world.tiles["0,0"])).toEqual(resources);
  });
});

describe("canAttack", () => {
  it("allows attacking a City/Fortress hex that isn't already the player's Vassal", () => {
    const world = makeWorld({ "1,0": { terrain: "plain", location: "humanCity" } });
    expect(canAttack(world, TARGET, world.tiles["1,0"])).toBe(true);
  });

  it("blocks attacking the player's own Vassal", () => {
    const world = makeWorld({ "1,0": { terrain: "plain", location: "humanCity" } }, { "1,0": "vassal" });
    expect(canAttack(world, TARGET, world.tiles["1,0"])).toBe(false);
  });

  it("blocks a non-City/Fortress hex", () => {
    const world = makeWorld({ "1,0": { terrain: "plain", location: "ruins" } });
    expect(canAttack(world, TARGET, world.tiles["1,0"])).toBe(false);
  });

  it("blocks when the tile is undefined", () => {
    const world = makeWorld({});
    expect(canAttack(world, TARGET, undefined)).toBe(false);
  });
});

describe("resolveAttack", () => {
  it("wins when the troop roll sum meets the target's Defense (City: 6)", () => {
    const world = makeWorld({ "1,0": { terrain: "plain", location: "humanCity" } });
    const resources = makeResources({ troops: 2, troopSources: ["5,5"] });
    const outcome = resolveAttack(resources, world, TARGET, false, false, sequenceDie([4, 4]));
    expect(outcome.status).toBe("won");
    expect(outcome.resources.troops).toBe(0);
    expect(outcome.resources.troopSources).toEqual([]);
    expect(outcome.retaliation).toEqual([]);
  });

  it("loses when the sum falls short", () => {
    const world = makeWorld({ "1,0": { terrain: "plain", location: "humanCity" } });
    const resources = makeResources({ troops: 1 });
    const outcome = resolveAttack(resources, world, TARGET, false, false, sequenceDie([2]));
    expect(outcome.status).toBe("lost");
    expect(outcome.resources.troops).toBe(0); // still spent, even on a loss
  });

  it("a Fortress needs the higher Defense of 12", () => {
    const world = makeWorld({ "1,0": { terrain: "plain", location: "humanFortress" } });
    const resources = makeResources({ troops: 2 });
    const short = resolveAttack(resources, world, TARGET, true, false, sequenceDie([6, 5]));
    expect(short.status).toBe("lost"); // 11 < 12
    const enough = resolveAttack(resources, world, TARGET, true, false, sequenceDie([6, 6]));
    expect(enough.status).toBe("won"); // 12 >= 12
  });

  it("the character dies rolling a natural 1 while joining a lost battle", () => {
    const world = makeWorld({ "1,0": { terrain: "plain", location: "humanCity" } });
    const resources = makeResources({ troops: 0 });
    const outcome = resolveAttack(resources, world, TARGET, false, true, sequenceDie([1]));
    expect(outcome.status).toBe("lost-death");
  });

  it("rolling a natural 1 while joining does NOT kill the character if the battle is still won", () => {
    const world = makeWorld({ "1,0": { terrain: "plain", location: "humanCity" } });
    const resources = makeResources({ troops: 1 });
    // Troop roll 5, character roll 1 -- sum 6 meets City's Defense of 6.
    const outcome = resolveAttack(resources, world, TARGET, false, true, sequenceDie([5, 1]));
    expect(outcome.status).toBe("won");
  });

  it("Declared Enemies: an enemy hex (other than the target) can destroy the player's nearest building", () => {
    const world = makeWorld(
      {
        "1,0": { terrain: "plain", location: "humanCity" },
        "5,5": { terrain: "plain", location: null, building: "Tower" },
      },
      { "9,9": "enemy" },
    );
    const resources = makeResources({ troops: 0, buildings: [{ hexKey: "5,5", kind: "Tower" }] });
    // No troops/no join -> lost (0 < 6). Then: enemyCheck 2 (sends 2 troops), rolls 5+5=10 >= Tower's Defense 4.
    const outcome = resolveAttack(resources, world, TARGET, false, false, sequenceDie([2, 5, 5]));
    expect(outcome.status).toBe("lost");
    expect(outcome.retaliation).toEqual([{ hexKey: "5,5", kind: "Tower" }]);
    expect(outcome.resources.buildings).toEqual([]);
    expect(outcome.world.tiles["5,5"]).toEqual({ terrain: "plain", location: null });
  });

  it("Declared Enemies: a roll of 4+ means nothing happens", () => {
    const world = makeWorld(
      {
        "1,0": { terrain: "plain", location: "humanCity" },
        "5,5": { terrain: "plain", location: null, building: "Tower" },
      },
      { "9,9": "enemy" },
    );
    const resources = makeResources({ buildings: [{ hexKey: "5,5", kind: "Tower" }] });
    const outcome = resolveAttack(resources, world, TARGET, false, false, sequenceDie([4]));
    expect(outcome.retaliation).toEqual([]);
    expect(outcome.resources.buildings).toEqual([{ hexKey: "5,5", kind: "Tower" }]);
  });

  it("Declared Enemies: the building survives if the enemy's own roll falls short of its Defense", () => {
    const world = makeWorld(
      {
        "1,0": { terrain: "plain", location: "humanCity" },
        "5,5": { terrain: "plain", location: null, building: "Tower" },
      },
      { "9,9": "enemy" },
    );
    const resources = makeResources({ buildings: [{ hexKey: "5,5", kind: "Tower" }] });
    // enemyCheck 2 (2 troops), rolls 1+1=2 < Tower's Defense 4 -- survives.
    const outcome = resolveAttack(resources, world, TARGET, false, false, sequenceDie([2, 1, 1]));
    expect(outcome.retaliation).toEqual([]);
    expect(outcome.resources.buildings).toEqual([{ hexKey: "5,5", kind: "Tower" }]);
  });

  it("Declared Enemies excludes the hex actually being attacked, even if it's also marked enemy", () => {
    const world = makeWorld(
      { "1,0": { terrain: "plain", location: "humanCity" }, "5,5": { terrain: "plain", location: null, building: "Tower" } },
      { "1,0": "enemy" },
    );
    const resources = makeResources({ buildings: [{ hexKey: "5,5", kind: "Tower" }] });
    // No rolls consumed for retaliation at all -- if this ran, sequenceDie would run out and throw.
    const outcome = resolveAttack(resources, world, TARGET, false, false, sequenceDie([]));
    expect(outcome.retaliation).toEqual([]);
  });

  it("skips Declared Enemies entirely when the player owns no buildings", () => {
    const world = makeWorld({ "1,0": { terrain: "plain", location: "humanCity" } }, { "9,9": "enemy" });
    const resources = makeResources({ buildings: [] });
    const outcome = resolveAttack(resources, world, TARGET, false, false, sequenceDie([]));
    expect(outcome.retaliation).toEqual([]);
  });
});

describe("resolveStorming", () => {
  it("Annex succeeds: grants Vassal status unconditionally and bumps vassalCount", () => {
    const world = makeWorld({ "1,0": { terrain: "plain", location: "humanCity" } });
    // Human/human target is 4; 2d6+2 with rolls [1,1] = 4, meets it.
    const outcome = resolveStorming(makeResources(), world, "Human", TARGET, "human", "annex", sequenceDie([1, 1]));
    expect(outcome.annexed).toBe(true);
    expect(politicalStatusFor(outcome.world, TARGET)).toBe("vassal");
    expect(outcome.resources.milestones.vassalCount).toBe(1);
  });

  it("Annex failure falls through to Loot automatically", () => {
    const world = makeWorld({ "1,0": { terrain: "plain", location: "humanCity" } });
    // Human/orc target is 7; 2d6+2 with rolls [1,1] = 4, falls short.
    const outcome = resolveStorming(makeResources(), world, "Human", TARGET, "orc", "annex", sequenceDie([1, 1]));
    expect(outcome.annexed).toBe(false);
    expect(world.tiles[hexKey(TARGET)]); // sanity: helper still resolves
    expect(outcome.resources.coins).toBe(makeResources().coins + 600); // City payout
    expect(outcome.world.tiles["1,0"]!.location).toBe("ruins");
  });

  it("Loot directly: razes to Ruins and pays the flat amount for a Fortress", () => {
    const world = makeWorld({ "1,0": { terrain: "plain", location: "humanFortress" } });
    const outcome = resolveStorming(makeResources({ coins: 0 }), world, "Human", TARGET, "human", "loot");
    expect(outcome.annexed).toBe(false);
    expect(outcome.resources.coins).toBe(1000);
    expect(outcome.world.tiles["1,0"]!.location).toBe("ruins");
  });
});
