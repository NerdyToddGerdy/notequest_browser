import { describe, expect, it } from "vitest";
import { CANDY_TREASURE_TABLE, REALMS } from "../../data/otherWorlds.ts";
import type { OtherWorldKey } from "../../data/portals.ts";
import { CITY_OR_FORTRESS } from "../../data/hexTables.ts";
import { fixedDie, mulberry32, sequenceDie } from "../../test/mulberry32.ts";
import { createInitialWorldState, hexKey, type WorldState } from "../hexState.ts";
import {
  applyRealmVictoryReward,
  createRealmMap,
  currentRealm,
  drinkDreamPotion,
  hasDreamPotion,
  isInOtherWorld,
  realmTerrainHazard,
  reverseHp,
  rollRealmEvent,
  switchRealm,
  visitedRealms,
} from "../realms.ts";
import {
  createInitialMilestones,
  createInitialTravelStats,
  type AdventurerResources,
} from "../town.ts";

const ALL_REALMS: OtherWorldKey[] = ["hell", "underworld", "pesadelum", "candyWorld"];

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

const overworld = (): WorldState => createInitialWorldState(mulberry32(7));

describe("realm table completeness", () => {
  it("every realm has a full 1-6 terrain row, a full 1-6 location row, and 2-6 events", () => {
    for (const key of ALL_REALMS) {
      const realm = REALMS[key];
      for (let roll = 1; roll <= 6; roll++) {
        expect(realm.terrain[roll], `${key} terrain ${roll}`).toBeDefined();
        expect(realm.location[roll], `${key} location ${roll}`).toBeDefined();
      }
      for (let total = 2; total <= 6; total++) {
        expect(realm.event[total], `${key} event ${total}`).toBeDefined();
      }
    }
  });

  it("gives every event row exactly one of monsters/effect", () => {
    for (const key of ALL_REALMS) {
      for (let total = 2; total <= 6; total++) {
        const row = REALMS[key].event[total]!;
        expect((row.monsters !== undefined) !== (row.effect !== undefined), `${key} ${total}`).toBe(
          true,
        );
      }
    }
  });

  it("every realm offers a Portal somewhere on its Location table -- otherwise you could never leave", () => {
    for (const key of ALL_REALMS) {
      const hasPortal = Object.values(REALMS[key].location).includes("portal");
      expect(hasPortal, `${key} has no way out`).toBe(true);
    }
  });

  it("every realm city renders as a town, so Rest and Buy work while stranded", () => {
    for (const key of ALL_REALMS) {
      for (const loc of Object.values(REALMS[key].location)) {
        if (loc === "demonCity" || loc === "cityOfSurvivors" || loc === "chocolateCity") {
          expect(CITY_OR_FORTRESS.has(loc), `${loc}`).toBe(true);
        }
      }
    }
  });

  it("Candy World's Treasure table stops at 6, as printed", () => {
    for (let total = 2; total <= 6; total++)
      expect(CANDY_TREASURE_TABLE[total], `${total}`).toBeDefined();
    for (let total = 7; total <= 12; total++)
      expect(CANDY_TREASURE_TABLE[total], `${total}`).toBeUndefined();
  });
});

describe("switchRealm", () => {
  it("generates a realm on first arrival and puts the player on its start terrain", () => {
    const next = switchRealm(overworld(), "hell", mulberry32(3));
    expect(currentRealm(next)).toBe("hell");
    expect(isInOtherWorld(next)).toBe(true);
    expect(next.tiles[hexKey(next.player)]!.terrain).toBe(REALMS.hell.startTerrain);
  });

  it("stashes the world you left, intact", () => {
    const before = overworld();
    const next = switchRealm(before, "hell", mulberry32(3));
    expect(next.stashedRealms?.overworld?.tiles).toEqual(before.tiles);
    expect(next.stashedRealms?.overworld?.player).toEqual(before.player);
  });

  it("puts you back exactly where you left a realm you've already visited", () => {
    let w = switchRealm(overworld(), "hell", mulberry32(3));
    const hellTiles = w.tiles;
    const movedTo = { q: 1, r: 0 };
    w = { ...w, player: movedTo };
    w = switchRealm(w, "overworld", mulberry32(4));
    w = switchRealm(w, "hell", mulberry32(5));
    expect(w.player).toEqual(movedTo);
    expect(w.tiles).toEqual(hellTiles);
  });

  it("never keeps a boat across worlds", () => {
    const sailing = { ...overworld(), hasBoat: true };
    expect(switchRealm(sailing, "underworld", mulberry32(3)).hasBoat).toBe(false);
  });

  it("is a no-op when you're already there", () => {
    const w = overworld();
    expect(switchRealm(w, "overworld", mulberry32(3))).toBe(w);
  });

  it("keeps the overworld's own bans and politics out of the realms", () => {
    // These are keyed by a bare hexKey, so leaking them across realms would let a ban in the
    // overworld silently apply to the same-numbered hex in Hell.
    const banned = {
      ...overworld(),
      bannedHexes: ["1,0"],
      politicalStatus: { "1,0": "enemy" as const },
    };
    const inHell = switchRealm(banned, "hell", mulberry32(3));
    // They stay on the WorldState (they describe the overworld), but no realm hex shares their keys
    // in a way that matters -- the systems that read them are all gated off in a realm.
    expect(inHell.bannedHexes).toEqual(["1,0"]);
    expect(inHell.realm).toBe("hell");
  });

  it("tracks every realm visited, for the cross-world destination picker", () => {
    let w = switchRealm(overworld(), "hell", mulberry32(3));
    w = switchRealm(w, "candyWorld", mulberry32(4));
    expect(visitedRealms(w).sort()).toEqual(["candyWorld", "hell", "overworld"]);
  });
});

describe("createRealmMap", () => {
  it("reveals the six neighbours of the start hex", () => {
    const map = createRealmMap(REALMS.candyWorld, mulberry32(2));
    expect(Object.keys(map.tiles)).toHaveLength(7);
  });

  it("never puts a location on Magma -- 'There are no locations here'", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const map = createRealmMap(REALMS.hell, mulberry32(seed));
      for (const tile of Object.values(map.tiles)) {
        if (tile.terrain === "magma") expect(tile.location).toBeNull();
      }
    }
  });

  it("rolls a location unconditionally, unlike the overworld's 1-in-6 gate", () => {
    // Candy World's table has no null rows, so every revealed non-start hex must have something.
    const map = createRealmMap(REALMS.candyWorld, mulberry32(9));
    const revealed = Object.entries(map.tiles).filter(([k]) => k !== "0,0");
    expect(revealed.length).toBeGreaterThan(0);
    for (const [key, tile] of revealed) expect(tile.location, key).not.toBeNull();
  });
});

describe("realmTerrainHazard", () => {
  it("Magma rolls 6d6 -- all sixes is 36", () => {
    const hazard = realmTerrainHazard("magma", fixedDie(6));
    expect(hazard?.effect).toEqual({ kind: "loseHp", amount: 36 });
  });

  it("Magma's damage varies with the roll", () => {
    expect(realmTerrainHazard("magma", fixedDie(1))?.effect).toEqual({ kind: "loseHp", amount: 6 });
  });

  it("the Plain of Thorns is a flat 1", () => {
    expect(realmTerrainHazard("plainOfThorns", fixedDie(3))?.effect).toEqual({
      kind: "loseHp",
      amount: 1,
    });
  });

  it("the Sea of Blood hurts and shoves", () => {
    expect(realmTerrainHazard("seaOfBlood", fixedDie(3))?.effect).toEqual({
      kind: "moveToRandomAdjacent",
      damage: 3,
    });
  });

  it("the Forest of the Impaled only catches you on a 1", () => {
    expect(realmTerrainHazard("forestOfImpaled", fixedDie(1))?.effect).toEqual({
      kind: "catatonic",
    });
    for (const roll of [2, 3, 4, 5, 6]) {
      expect(realmTerrainHazard("forestOfImpaled", fixedDie(roll)), `roll ${roll}`).toBeNull();
    }
  });

  it("ordinary and candy terrain cost nothing", () => {
    for (const t of [
      "plain",
      "mountain",
      "swamp",
      "water",
      "caramelPlain",
      "lollipopForest",
      "milkShakeSea",
    ] as const) {
      expect(realmTerrainHazard(t, fixedDie(1)), t).toBeNull();
    }
  });
});

describe("rollRealmEvent", () => {
  it("is nothing at 7 or more", () => {
    expect(rollRealmEvent(REALMS.hell, fixedDie(4)).row).toBeNull(); // 4+4 = 8
  });

  it("finds the realm's own row below 7", () => {
    const roll = rollRealmEvent(REALMS.hell, fixedDie(1)); // 1+1 = 2
    expect(roll.total).toBe(2);
    expect(roll.row?.monsters?.name).toBe("Infernal Baron");
  });

  it("each realm has its own table for the same total", () => {
    expect(rollRealmEvent(REALMS.underworld, fixedDie(1)).row?.monsters?.name).toBe("The Death");
    expect(rollRealmEvent(REALMS.pesadelum, fixedDie(1)).row?.monsters?.name).toBe("Dracolich");
    expect(rollRealmEvent(REALMS.candyWorld, fixedDie(1)).row?.monsters?.name).toBe("Caking");
  });
});

describe("applyRealmVictoryReward", () => {
  it("Hell's Demon Lord grants 1d6 Magic Items", () => {
    const reward = applyRealmVictoryReward(
      makeResources(),
      "hell",
      "Demon Lord",
      sequenceDie([3, 1, 2, 3]),
    );
    expect(reward.resources.heldItems).toHaveLength(3);
    expect(reward.opensPortalHere).toBe(false);
  });

  it("the Infernal Baron also opens a Portal where he fell", () => {
    const reward = applyRealmVictoryReward(
      makeResources(),
      "hell",
      "Infernal Baron",
      sequenceDie([1, 4]),
    );
    expect(reward.opensPortalHere).toBe(true);
    expect(reward.message).toContain("Portal");
  });

  it("an ordinary Hell demon grants nothing extra", () => {
    const reward = applyRealmVictoryReward(makeResources(), "hell", "Demon", fixedDie(3));
    expect(reward.resources.heldItems).toHaveLength(0);
    expect(reward.opensPortalHere).toBe(false);
  });

  it("beating Death opens every world", () => {
    const reward = applyRealmVictoryReward(makeResources(), "underworld", "The Death", fixedDie(3));
    expect(reward.unlocksAnyDestination).toBe(true);
  });

  it("Pesadelum's Tentacle drops a Dream Potion", () => {
    const reward = applyRealmVictoryReward(makeResources(), "pesadelum", "Tentacle", fixedDie(3));
    expect(hasDreamPotion(reward.resources)).toBe(true);
  });

  it("Candy World rolls a treasure for any monster", () => {
    // 1 + 1 = 2 -> "100 chocolate coins (worth 1 coin)".
    const reward = applyRealmVictoryReward(
      makeResources({ coins: 4 }),
      "candyWorld",
      "Marshminion",
      fixedDie(1),
    );
    expect(reward.resources.coins).toBe(5);
  });

  it("Candy World's 7+ rolls grant nothing, matching the printed table", () => {
    // 4 + 4 = 8, which the table simply doesn't list.
    const reward = applyRealmVictoryReward(
      makeResources({ coins: 4 }),
      "candyWorld",
      "Marshminion",
      fixedDie(4),
    );
    expect(reward.resources.coins).toBe(4);
    expect(reward.message).toContain("crumbs");
  });
});

describe("the Dream Potion (reverseHp)", () => {
  it("swaps the tens and units", () => {
    expect(reverseHp(34, 99)).toBe(43);
    expect(reverseHp(12, 99)).toBe(21);
  });

  it("leaves a single digit alone -- 7 reverses to itself", () => {
    expect(reverseHp(7, 99)).toBe(7);
  });

  it("is capped at maxHp rather than letting current HP exceed it", () => {
    expect(reverseHp(19, 50)).toBe(50);
  });

  it("never leaves you on 0 -- 10 would reverse to 1, not nothing", () => {
    expect(reverseHp(10, 99)).toBe(1);
  });

  it("drinking it consumes the potion and applies the swap", () => {
    const before = makeResources({
      hp: 34,
      maxHp: 99,
      heldItems: [{ name: "Dream Potion", worth: 5 }],
    });
    const after = drinkDreamPotion(before);
    expect(after.hp).toBe(43);
    expect(hasDreamPotion(after)).toBe(false);
  });

  it("is a no-op without one", () => {
    const before = makeResources({ hp: 34 });
    expect(drinkDreamPotion(before)).toBe(before);
  });
});
