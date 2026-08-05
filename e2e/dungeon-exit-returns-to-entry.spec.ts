import { test, expect } from "@playwright/test";

/**
 * Issue #133, reported as: "Leaving a dungeon below a civilization should bring you into the civ."
 *
 * Direct fallout from #122. That change made standing on a City/Fortress hex show the *map*, with
 * entering the Town Square a deliberate click — correct for travel, but `WorldScreen` remounts with
 * `showTown = false` regardless of where the player was when they left, so a dungeon entered from
 * inside the Town Square exited to the map. The player had to re-enter a city they never left.
 *
 * The rule restored here: **exit returns you to wherever you entered from.** A city dungeon (and the
 * Sewers beneath a Fortress, #99) returns to the Town Square; a Ruins dungeon, entered from
 * `HexInspector` on the map, still returns to the map.
 *
 * e2e rather than Vitest because the whole thing only exists across a screen unmount/remount:
 * `App.tsx` records the entry path, `DungeonScreen` unmounts, and `WorldScreen` seeds its initial
 * `showTown` from it.
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
  armLost: false,
};

/** Player standing on the home Human City, with a Ruins hex next door for the contrast case.
 * `tiles` is typed loosely because the Laboratory test below stamps a `dungeonRunId` onto the home
 * hex; this is seed JSON, not a real `WorldState`. */
const WORLD: {
  climate: string;
  home: { q: number; r: number };
  player: { q: number; r: number };
  hasBoat: boolean;
  bannedHexes: string[];
  tiles: Record<string, Record<string, unknown>>;
} = {
  climate: "hot",
  home: { q: 0, r: 0 },
  player: { q: 0, r: 0 },
  hasBoat: false,
  bannedHexes: [],
  tiles: {
    "0,0": { terrain: "plain", location: "humanCity", name: "Haven" },
    "1,0": { terrain: "forest", location: "ruins" },
  },
};

async function seed(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate(
    ({ character, resources, world }) => {
      localStorage.setItem(
        "notequest:session",
        JSON.stringify({
          character,
          resources,
          dungeonHistory: [],
          activeRunId: null,
          world,
        }),
      );
    },
    { character: CHARACTER, resources: RESOURCES, world: WORLD },
  );
  await page.reload();
}

/** Rolls the dungeon and retreats, confirming through the mid-run confirmation (issue #36). */
async function rollThenRetreat(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Roll for Dungeon" }).click();
  await expect(page.getByRole("button", { name: "Retreat to Town" })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("button", { name: "Retreat to Town" }).click();
  await page.getByRole("button", { name: "Retreat", exact: true }).click();
}

test("a dungeon entered from the Town Square returns to the Town Square", async ({ page }) => {
  await seed(page);

  // In through the city gate, exactly as the report describes.
  await page.getByRole("button", { name: "Enter City" }).click();
  await expect(page.getByText("Town Square")).toBeVisible();
  await page.getByRole("button", { name: "Enter Dungeon" }).click();

  await rollThenRetreat(page);

  // The bug: you landed on the map, outside a city you never left, with an "Enter City" button.
  await expect(page.getByText("Town Square")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter City" })).toHaveCount(0);
});

test("a Ruins dungeon entered from the map still returns to the map", async ({ page }) => {
  await seed(page);

  // The contrast case that was always correct, and must stay correct: entered from HexInspector.
  await page.getByRole("button", { name: "Enter City" }).click();
  await page.getByRole("button", { name: "Explore the World" }).click();
  const ruins = page.locator("svg polygon").nth(1);
  const box = (await ruins.boundingBox())!;
  await ruins.click({ force: true, position: { x: box.width / 2, y: 12 } });

  await page.getByRole("button", { name: "Enter Dungeon" }).click();
  await rollThenRetreat(page);

  // Back on the map. Not standing in a city at all, so there is no Town Square to return to.
  await expect(page.getByText("Town Square")).toHaveCount(0);
  await expect(page.locator("svg polygon").first()).toBeVisible();
});

test("travelling onto a city still shows the map first, preserving #122", async ({ page }) => {
  await seed(page);

  // The behaviour #133 must not undo: arriving at a city by *travel* shows the map, and entering
  // stays a deliberate act. Only a dungeon round trip is exempt, because you already entered once.
  await page.getByRole("button", { name: "Enter City" }).click();
  await page.getByRole("button", { name: "Explore the World" }).click();
  const neighbour = page.locator("svg polygon").nth(1);
  const box = (await neighbour.boundingBox())!;
  await neighbour.click({ force: true, position: { x: box.width / 2, y: 12 } });

  // Now travel back home -- a city arrival, which must land on the map.
  const home = page.locator("svg polygon").first();
  const homeBox = (await home.boundingBox())!;
  await home.click({ force: true, position: { x: homeBox.width / 2, y: 12 } });

  await expect(page.getByRole("button", { name: "Enter City" })).toBeVisible();
  await expect(page.getByText("Town Square")).toHaveCount(0);
});

/** A minimal Laboratory run, lifted from `laboratory-mutation.spec.ts` -- the mutation on the way
 * out is what makes the arrival note load-bearing. */
const LAB_DUNGEON = {
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

test("a mutation on the way out is announced in the Town Square, not lost to the map", async ({
  page,
}) => {
  // The interaction #133 flagged: `arrivalNote` used to reach only `HexInspector`, inside
  // WorldScreen's map branch. Now that a town-entered dungeon returns to the Town Square, a
  // Laboratory beneath a city would have announced a permanent mutation into a panel the player was
  // no longer looking at -- visible nowhere, and cleared by the next move.
  //
  // 0.25 -> die 2. Common 2 is "All hairs on your body fall out." -- recorded, non-fatal.
  await page.addInitScript(() => {
    Math.random = () => 0.25;
  });
  await page.goto("/");
  await page.evaluate(
    ({ character, resources, world, dungeon }) => {
      // The Laboratory sits under the *home city*, so it is entered and exited through town.
      const w = { ...world, tiles: { ...world.tiles } };
      w.tiles["0,0"] = { ...w.tiles["0,0"], dungeonRunId: "run-lab" };
      localStorage.setItem(
        "notequest:session",
        JSON.stringify({
          character,
          resources,
          dungeonHistory: [{ id: "run-lab", lastCharacterName: character.name, dungeon }],
          activeRunId: "run-lab",
          world: w,
        }),
      );
    },
    { character: CHARACTER, resources: RESOURCES, world: WORLD, dungeon: LAB_DUNGEON },
  );
  await page.reload();

  await page.getByRole("button", { name: "Enter City" }).click();
  await page.getByRole("button", { name: "Enter Dungeon" }).click();
  await expect(page.getByText("The Cursed Laboratory of the Alchemist")).toBeVisible();

  await page.getByRole("button", { name: "Retreat to Town" }).click();
  await page.getByRole("button", { name: "Retreat", exact: true }).click();

  // Back in the Town Square (issue #133) -- and the mutation is announced *there*.
  await expect(page.getByText("Town Square")).toBeVisible();
  await expect(
    page.getByText("You mutate on the way out: All hairs on your body fall out."),
  ).toBeVisible();
});
