import { test, expect } from "@playwright/test";

/**
 * Laboratory (issue #30): "Any hero or creature that leaves this dungeon will mutate."
 *
 * The only Special Rule in the game that fires on *leaving* a dungeon, which puts it in `App.tsx`'s
 * `handleReturnToTown` -- outside the reducer, outside Town, and after `DungeonScreen` has already
 * unmounted. That whole path (retreat -> roll -> apply to `AdventurerResources` -> surface it on the
 * World screen -> persist it) only exists end-to-end, so it's checked here rather than in Vitest.
 *
 * `Math.random` is pinned so the roll is a specific Common-column row: a fatal mutation is a real
 * (1-in-18) outcome of this exact flow, and a test that occasionally kills the character instead
 * would be flaky rather than thorough.
 */

const CHARACTER = {
  name: "Testerin",
  race: { roll: 7, name: "Human", hp: 12, ability: "None." },
  cls: {
    roll: 7,
    name: "Fighter",
    hpBonus: 4,
    ability: "None.",
    weapon: "Sword",
    weaponDamage: "1d6+1",
  },
  totalHp: 16,
  spells: [],
  fixedGrants: [],
  torches: 10,
  coins: 20,
};

const RESOURCES = {
  torches: 8,
  hp: 16,
  maxHp: 16,
  coins: 5,
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
  provisions: 20,
  advancedClasses: [],
  hireling: null,
  hirelingHp: null,
  curiosities: {},
  animals: [],
  buildings: [],
  troops: 0,
  troopSources: [],
  survivedRunIds: [],
  flyActive: false,
  catatonic: false,
  mutations: [],
  zombieRevivals: 0,
  nextDungeonDamageBonus: 0,
};

/** A Ruins hex on forest -- one of the two real routes to a Laboratory (the Ruins 2d6 table's 8-9
 * band on Plains/Forest; the other is Forest roll 5). Deliberately not a City/Fortress, so the World
 * screen shows the map and `HexInspector` on return rather than swapping in `TownScreen`. */
const WORLD = {
  climate: "hot",
  home: { q: 0, r: 0 },
  player: { q: 1, r: 0 },
  tiles: {
    "0,0": { terrain: "plain", location: "humanCity", name: "Haven" },
    "1,0": { terrain: "forest", location: "ruins", dungeonRunId: "run-lab" },
  },
};

const DUNGEON = {
  dungeonTypeKey: "laboratory",
  dungeonName: "The Cursed Laboratory of the Alchemist",
  entranceFlavor: "A rusty metal door at the bottom of the stairway.",
  levels: [
    {
      depth: 1,
      segments: [
        {
          id: 1,
          type: "staircase",
          cameFromDir: null,
          flavor: null,
          doors: [],
          isEntrance: true,
        },
      ],
      connectors: [],
      doorsRemaining: 0,
      hasStaircase: false,
      isFinalRoomLevel: false,
      finalRoomPlaced: false,
      stairwayTarget: null,
    },
  ],
  activeLevel: 0,
  nextSegmentId: 2,
  nextLogId: 1,
  nextMonsterId: 1,
  selectedSegId: 1,
  currentSegId: 1,
  stats: { segments: 1, corridors: 0, rooms: 0, staircases: 1, doorsRemaining: 0, finalRooms: 0 },
  log: [],
  ...RESOURCES,
  combat: null,
  characterName: CHARACTER.name,
  raceName: CHARACTER.race.name,
  className: CHARACTER.cls.name,
  weaponFormula: CHARACTER.cls.weaponDamage,
  alive: true,
  deathCause: null,
};

test("leaving a Laboratory mutates the character, and the mutation sticks", async ({ page }) => {
  // 0.25 -> die 2. Common 2 is "All hairs on your body fall out." -- a recorded, non-fatal row.
  await page.addInitScript(() => {
    Math.random = () => 0.25;
  });
  await page.goto("/");
  await page.evaluate(
    ({ character, resources, world, dungeon }) => {
      localStorage.setItem(
        "notequest:session",
        JSON.stringify({
          character,
          resources,
          dungeonHistory: [{ id: "run-lab", lastCharacterName: character.name, dungeon }],
          activeRunId: "run-lab",
          world,
        }),
      );
    },
    { character: CHARACTER, resources: RESOURCES, world: WORLD, dungeon: DUNGEON },
  );
  await page.reload();

  await page.getByRole("button", { name: "Enter Dungeon" }).click();
  await expect(page.getByText("The Cursed Laboratory of the Alchemist")).toBeVisible();

  await page.getByRole("button", { name: "Retreat to Town" }).click();
  await page.getByRole("button", { name: "Retreat", exact: true }).click();

  // The mutation is announced on arrival...
  await expect(
    page.getByText("You mutate on the way out: All hairs on your body fall out."),
  ).toBeVisible();
  // ...and is a permanent part of the character from then on.
  await expect(page.getByText("All hairs on your body fall out.").last()).toBeVisible();

  // Permanent means persisted: it survives a reload, unlike the one-off arrival note.
  await page.reload();
  await expect(page.getByText("All hairs on your body fall out.")).toBeVisible();
  await expect(page.getByText("You mutate on the way out:")).toHaveCount(0);
});
