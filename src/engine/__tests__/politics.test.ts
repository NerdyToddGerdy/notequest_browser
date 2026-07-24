import { describe, expect, it } from "vitest";
import { canAttemptPoliticalAffinity, resolvePoliticalAffinity } from "../politics.ts";
import { hexKey, politicalStatusFor, withPoliticalStatus, type HexTile, type WorldState } from "../hexState.ts";
import { createInitialMilestones, createInitialTravelStats, type AdventurerResources } from "../town.ts";
import { sequenceDie } from "../../test/mulberry32.ts";

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

const TARGET = { q: 1, r: 0 };

function worldWithTile(tile: HexTile): WorldState {
  return {
    climate: "hot",
    home: { q: 0, r: 0 },
    player: { q: 0, r: 0 },
    tiles: { [hexKey(TARGET)]: tile },
    hasBoat: false,
  };
}

describe("canAttemptPoliticalAffinity", () => {
  it("requires a City/Fortress tile", () => {
    const world = worldWithTile({ terrain: "plain", location: null });
    expect(canAttemptPoliticalAffinity(world, TARGET, world.tiles[hexKey(TARGET)])).toBe(false);
    const cityWorld = worldWithTile({ terrain: "plain", location: "humanCity" });
    expect(canAttemptPoliticalAffinity(cityWorld, TARGET, cityWorld.tiles[hexKey(TARGET)])).toBe(true);
  });

  it("is false once the hex already has a resolved status", () => {
    const world = withPoliticalStatus(worldWithTile({ terrain: "plain", location: "humanCity" }), TARGET, "ally");
    expect(canAttemptPoliticalAffinity(world, TARGET, world.tiles[hexKey(TARGET)])).toBe(false);
  });

  it("is false when the tile is undefined", () => {
    const world = worldWithTile({ terrain: "plain", location: "humanCity" });
    expect(canAttemptPoliticalAffinity(world, TARGET, undefined)).toBe(false);
  });
});

describe("resolvePoliticalAffinity", () => {
  // Human/human's target is 4 (docs/game-rules-reference.md line 1710).
  it("becomes an ally on a successful roll with no Lord/King nearby", () => {
    const world = worldWithTile({ terrain: "plain", location: "humanCity" });
    const outcome = resolvePoliticalAffinity(
      makeResources(),
      world,
      "Human",
      TARGET,
      "human",
      false,
      sequenceDie([2, 2]), // roll 4, meets target
    );
    expect(outcome.status).toBe("ally");
    expect(outcome.roll).toBe(4);
    expect(outcome.target).toBe(4);
    expect(politicalStatusFor(outcome.world, TARGET)).toBe("ally");
  });

  it("becomes a permanent enemy on a failed roll", () => {
    const world = worldWithTile({ terrain: "plain", location: "humanCity" });
    const outcome = resolvePoliticalAffinity(
      makeResources(),
      world,
      "Human",
      TARGET,
      "human",
      false,
      sequenceDie([1, 1]), // roll 2, below target 4
    );
    expect(outcome.status).toBe("enemy");
    expect(politicalStatusFor(outcome.world, TARGET)).toBe("enemy");
  });

  it("becomes a Vassal instead of an ally when the player is a Lord with a Castle within 3 hexes", () => {
    const world = worldWithTile({ terrain: "plain", location: "humanCity" });
    const resources = makeResources({
      advancedClasses: ["Lord"],
      buildings: [{ hexKey: "0,0", kind: "Castle" }],
    });
    const outcome = resolvePoliticalAffinity(resources, world, "Human", TARGET, "human", false, sequenceDie([2, 2]));
    expect(outcome.status).toBe("vassal");
    expect(outcome.resources.milestones.vassalCount).toBe(1);
  });

  it("stays a plain ally without Lord/King, even with a nearby Castle", () => {
    const world = worldWithTile({ terrain: "plain", location: "humanCity" });
    const resources = makeResources({ buildings: [{ hexKey: "0,0", kind: "Castle" }] });
    const outcome = resolvePoliticalAffinity(resources, world, "Human", TARGET, "human", false, sequenceDie([2, 2]));
    expect(outcome.status).toBe("ally");
  });

  it("stays a plain ally when the nearest owned building is out of range", () => {
    const world = worldWithTile({ terrain: "plain", location: "humanCity" });
    const resources = makeResources({
      advancedClasses: ["Lord"],
      buildings: [{ hexKey: "10,10", kind: "Castle" }],
    });
    const outcome = resolvePoliticalAffinity(resources, world, "Human", TARGET, "human", false, sequenceDie([2, 2]));
    expect(outcome.status).toBe("ally");
  });

  it("a Fortress hex can only ever become an ally, never a Vassal, even for a King in range", () => {
    const world = worldWithTile({ terrain: "plain", location: "humanFortress" });
    const resources = makeResources({
      advancedClasses: ["King"],
      buildings: [{ hexKey: "0,0", kind: "Fortress" }],
    });
    const outcome = resolvePoliticalAffinity(resources, world, "Human", TARGET, "human", true, sequenceDie([2, 2]));
    expect(outcome.status).toBe("ally");
  });

  it("sets talkedToKing only when isFortressHex, regardless of outcome", () => {
    const world = worldWithTile({ terrain: "plain", location: "humanFortress" });
    const success = resolvePoliticalAffinity(makeResources(), world, "Human", TARGET, "human", true, sequenceDie([2, 2]));
    expect(success.resources.milestones.talkedToKing).toBe(true);

    const failure = resolvePoliticalAffinity(makeResources(), world, "Human", TARGET, "human", true, sequenceDie([1, 1]));
    expect(failure.resources.milestones.talkedToKing).toBe(true);

    const cityWorld = worldWithTile({ terrain: "plain", location: "humanCity" });
    const atCity = resolvePoliticalAffinity(makeResources(), cityWorld, "Human", TARGET, "human", false, sequenceDie([2, 2]));
    expect(atCity.resources.milestones.talkedToKing).toBe(false);
  });

  it("does not touch vassalCount on an ally or enemy result", () => {
    const world = worldWithTile({ terrain: "plain", location: "humanCity" });
    const ally = resolvePoliticalAffinity(makeResources(), world, "Human", TARGET, "human", false, sequenceDie([2, 2]));
    expect(ally.resources.milestones.vassalCount).toBe(0);
    const enemy = resolvePoliticalAffinity(makeResources(), world, "Human", TARGET, "human", false, sequenceDie([1, 1]));
    expect(enemy.resources.milestones.vassalCount).toBe(0);
  });
});
