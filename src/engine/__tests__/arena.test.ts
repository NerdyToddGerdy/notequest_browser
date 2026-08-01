import { describe, expect, it } from "vitest";
import { arenaChampion, resolveArenaRound, startArena, type ArenaState } from "../arena.ts";
import type { CombatMonsterState } from "../dungeonState.ts";
import { ARENA_CHAMPION_TABLE } from "../../data/arena.ts";
import { createCombatState } from "../fight.ts";
import {
  createInitialMilestones,
  createInitialTravelStats,
  type AdventurerResources,
} from "../town.ts";
import type { FighterIdentity } from "../events.ts";
import { sequenceDie } from "../../test/mulberry32.ts";

/** Issue #120: the Arena runs the shared core now, so a round takes the whole character. */
const HUMAN: FighterIdentity = { raceName: "Human", className: "Fighter" };

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

function makeState(overrides: Partial<CombatMonsterState> = {}): ArenaState {
  return {
    combat: createCombatState({
      monsters: [
        {
          id: 1,
          name: "Test Champion",
          hp: 20,
          maxHp: 20,
          damage: 5,
          abilities: [],
          bonusDamage: 0,
          deathtouchPending: false,
          paralyzePending: 0,
          skipNextAttack: false,
          silencedTurns: 0,
          ...overrides,
        },
      ],
    }),
    outcome: "ongoing",
  };
}

describe("startArena", () => {
  it("rolls 3d6 and picks the matching Arena Champion", () => {
    // 1+1+1 = 3 -- "The Reaper".
    const low = startArena(sequenceDie([1, 1, 1]));
    expect(arenaChampion(low)!.name).toBe(ARENA_CHAMPION_TABLE[3]!.name);
    expect(arenaChampion(low)!.hp).toBe(30);
    expect(arenaChampion(low)!.abilities).toEqual(["deathtouch"]);

    // 6+6+6 = 18 -- "Ogre in Thong".
    const high = startArena(sequenceDie([6, 6, 6]));
    expect(arenaChampion(high)!.name).toBe(ARENA_CHAMPION_TABLE[18]!.name);
  });

  it("every roll 3-18 has a full HP champion entry", () => {
    for (let roll = 3; roll <= 18; roll++) {
      expect(ARENA_CHAMPION_TABLE[roll], `roll ${roll}`).toBeDefined();
      expect(ARENA_CHAMPION_TABLE[roll]!.count).toBe(1);
    }
  });

  it("outcome starts ongoing", () => {
    expect(startArena(sequenceDie([3, 3, 3])).outcome).toBe("ongoing");
  });
});

describe("resolveArenaRound", () => {
  it("is a no-op once the fight is no longer ongoing", () => {
    const state: ArenaState = { ...makeState(), outcome: "victory" };
    const resources = makeResources({ hp: 10 });
    const result = resolveArenaRound(resources, HUMAN, state, "1d6");
    expect(result).toEqual({ resources, state, died: false, log: [] });
  });

  it("kills the champion outright and skips its counter-attack", () => {
    const state = makeState({ hp: 5 });
    const result = resolveArenaRound(
      makeResources({ hp: 10 }),
      HUMAN,
      state,
      "1d6+10",
      sequenceDie([3]),
    );
    expect(result.state.outcome).toBe("victory");
    expect(arenaChampion(result.state)).toBeNull(); // defeated monsters leave the fight
    expect(result.resources.hp).toBe(10); // unchanged -- no counter from a defeated champion
    expect(result.died).toBe(false);
  });

  it("champion survives and counters -- player takes damage but lives", () => {
    const state = makeState({ hp: 20, damage: 3 });
    const result = resolveArenaRound(
      makeResources({ hp: 10 }),
      HUMAN,
      state,
      "1d6",
      sequenceDie([3]),
    );
    expect(arenaChampion(result.state)!.hp).toBe(17);
    expect(result.state.outcome).toBe("ongoing");
    expect(result.resources.hp).toBe(7); // 10 - 3 counter damage
    expect(result.died).toBe(false);
  });

  it("a lethal counter-attack kills the player", () => {
    const state = makeState({ hp: 20, damage: 100 });
    const result = resolveArenaRound(
      makeResources({ hp: 5 }),
      HUMAN,
      state,
      "1d6",
      sequenceDie([2]),
    );
    expect(result.state.outcome).toBe("defeat");
    expect(result.resources.hp).toBe(0);
    expect(result.died).toBe(true);
  });

  it("Deathtouch: a roll of 1 queues an instant kill on the counter-attack regardless of damage", () => {
    const state = makeState({ hp: 30, damage: 1, abilities: ["deathtouch"] });
    const result = resolveArenaRound(
      makeResources({ hp: 50 }),
      HUMAN,
      state,
      "1d6",
      sequenceDie([1]),
    );
    expect(result.state.outcome).toBe("defeat");
    expect(result.resources.hp).toBe(0);
    expect(result.died).toBe(true);
    // Consumed, not left dangling on the champion for a fight that's already over.
    expect(arenaChampion(result.state)!.deathtouchPending).toBe(false);
  });

  it("Explosive: a roll of 1 defeats the champion and can kill the player in the same blast", () => {
    const state = makeState({ hp: 8, abilities: ["explosive"] });
    const result = resolveArenaRound(
      makeResources({ hp: 5 }),
      HUMAN,
      state,
      "1d6",
      sequenceDie([1]),
    );
    // Death takes priority over victory when both happen from the same explosion (mirrors
    // dungeonReducer.ts's PLAYER_ATTACK case).
    expect(result.state.outcome).toBe("defeat");
    expect(result.resources.hp).toBe(0);
    expect(result.died).toBe(true);
  });

  it("Explosive: defeats the champion without killing the player if HP allows", () => {
    const state = makeState({ hp: 8, abilities: ["explosive"] });
    const result = resolveArenaRound(
      makeResources({ hp: 20 }),
      HUMAN,
      state,
      "1d6",
      sequenceDie([1]),
    );
    expect(result.state.outcome).toBe("victory");
    expect(result.resources.hp).toBe(12); // 20 - 8 self-destruct damage
    expect(result.died).toBe(false);
  });
});
