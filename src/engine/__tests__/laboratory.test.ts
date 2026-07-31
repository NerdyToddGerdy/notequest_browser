import { describe, expect, it } from "vitest";
import { DUNGEON_TABLES } from "../../data/dungeonTables.ts";
import {
  DUNGEON_TYPES,
  isHiddenChestResult,
  SEGMENTS_TABLE_BY_TYPE,
  SECRET_PASSAGE_TABLE_BY_TYPE,
} from "../../data/dungeonTypes.ts";
import { DUNGEON_TYPE_BY_TERRAIN, RUINS_DUNGEON_TYPE } from "../../data/hexTables.ts";
import { MUTATION_BY_ID, MUTATION_IDS, MUTATION_TABLE } from "../../data/mutations.ts";
import { dungeonReducer } from "../dungeonReducer.ts";
import {
  createInitialDungeonState,
  makeLevel,
  type CombatMonsterState,
  type CombatState,
  type DungeonState,
  type SegmentState,
} from "../dungeonState.ts";
import {
  applyZombieRevival,
  hasMutation,
  rollMutation,
  rollMutationEntry,
  zombieRevivalHp,
} from "../mutations.ts";
import {
  canWearArmorPiece,
  createInitialMilestones,
  createInitialTravelStats,
  type AdventurerResources,
} from "../town.ts";
import { sequenceDie } from "../../test/mulberry32.ts";

/** Laboratory (issue #30) -- the 6th of #30's dungeon types, and the only one whose Special Rule
 * fires on *leaving* rather than inside: "any hero or creature that leaves this dungeon will
 * mutate." */

function makeSegment(
  overrides: Partial<SegmentState> & Pick<SegmentState, "id" | "type" | "doors">,
): SegmentState {
  return {
    x: 0,
    y: 0,
    w: 80,
    h: 80,
    cx: 0,
    cy: 0,
    cameFromDir: null,
    flavor: null,
    isEntrance: false,
    ...overrides,
  };
}

function makeLabLevel(segments: SegmentState[]) {
  return { ...makeLevel(0), segments };
}

function labState(overrides: Partial<DungeonState> = {}): DungeonState {
  const level = makeLabLevel([
    makeSegment({ id: 1, type: "staircase", doors: [], isEntrance: true }),
  ]);
  return {
    ...createInitialDungeonState(),
    dungeonTypeKey: "laboratory",
    levels: [level],
    activeLevel: 0,
    selectedSegId: 1,
    currentSegId: 1,
    nextSegmentId: 100,
    treasures: 1,
    ...overrides,
  };
}

function makeResources(overrides: Partial<AdventurerResources> = {}): AdventurerResources {
  return {
    torches: 10,
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
    provisions: 20,
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

function makeMonster(
  overrides: Partial<CombatMonsterState> &
    Pick<CombatMonsterState, "name" | "hp" | "maxHp" | "damage">,
): CombatMonsterState {
  return {
    id: 1,
    abilities: [],
    bonusDamage: 0,
    deathtouchPending: false,
    paralyzePending: 0,
    skipNextAttack: false,
    silencedTurns: 0,
    ...overrides,
  };
}

function makeCombat(...monsters: CombatMonsterState[]): CombatState {
  return {
    segId: 1,
    monsters,
    paralyzedTurns: 0,
    pendingLootRolls: 0,
    isBoss: false,
    outcome: "ongoing",
    pendingDamage: null,
    playerDamageBonus: 0,
    engulfableBodies: 0,
    damageReduction: 0,
    shields: [],
    absorbSoulActive: false,
    fireOfTheDeadActive: false,
    hireling: null,
    hirelingAttackedThisRound: false,
    animalAttackedThisRound: false,
  };
}

describe("Laboratory tables", () => {
  it("is a real dungeon type entered down a staircase through one door", () => {
    const def = Object.values(DUNGEON_TYPES).find((d) => d.key === "laboratory")!;
    expect(def.roll).toBe(12);
    expect(def.entranceType).toBe("staircase"); // "a large trapdoor already open with a stairway"
    expect(def.doors).toBe(1); // "Downstairs you can see a rusty metal door."
  });

  it("registers its own Segments and Secret Passage tables rather than falling back to the shared ones", () => {
    expect(SEGMENTS_TABLE_BY_TYPE.laboratory).toBeDefined();
    expect(SECRET_PASSAGE_TABLE_BY_TYPE.laboratory).toBeDefined();
    for (let roll = 1; roll <= 6; roll++) {
      const row = SEGMENTS_TABLE_BY_TYPE.laboratory![roll]!;
      expect(row.staircase).toBeDefined();
      expect(row.corridor).toBeDefined();
      expect(row.room).toBeDefined();
      expect(SECRET_PASSAGE_TABLE_BY_TYPE.laboratory![roll]).toBeTruthy();
    }
  });

  it("has a Room column that never produces a room -- large halls, corridors, then staircases", () => {
    const table = SEGMENTS_TABLE_BY_TYPE.laboratory!;
    expect([table[1]!.room.type, table[2]!.room.type]).toEqual(["room-large", "room-large"]);
    expect([table[3]!.room.type, table[4]!.room.type]).toEqual(["corridor", "corridor"]);
    expect([table[5]!.room.type, table[6]!.room.type]).toEqual(["staircase", "staircase"]);
  });

  it("fills every row of every reward/content table it prints", () => {
    const t = DUNGEON_TABLES.laboratory;
    for (let roll = 1; roll <= 6; roll++) {
      expect(t.trap[roll]).toBeDefined();
      expect(t.treasure[roll]).toBeDefined();
      expect(t.wonders[roll]).toBeDefined();
      expect(t.weapon[roll]).toBeDefined();
      expect(t.potions![roll]).toBeDefined();
      expect(t.boss![roll]).toBeDefined();
    }
    for (let total = 2; total <= 12; total++) {
      expect(t.roomContent[total]).toBeDefined();
      // 7-8 are the rulebook's own "There are no monsters in this room" rows.
      if (total === 7 || total === 8) expect(t.monsters[total]).toBeNull();
      else expect(t.monsters[total]).toBeTruthy();
    }
  });

  it("routes its Reward table's roll of 6 into the Potions column no other type has", () => {
    const row = DUNGEON_TABLES.laboratory.treasure[6]!;
    expect(row.effect).toEqual({ kind: "rerollColumn", column: "potions" });
    expect(DUNGEON_TABLES.laboratory.potions![1]!.rollsMutation).toBe(true);
  });

  it("is reachable from the map: Forest roll 5, and the Ruins table's 8-9 band on Plains/Forest", () => {
    expect(DUNGEON_TYPE_BY_TERRAIN.forest[5]).toBe(12);
    expect(RUINS_DUNGEON_TYPE.plain[8]!.typeRoll).toBe(12);
    expect(RUINS_DUNGEON_TYPE.plain[9]!.typeRoll).toBe(12);
    expect(RUINS_DUNGEON_TYPE.forest[8]!.typeRoll).toBe(12);
    expect(RUINS_DUNGEON_TYPE.forest[9]!.typeRoll).toBe(12);
  });

  it("recognizes its own differently-worded hidden-Chest row, which exact string equality missed", () => {
    // The shared table says "You have found a hidden Chest!"; the Laboratory's says "Found a hidden
    // Chest!" -- both have to open a chest.
    expect(SECRET_PASSAGE_TABLE_BY_TYPE.laboratory![4]).toBe("Found a hidden Chest!");
    expect(isHiddenChestResult(SECRET_PASSAGE_TABLE_BY_TYPE.laboratory![4])).toBe(true);
    expect(isHiddenChestResult("You have found a hidden Chest!")).toBe(true);
    expect(isHiddenChestResult("There's nothing here.")).toBe(false);
    expect(isHiddenChestResult(null)).toBe(false);
  });

  it("opens a chest found through a Laboratory Secret Passage", () => {
    const state = labState({
      levels: [
        makeLabLevel([
          makeSegment({
            id: 1,
            type: "room-medium",
            doors: [],
            secretPassageSearched: true,
            secretPassageResult: "Found a hidden Chest!",
          }),
        ]),
      ],
    });
    const next = dungeonReducer(state, {
      type: "ROLL_CHEST",
      segId: 1,
      dice: [5, 3],
      trapRoll: null,
    });
    expect(next.levels[0]!.segments[0]!.chestOpened).toBe(true);
    expect(next.coins).toBe(5); // higher die is coins, lower is treasures
    expect(next.treasures).toBe(1 + 3);
  });
});

describe("the Mutation table", () => {
  it("is a Common column that mostly redirects -- a 1 to Fatal, a 6 to Rare", () => {
    expect(MUTATION_TABLE.common[1]!.effect).toEqual({ kind: "reroll", column: "fatal" });
    expect(MUTATION_TABLE.common[6]!.effect).toEqual({ kind: "reroll", column: "rare" });
    for (const roll of [2, 3, 4, 5]) {
      expect(MUTATION_TABLE.common[roll]!.effect.kind).toBe("flavor");
    }
  });

  it("stops at the first non-redirecting entry, recording the path it walked", () => {
    // Common 6 -> Rare, then Rare 3 (+4 HP).
    const walked = rollMutationEntry(sequenceDie([6, 3]));
    expect(walked.dice).toEqual([6, 3]);
    expect(walked.rolled).toHaveLength(2);
    expect(walked.entry.id).toBe("stone-skin");
  });

  it("never redirects more than once -- neither Rare nor Fatal sends you anywhere", () => {
    for (const column of ["rare", "fatal"] as const) {
      for (let roll = 1; roll <= 6; roll++) {
        expect(MUTATION_TABLE[column][roll]!.effect.kind).not.toBe("reroll");
      }
    }
  });

  it("indexes every entry by id, so a recorded mutation can be described back", () => {
    const total = Object.values(MUTATION_TABLE).reduce((n, col) => n + Object.keys(col).length, 0);
    expect(Object.keys(MUTATION_BY_ID)).toHaveLength(total);
    for (const id of Object.values(MUTATION_IDS)) {
      expect(MUTATION_BY_ID[id]).toBeDefined();
    }
  });

  it("a Common flavor roll is recorded but changes nothing else", () => {
    const before = makeResources();
    const result = rollMutation(before, sequenceDie([2]));
    expect(result.died).toBe(false);
    expect(result.resources.mutations).toEqual(["hairless"]);
    expect(result.resources.maxHp).toBe(before.maxHp);
  });

  it("Rare 3 raises max HP by 4; Fatal 4 drops it by 6, pulling current HP down with it", () => {
    const stone = rollMutation(makeResources({ hp: 20, maxHp: 20 }), sequenceDie([6, 3]));
    expect(stone.resources.maxHp).toBe(24);
    expect(stone.resources.hp).toBe(20); // a bigger ceiling doesn't heal you

    const weak = rollMutation(makeResources({ hp: 20, maxHp: 20 }), sequenceDie([1, 4]));
    expect(weak.resources.maxHp).toBe(14);
    expect(weak.resources.hp).toBe(14);
  });

  it("floors a max-HP penalty at 1 rather than letting it reach 0", () => {
    const result = rollMutation(makeResources({ hp: 3, maxHp: 3 }), sequenceDie([1, 4]));
    expect(result.resources.maxHp).toBe(1);
    expect(result.resources.hp).toBe(1);
    expect(result.died).toBe(false);
  });

  it("Fatal 1 and 2 kill outright, recording no mutation at all", () => {
    for (const roll of [1, 2]) {
      const result = rollMutation(makeResources(), sequenceDie([1, roll]));
      expect(result.died).toBe(true);
      expect(result.resources.mutations).toEqual([]);
    }
  });

  it("keeps armor already worn when Bubbles takes away the ability to wear it", () => {
    const before = makeResources({
      armor: [{ piece: "helm", hp: 4, maxHp: 4 }],
    });
    const result = rollMutation(before, sequenceDie([1, 5]));
    expect(result.resources.mutations).toEqual([MUTATION_IDS.noArmor]);
    expect(result.resources.armor).toHaveLength(1);
  });
});

describe("mutations that change what you can do", () => {
  it("Bubbles blocks every armor slot; an extra toe blocks only boots", () => {
    const bubbles = makeResources({ mutations: [MUTATION_IDS.noArmor] });
    expect(canWearArmorPiece(bubbles, "helm")).toBe(false);
    expect(canWearArmorPiece(bubbles, "boots")).toBe(false);

    const toe = makeResources({ mutations: [MUTATION_IDS.noBoots] });
    expect(canWearArmorPiece(toe, "boots")).toBe(false);
    expect(canWearArmorPiece(toe, "helm")).toBe(true);

    expect(canWearArmorPiece(makeResources(), "boots")).toBe(true);
  });

  it("green blood ignores Poison exactly like Pirate does -- damage lands on armor, not straight on HP", () => {
    function fight(mutations: string[]): DungeonState {
      return labState({
        hp: 20,
        armor: [{ piece: "breastplate", hp: 10, maxHp: 10 }],
        mutations,
        combat: makeCombat(
          makeMonster({ name: "Toxic Hound", hp: 5, maxHp: 5, damage: 3, abilities: ["poison"] }),
        ),
      });
    }
    // Poison bypasses armor, so an ordinary character eats it on HP directly...
    const plain = dungeonReducer(fight([]), { type: "PLAYER_ATTACK", targetId: 1, roll: 1 });
    expect(plain.hp).toBeLessThan(20);
    // ...while green blood turns it back into ordinary damage, which armor can absorb (deferred to
    // pendingDamage for the player to assign).
    const immune = dungeonReducer(fight([MUTATION_IDS.poisonImmune]), {
      type: "PLAYER_ATTACK",
      targetId: 1,
      roll: 1,
    });
    expect(immune.hp).toBe(20);
    expect(immune.combat?.pendingDamage).not.toBeNull();
  });

  it("horns give a non-Rinoceroid the same flat 1d6 horn attack", () => {
    function gore(mutations: string[], useHorn: boolean): DungeonState {
      return dungeonReducer(
        labState({
          raceName: "Human",
          mutations,
          // A +3 weapon, so a horn attack (flat 1d6, no weapon effects) is distinguishable from an
          // ordinary one landing the same raw roll.
          weapon: {
            name: "Alchemist King's Sword",
            formula: "1d6",
            bonusEffect: { kind: "weaponDamageBonus", amount: 3 },
          },
          combat: makeCombat(
            makeMonster({
              name: "Aberration",
              hp: 29,
              maxHp: 29,
              damage: 4,
              abilities: ["weakness"],
            }),
          ),
        }),
        { type: "PLAYER_ATTACK", targetId: 1, roll: 4, useHorn },
      );
    }
    // The horn is a flat 1d6 that skips the equipped weapon's bonus...
    const horned = gore([MUTATION_IDS.horns], true).combat!.monsters[0]!.hp;
    const ordinary = gore([MUTATION_IDS.horns], false).combat!.monsters[0]!.hp;
    expect(horned).toBeGreaterThan(ordinary);
    // ...and without the mutation, `useHorn` has nothing to gore with, so it's an ordinary attack.
    expect(gore([], true).combat!.monsters[0]!.hp).toBe(ordinary);
  });
});

describe("the zombie mutation", () => {
  it("halves max HP each time it saves you, then stops saving you", () => {
    let resources = makeResources({ maxHp: 20, hp: 0, mutations: [MUTATION_IDS.zombie] });
    const revivals: number[] = [];
    for (let i = 0; i < 6; i++) {
      const hp = zombieRevivalHp(resources);
      if (hp === null) break;
      revivals.push(hp);
      resources = applyZombieRevival(resources, hp);
    }
    expect(revivals).toEqual([10, 5, 2, 1]); // 20/2, /4, /8, /16 -- then 20/32 floors to 0
    expect(zombieRevivalHp(resources)).toBeNull();
    expect(resources.zombieRevivals).toBe(4);
  });

  it("does nothing for a character who never rotted", () => {
    expect(zombieRevivalHp(makeResources({ maxHp: 20 }))).toBeNull();
    expect(hasMutation(makeResources(), MUTATION_IDS.zombie)).toBe(false);
  });

  it("saves a character from the Darkness inside a dungeon, at half max HP", () => {
    const state = labState({ torches: 0, maxHp: 16, hp: 4, mutations: [MUTATION_IDS.zombie] });
    const next = dungeonReducer(state, {
      type: "ROLL_DUNGEON",
      typeRoll: 12,
      nameRolls: [3, 3, 3],
    });
    expect(next.alive).toBe(true);
    expect(next.hp).toBe(8);
    expect(next.zombieRevivals).toBe(1);
  });

  it("stops saving them once halving would round to nothing, and the death sticks", () => {
    const state = labState({
      torches: 0,
      maxHp: 16,
      hp: 4,
      mutations: [MUTATION_IDS.zombie],
      zombieRevivals: 4, // 16/32 floors to 0
    });
    const next = dungeonReducer(state, {
      type: "ROLL_DUNGEON",
      typeRoll: 12,
      nameRolls: [3, 3, 3],
    });
    expect(next.alive).toBe(false);
    expect(next.deathCause).toBe("darkness");
  });
});

describe("the Mutation Potion", () => {
  it("rolls on the Mutation table from inside the run, recording the result on the dungeon", () => {
    // OPEN_TREASURE: 6 -> the Potions column; then 1 -> Mutation Potion; then the mutation's own
    // walk (6 -> Rare, 3 -> stone skin).
    const next = dungeonReducer(
      labState({ maxHp: 20, hp: 20 }),
      { type: "OPEN_TREASURE", roll: 6 },
      sequenceDie([1, 6, 3]),
    );
    expect(next.treasures).toBe(0);
    expect(next.mutations).toEqual(["stone-skin"]);
    expect(next.maxHp).toBe(24);
  });

  it("can kill the drinker outright, leaving their remains behind", () => {
    const next = dungeonReducer(
      labState({ coins: 12 }),
      { type: "OPEN_TREASURE", roll: 6 },
      sequenceDie([1, 1, 1]), // Potions 1 -> Mutation, then Common 1 -> Fatal 1 ("melt into a goo")
    );
    expect(next.alive).toBe(false);
    expect(next.mutations ?? []).toEqual([]);
    expect(next.levels[0]!.segments[0]!.remains).toBeDefined();
  });

  it("an Ogre sells a potion instead of drinking it", () => {
    const next = dungeonReducer(
      labState({ raceName: "Ogre" }),
      { type: "OPEN_TREASURE", roll: 6 },
      sequenceDie([1]),
    );
    expect(next.heldItems).toHaveLength(1);
    expect(next.heldItems[0]!.name).toBe("Mutation Potion");
    expect(next.mutations ?? []).toEqual([]);
  });

  it("Luminescence Potion is worth two torches; Fool's Potion teaches three Basic Spells", () => {
    const lit = dungeonReducer(
      labState({ torches: 3 }),
      { type: "OPEN_TREASURE", roll: 6 },
      sequenceDie([4]),
    );
    expect(lit.torches).toBe(5);

    const learned = dungeonReducer(
      labState(),
      { type: "OPEN_TREASURE", roll: 6 },
      sequenceDie([6, 1, 1, 2]), // Potions 6, then three spell rolls
    );
    expect(learned.spellUses["basic:1"]).toBe(2);
    expect(learned.spellUses["basic:2"]).toBe(1);
    expect(learned.maxSpellUses["basic:1"]).toBe(2);
  });
});
