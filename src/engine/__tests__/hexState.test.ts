import { describe, expect, it } from "vitest";
import {
  countMatchingNeighbors,
  createInitialWorldState,
  findAskedDungeonHex,
  findHexForRunId,
  hexDistance,
  isBannedHex,
  parseHexKey,
  politicalStatusFor,
  qualifiesForBuyingMount,
  qualifiesForTraining,
  revealNeighborsInPlace,
  rollCityName,
  withBannedHex,
  withBuilding,
  withDungeonMarked,
  withDungeonRunId,
  withoutBuilding,
  withPoliticalStatus,
  withRazedToRuins,
  type HexTile,
  type WorldState,
} from "../hexState.ts";
import { DOMESTICATED_ANIMAL_TABLE, MOUNT_TABLE } from "../../data/animals.ts";
import { sequenceDie } from "../../test/mulberry32.ts";

// HOT_TERRAIN_TABLE's "plain" column: 1->water, 2->mountain, 3->forest, 4/5/6->plain.
// LOCATION_TABLE's "plain" column: 1..6 -> orcCity, goblinCity, ruins, humanCity, humanCity, humanFortress.
// Neighbor order (HEX_DIRECTIONS) from {0,0}: {1,0} {1,-1} {0,-1} {-1,0} {-1,1} {0,1}.
// CITY_NAME_PREFIX/SUFFIX's human column: 1 -> "Iron"/"hold".
const HOME_REVEAL_ROLLS = [
  2, 3, // {1,0}: terrain mountain, no location
  6, 6, 4, // {1,-1}: terrain plain, location check succeeds, LOCATION_TABLE[4].plain -> humanCity
  1, 1, // {1,-1}'s name: "Iron" + "hold" -> "Ironhold"
  1, 2, // {0,-1}: terrain water, no location
  4, 3, // {-1,0}: terrain plain, no location
  4, 3, // {-1,1}: terrain plain, no location
  4, 3, // {0,1}: terrain plain, no location
];

describe("createInitialWorldState", () => {
  it("starts on a human city on a plain, with all 6 neighbors already revealed", () => {
    const world = createInitialWorldState(sequenceDie(HOME_REVEAL_ROLLS));

    expect(world.climate).toBe("hot");
    expect(world.home).toEqual({ q: 0, r: 0 });
    expect(world.player).toEqual({ q: 0, r: 0 });
    expect(Object.keys(world.tiles)).toHaveLength(7);

    // Home's own name is fixed ("Haven"), not rolled -- see createInitialWorldState's doc comment.
    expect(world.tiles["0,0"]).toEqual({ terrain: "plain", location: "humanCity", name: "Haven" });
    expect(world.tiles["1,0"]).toEqual({ terrain: "mountain", location: null });
    expect(world.tiles["1,-1"]).toEqual({ terrain: "plain", location: "humanCity", name: "Ironhold" });
    expect(world.tiles["0,-1"]).toEqual({ terrain: "water", location: null });
  });
});

describe("rollCityName", () => {
  it("combines a prefix and suffix roll into one compound name, per culture", () => {
    expect(rollCityName("human", sequenceDie([1, 1]))).toBe("Ironhold");
    expect(rollCityName("dwarven", sequenceDie([1, 1]))).toBe("Deepforge");
    expect(rollCityName("orc", sequenceDie([6, 6]))).toBe("Blackridge");
  });

  it("rolls independently for each of the six cultures", () => {
    const cultures = ["human", "dwarven", "elven", "gnome", "goblin", "orc"] as const;
    for (const culture of cultures) {
      expect(rollCityName(culture, sequenceDie([3, 4]))).toMatch(/^[A-Z]/);
    }
  });
});

describe("revealNeighborsInPlace", () => {
  it("rolls a Location only when the check die lands on 6", () => {
    const tiles: Record<string, HexTile> = { "0,0": { terrain: "plain", location: null } };
    revealNeighborsInPlace(tiles, { q: 0, r: 0 }, "hot", sequenceDie([4, 6, 5, 1, 1]));
    // {1,0}: terrain roll 4 -> plain, location check 6 -> location roll 5 -> LOCATION_TABLE[5].plain
    // -> humanCity; name rolls 1, 1 -> "Iron" + "hold" -> "Ironhold".
    expect(tiles["1,0"]).toEqual({ terrain: "plain", location: "humanCity", name: "Ironhold" });
  });

  it("doesn't roll a Location when the check die isn't a 6", () => {
    const tiles: Record<string, HexTile> = { "0,0": { terrain: "plain", location: null } };
    revealNeighborsInPlace(tiles, { q: 0, r: 0 }, "hot", sequenceDie([2, 3]));
    expect(tiles["1,0"]).toEqual({ terrain: "mountain", location: null });
  });

  it("doesn't roll a name for a location with no culture (e.g. Ruins)", () => {
    const tiles: Record<string, HexTile> = { "0,0": { terrain: "plain", location: null } };
    // {1,0}: terrain roll 4 -> plain, location check 6 -> location roll 3 -> LOCATION_TABLE[3].plain
    // -> "ruins" (no CityCulture) -- no extra dice consumed for a name.
    revealNeighborsInPlace(tiles, { q: 0, r: 0 }, "hot", sequenceDie([4, 6, 3]));
    expect(tiles["1,0"]).toEqual({ terrain: "plain", location: "ruins" });
  });

  it("never overwrites an already-revealed tile, even one shared by two expansions", () => {
    const existing: HexTile = { terrain: "mountain", location: "ruins" };
    const tiles: Record<string, HexTile> = {
      "0,0": { terrain: "plain", location: null },
      "1,0": existing, // a neighbor of {0,0}
    };
    // If "1,0" were re-rolled, this sequence's first two rolls (1, 2) would produce
    // { terrain: "water", location: null } -- a different value than what's already there.
    revealNeighborsInPlace(tiles, { q: 0, r: 0 }, "hot", sequenceDie([1, 2, 1, 2, 1, 2, 1, 2, 1, 2]));
    expect(tiles["1,0"]).toBe(existing);
  });
});

describe("withDungeonRunId", () => {
  it("stamps the id onto the tile at the given coord, immutably", () => {
    const world: WorldState = {
      climate: "hot",
      home: { q: 0, r: 0 },
      player: { q: 0, r: 0 },
      tiles: { "0,0": { terrain: "plain", location: "humanCity" } },
      hasBoat: false,
    };
    const next = withDungeonRunId(world, { q: 0, r: 0 }, "run-1");
    expect(next.tiles["0,0"]).toEqual({ terrain: "plain", location: "humanCity", dungeonRunId: "run-1" });
    expect(world.tiles["0,0"]).toEqual({ terrain: "plain", location: "humanCity" }); // original untouched
  });

  it("is a no-op if the coord isn't a known tile", () => {
    const world: WorldState = {
      climate: "hot",
      home: { q: 0, r: 0 },
      player: { q: 0, r: 0 },
      tiles: { "0,0": { terrain: "plain", location: "humanCity" } },
      hasBoat: false,
    };
    const next = withDungeonRunId(world, { q: 5, r: 5 }, "run-1");
    expect(next).toBe(world);
  });
});

describe("findHexForRunId (issues #79/#80)", () => {
  it("finds the coord of the tile carrying the given dungeonRunId", () => {
    const world: WorldState = {
      climate: "hot",
      home: { q: 0, r: 0 },
      player: { q: 0, r: 0 },
      tiles: {
        "0,0": { terrain: "plain", location: "humanCity" },
        "3,-2": { terrain: "plain", location: "ruins", dungeonRunId: "run-1" },
      },
      hasBoat: false,
    };
    expect(findHexForRunId(world, "run-1")).toEqual({ q: 3, r: -2 });
  });

  it("is null when no tile carries the given id", () => {
    const world: WorldState = {
      climate: "hot",
      home: { q: 0, r: 0 },
      player: { q: 0, r: 0 },
      tiles: { "0,0": { terrain: "plain", location: "humanCity" } },
      hasBoat: false,
    };
    expect(findHexForRunId(world, "run-1")).toBeNull();
  });
});

describe("findAskedDungeonHex", () => {
  // Neighbor order (HEX_DIRECTIONS) from {0,0}: {1,0} mountain/none, {1,-1} plain/humanCity,
  // {0,-1} water/none, {-1,0} plain/none, {-1,1} plain/none, {0,1} plain/none.
  function homeWorld() {
    return createInitialWorldState(sequenceDie(HOME_REVEAL_ROLLS));
  }

  it("returns the neighbor at the rolled side when it already qualifies", () => {
    const world = homeWorld();
    // Roll 1 -> start at {1,0} (index 0), which is land with no location.
    expect(findAskedDungeonHex(world, world.player, sequenceDie([1]))).toEqual({ q: 1, r: 0 });
  });

  it("walks clockwise past Water and a City, to the first qualifying neighbor", () => {
    const world = homeWorld();
    // Roll 2 -> starts at {1,-1} (humanCity, skip), then {0,-1} (water, skip), then {-1,0}
    // (plain, no location -- qualifies).
    expect(findAskedDungeonHex(world, world.player, sequenceDie([2]))).toEqual({ q: -1, r: 0 });
  });

  it("returns null if every neighbor is Water or already has a location", () => {
    const world: WorldState = {
      climate: "hot",
      home: { q: 0, r: 0 },
      player: { q: 0, r: 0 },
      tiles: {
        "0,0": { terrain: "plain", location: "humanCity" },
        "1,0": { terrain: "water", location: null },
        "1,-1": { terrain: "plain", location: "humanCity" },
        "0,-1": { terrain: "water", location: null },
        "-1,0": { terrain: "plain", location: "ruins" },
        "-1,1": { terrain: "water", location: null },
        "0,1": { terrain: "plain", location: "orcCity" },
      },
      hasBoat: false,
    };
    expect(findAskedDungeonHex(world, world.player, sequenceDie([1]))).toBeNull();
  });
});

describe("withDungeonMarked", () => {
  it("stamps dungeonMarked onto the tile at the given coord, immutably", () => {
    const world: WorldState = {
      climate: "hot",
      home: { q: 0, r: 0 },
      player: { q: 0, r: 0 },
      tiles: { "0,0": { terrain: "plain", location: null } },
      hasBoat: false,
    };
    const next = withDungeonMarked(world, { q: 0, r: 0 });
    expect(next.tiles["0,0"]).toEqual({ terrain: "plain", location: null, dungeonMarked: true });
    expect(world.tiles["0,0"]).toEqual({ terrain: "plain", location: null }); // original untouched
  });

  it("is a no-op if the coord isn't a known tile", () => {
    const world: WorldState = {
      climate: "hot",
      home: { q: 0, r: 0 },
      player: { q: 0, r: 0 },
      tiles: { "0,0": { terrain: "plain", location: null } },
      hasBoat: false,
    };
    const next = withDungeonMarked(world, { q: 5, r: 5 });
    expect(next).toBe(world);
  });
});

describe("isBannedHex / withBannedHex", () => {
  function bareWorld(bannedHexes?: string[]): WorldState {
    return {
      climate: "hot",
      home: { q: 0, r: 0 },
      player: { q: 0, r: 0 },
      tiles: { "0,0": { terrain: "plain", location: "humanCity" } },
      hasBoat: false,
      ...(bannedHexes !== undefined ? { bannedHexes } : {}),
    };
  }

  it("is false for a fresh world and true once banned", () => {
    const world = bareWorld([]);
    expect(isBannedHex(world, { q: 0, r: 0 })).toBe(false);
    const banned = withBannedHex(world, { q: 0, r: 0 });
    expect(isBannedHex(banned, { q: 0, r: 0 })).toBe(true);
    expect(isBannedHex(world, { q: 0, r: 0 })).toBe(false); // original untouched
  });

  it("treats a world with no bannedHexes field at all as having none banned (back-compat)", () => {
    const world = bareWorld(undefined);
    expect(isBannedHex(world, { q: 0, r: 0 })).toBe(false);
    const banned = withBannedHex(world, { q: 0, r: 0 });
    expect(banned.bannedHexes).toEqual(["0,0"]);
  });

  it("is idempotent -- banning an already-banned hex is a no-op", () => {
    const world = withBannedHex(bareWorld([]), { q: 0, r: 0 });
    const again = withBannedHex(world, { q: 0, r: 0 });
    expect(again).toBe(world);
  });
});

describe("countMatchingNeighbors / qualifiesForTraining / qualifiesForBuyingMount (issue #26)", () => {
  // Neighbor order from {0,0}: {1,0} {1,-1} {0,-1} {-1,0} {-1,1} {0,1} -- 3 forest, 3 mountain.
  const neighborTiles: Record<string, HexTile> = {
    "1,0": { terrain: "forest", location: null },
    "1,-1": { terrain: "forest", location: null },
    "0,-1": { terrain: "forest", location: null },
    "-1,0": { terrain: "mountain", location: null },
    "-1,1": { terrain: "mountain", location: null },
    "0,1": { terrain: "mountain", location: null },
  };

  it("counts only neighbors sharing the given terrain", () => {
    expect(countMatchingNeighbors(neighborTiles, { q: 0, r: 0 }, "forest")).toBe(3);
    expect(countMatchingNeighbors(neighborTiles, { q: 0, r: 0 }, "mountain")).toBe(3);
    expect(countMatchingNeighbors(neighborTiles, { q: 0, r: 0 }, "desert")).toBe(0);
  });

  it("qualifiesForTraining requires an empty location, terrain match, and 2+ matching neighbors", () => {
    const owl = DOMESTICATED_ANIMAL_TABLE.Owl!;
    const forestTile: HexTile = { terrain: "forest", location: null };
    expect(qualifiesForTraining(forestTile, 3, owl)).toBe(true);
    expect(qualifiesForTraining(forestTile, 1, owl)).toBe(false); // not enough matching neighbors
    expect(qualifiesForTraining({ ...forestTile, location: "humanCity" }, 3, owl)).toBe(false); // not empty
    const mountainTile: HexTile = { terrain: "mountain", location: null };
    expect(qualifiesForTraining(mountainTile, 3, owl)).toBe(false); // wrong terrain
  });

  it("Snake's empty terrain array ('Any') matches every terrain", () => {
    const snake = DOMESTICATED_ANIMAL_TABLE.Snake!;
    expect(qualifiesForTraining({ terrain: "forest", location: null }, 3, snake)).toBe(true);
    expect(qualifiesForTraining({ terrain: "mountain", location: null }, 3, snake)).toBe(true);
  });

  it("qualifiesForBuyingMount requires a City/Fortress, terrain match, and 2+ matching neighbors -- culture-agnostic", () => {
    const griffin = MOUNT_TABLE.Griffin!; // requires mountain
    const dwarvenFortress: HexTile = { terrain: "mountain", location: "dwarvenFortress" };
    expect(qualifiesForBuyingMount(dwarvenFortress, 3, griffin)).toBe(true);
    // Any City/Fortress on the right terrain qualifies, regardless of culture.
    const orcFortress: HexTile = { terrain: "mountain", location: "orcFortress" };
    expect(qualifiesForBuyingMount(orcFortress, 3, griffin)).toBe(true);
    expect(qualifiesForBuyingMount(dwarvenFortress, 1, griffin)).toBe(false); // not enough neighbors
    const emptyMountain: HexTile = { terrain: "mountain", location: null };
    expect(qualifiesForBuyingMount(emptyMountain, 3, griffin)).toBe(false); // not a City/Fortress
    const wrongTerrainCity: HexTile = { terrain: "forest", location: "elvenCity" };
    expect(qualifiesForBuyingMount(wrongTerrainCity, 3, griffin)).toBe(false); // wrong terrain
  });
});

describe("parseHexKey", () => {
  it("is the exact inverse of hexKey", () => {
    expect(parseHexKey("3,-2")).toEqual({ q: 3, r: -2 });
    expect(parseHexKey("0,0")).toEqual({ q: 0, r: 0 });
  });
});

describe("hexDistance (Politics, issue #27)", () => {
  it("is 0 for the same hex", () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
  });

  it("is 1 for any direct neighbor", () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1);
    expect(hexDistance({ q: 0, r: 0 }, { q: -1, r: 1 })).toBe(1);
  });

  it("matches the standard axial distance formula further out", () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: 0 })).toBe(3);
    expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: -2 })).toBe(2);
    expect(hexDistance({ q: -2, r: 1 }, { q: 2, r: -1 })).toBe(4);
  });
});

describe("withBuilding (Buildings, issue #27)", () => {
  it("stamps the kind onto the tile at the given coord, immutably", () => {
    const world: WorldState = {
      climate: "hot",
      home: { q: 0, r: 0 },
      player: { q: 0, r: 0 },
      tiles: { "0,0": { terrain: "plain", location: null } },
      hasBoat: false,
    };
    const next = withBuilding(world, { q: 0, r: 0 }, "House");
    expect(next.tiles["0,0"]).toEqual({ terrain: "plain", location: null, building: "House" });
    expect(world.tiles["0,0"]).toEqual({ terrain: "plain", location: null }); // original untouched
  });

  it("replaces an existing building on upgrade", () => {
    const world: WorldState = {
      climate: "hot",
      home: { q: 0, r: 0 },
      player: { q: 0, r: 0 },
      tiles: { "0,0": { terrain: "plain", location: null, building: "House" } },
      hasBoat: false,
    };
    const next = withBuilding(world, { q: 0, r: 0 }, "Tower");
    expect(next.tiles["0,0"]!.building).toBe("Tower");
  });

  it("is a no-op if the coord isn't a known tile", () => {
    const world: WorldState = {
      climate: "hot",
      home: { q: 0, r: 0 },
      player: { q: 0, r: 0 },
      tiles: { "0,0": { terrain: "plain", location: null } },
      hasBoat: false,
    };
    expect(withBuilding(world, { q: 5, r: 5 }, "House")).toBe(world);
  });
});

describe("politicalStatusFor / withPoliticalStatus (Politics, issue #27)", () => {
  function bareWorld(): WorldState {
    return {
      climate: "hot",
      home: { q: 0, r: 0 },
      player: { q: 0, r: 0 },
      tiles: { "0,0": { terrain: "plain", location: "humanCity" } },
      hasBoat: false,
    };
  }

  it("is null for an unresolved hex, including one with no politicalStatus field at all (back-compat)", () => {
    expect(politicalStatusFor(bareWorld(), { q: 0, r: 0 })).toBeNull();
  });

  it("records and reads back a status, immutably", () => {
    const world = bareWorld();
    const next = withPoliticalStatus(world, { q: 0, r: 0 }, "vassal");
    expect(politicalStatusFor(next, { q: 0, r: 0 })).toBe("vassal");
    expect(politicalStatusFor(world, { q: 0, r: 0 })).toBeNull(); // original untouched
  });

  it("preserves an existing entry for a different hex", () => {
    const world = withPoliticalStatus(bareWorld(), { q: 0, r: 0 }, "ally");
    const next = withPoliticalStatus(world, { q: 5, r: 5 }, "enemy");
    expect(politicalStatusFor(next, { q: 0, r: 0 })).toBe("ally");
    expect(politicalStatusFor(next, { q: 5, r: 5 })).toBe("enemy");
  });
});

describe("withoutBuilding (Warfare, issue #28)", () => {
  it("clears the building field, immutably, leaving location untouched", () => {
    const world: WorldState = {
      climate: "hot",
      home: { q: 0, r: 0 },
      player: { q: 0, r: 0 },
      tiles: { "0,0": { terrain: "plain", location: null, building: "Tower" } },
      hasBoat: false,
    };
    const next = withoutBuilding(world, { q: 0, r: 0 });
    expect(next.tiles["0,0"]).toEqual({ terrain: "plain", location: null });
    expect(world.tiles["0,0"]!.building).toBe("Tower"); // original untouched
  });

  it("is a no-op if the coord isn't a known tile", () => {
    const world: WorldState = {
      climate: "hot",
      home: { q: 0, r: 0 },
      player: { q: 0, r: 0 },
      tiles: { "0,0": { terrain: "plain", location: null } },
      hasBoat: false,
    };
    expect(withoutBuilding(world, { q: 5, r: 5 })).toBe(world);
  });
});

describe("withRazedToRuins (Warfare, issue #28)", () => {
  it("sets location to ruins and clears the generated name, immutably", () => {
    const world: WorldState = {
      climate: "hot",
      home: { q: 0, r: 0 },
      player: { q: 0, r: 0 },
      tiles: { "1,0": { terrain: "plain", location: "humanCity", name: "Ironhold" } },
      hasBoat: false,
    };
    const next = withRazedToRuins(world, { q: 1, r: 0 });
    expect(next.tiles["1,0"]).toEqual({ terrain: "plain", location: "ruins" });
    expect(world.tiles["1,0"]!.location).toBe("humanCity"); // original untouched
  });

  it("leaves dungeonRunId/dungeonMarked untouched", () => {
    const world: WorldState = {
      climate: "hot",
      home: { q: 0, r: 0 },
      player: { q: 0, r: 0 },
      tiles: { "1,0": { terrain: "plain", location: "humanFortress", dungeonRunId: "run-1" } },
      hasBoat: false,
    };
    const next = withRazedToRuins(world, { q: 1, r: 0 });
    expect(next.tiles["1,0"]!.dungeonRunId).toBe("run-1");
    expect(next.tiles["1,0"]!.location).toBe("ruins");
  });

  it("is a no-op if the coord isn't a known tile", () => {
    const world: WorldState = {
      climate: "hot",
      home: { q: 0, r: 0 },
      player: { q: 0, r: 0 },
      tiles: { "0,0": { terrain: "plain", location: null } },
      hasBoat: false,
    };
    expect(withRazedToRuins(world, { q: 5, r: 5 })).toBe(world);
  });
});
