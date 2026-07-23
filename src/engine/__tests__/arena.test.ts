import { describe, expect, it } from "vitest";
import { resolveArenaRound, startArena, type ArenaState } from "../arena.ts";
import type { CombatMonsterState } from "../dungeonState.ts";
import { ARENA_CHAMPION_TABLE } from "../../data/arena.ts";
import { sequenceDie } from "../../test/mulberry32.ts";

function makeState(overrides: Partial<CombatMonsterState> = {}): ArenaState {
  return {
    champion: {
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
    outcome: "ongoing",
  };
}

describe("startArena", () => {
  it("rolls 3d6 and picks the matching Arena Champion", () => {
    // 1+1+1 = 3 -- "The Reaper".
    const low = startArena(sequenceDie([1, 1, 1]));
    expect(low.champion.name).toBe(ARENA_CHAMPION_TABLE[3]!.name);
    expect(low.champion.hp).toBe(30);
    expect(low.champion.abilities).toEqual(["deathtouch"]);

    // 6+6+6 = 18 -- "Ogre in Thong".
    const high = startArena(sequenceDie([6, 6, 6]));
    expect(high.champion.name).toBe(ARENA_CHAMPION_TABLE[18]!.name);
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
    const result = resolveArenaRound(state, 10, "1d6");
    expect(result).toEqual({ state, hp: 10, died: false, events: [] });
  });

  it("kills the champion outright and skips its counter-attack", () => {
    const state = makeState({ hp: 5 });
    const result = resolveArenaRound(state, 10, "1d6+10", sequenceDie([3]));
    expect(result.state.outcome).toBe("victory");
    expect(result.state.champion.hp).toBe(0);
    expect(result.hp).toBe(10); // unchanged -- no counter-attack from a defeated champion
    expect(result.died).toBe(false);
  });

  it("champion survives and counters -- player takes damage but lives", () => {
    const state = makeState({ hp: 20, damage: 3 });
    const result = resolveArenaRound(state, 10, "1d6", sequenceDie([3])); // weaponTotal 3
    expect(result.state.champion.hp).toBe(17);
    expect(result.state.outcome).toBe("ongoing");
    expect(result.hp).toBe(7); // 10 - 3 counter damage
    expect(result.died).toBe(false);
  });

  it("a lethal counter-attack kills the player", () => {
    const state = makeState({ hp: 20, damage: 100 });
    const result = resolveArenaRound(state, 5, "1d6", sequenceDie([2]));
    expect(result.state.outcome).toBe("defeat");
    expect(result.hp).toBe(0);
    expect(result.died).toBe(true);
  });

  it("Deathtouch: a roll of 1 queues an instant kill on the counter-attack regardless of damage", () => {
    const state = makeState({ hp: 30, damage: 1, abilities: ["deathtouch"] });
    const result = resolveArenaRound(state, 50, "1d6", sequenceDie([1]));
    expect(result.state.outcome).toBe("defeat");
    expect(result.hp).toBe(0);
    expect(result.died).toBe(true);
    // Consumed, not left dangling on the champion for a fight that's already over.
    expect(result.state.champion.deathtouchPending).toBe(false);
  });

  it("Explosive: a roll of 1 defeats the champion and can kill the player in the same blast", () => {
    const state = makeState({ hp: 8, abilities: ["explosive"] });
    const result = resolveArenaRound(state, 5, "1d6", sequenceDie([1]));
    // Death takes priority over victory when both happen from the same explosion (mirrors
    // dungeonReducer.ts's PLAYER_ATTACK case).
    expect(result.state.outcome).toBe("defeat");
    expect(result.hp).toBe(0);
    expect(result.died).toBe(true);
  });

  it("Explosive: defeats the champion without killing the player if HP allows", () => {
    const state = makeState({ hp: 8, abilities: ["explosive"] });
    const result = resolveArenaRound(state, 20, "1d6", sequenceDie([1]));
    expect(result.state.outcome).toBe("victory");
    expect(result.hp).toBe(12); // 20 - 8 self-destruct damage
    expect(result.died).toBe(false);
  });
});
