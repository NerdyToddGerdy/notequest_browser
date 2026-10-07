import { test, expect, type Page } from "@playwright/test";

/**
 * Two regressions from the style pass that can only be seen rendered:
 * - The World screen on a phone: its stacking `@media` rules sat above the base grid rules they
 *   override, lost on source order, and crushed the map to a ~40px column with Enter City off-screen.
 * - The crash screen: since #141 a reload resumes the saved dungeon run, so a run that crashes on
 *   render would crash on every reload. The error boundary's "Leave the Dungeon" is the way out.
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
  hp: 3, // one bad monster roll from death -- exactly the "about to die" scenario reported
  maxHp: 16,
  coins: 5,
  treasures: 0,
  keys: 0,
  heldItems: [],
  consumables: [],
  armor: [],
  weapon: null,
  spareWeapons: [],
  spellUses: {},
  monsterKills: 7,
  bossKills: 1,
  killsByName: { orc: 7 },
  killsByAbility: {},
  provisions: 20,
};

const WORLD = {
  climate: "hot",
  home: { q: 0, r: 0 },
  player: { q: 0, r: 0 },
  tiles: { "0,0": { terrain: "plain", location: "humanCity", dungeonRunId: "run-combat" } },
};

/** A dungeon with a single room, mid-fight against an Orc -- `inCombat: false` builds the same
 * room already cleared instead, for the "outside combat" comparison test. */
function makeDungeon(inCombat: boolean) {
  // Room segments are eligible for the "fresh monsters moved in" re-roll on RETURN_TO_DUNGEON
  // (see restoreMapFromPersisted/rerollMonstersIfNeeded in dungeonReducer.ts) whenever they're
  // empty or already cleared -- correct app behavior, but it would immediately restart combat in
  // the "outside combat" case below. A corridor is never eligible (the reroll only considers
  // `room-` typed segments), so it's the only segment type that reliably starts non-combat.
  const room = inCombat
    ? {
        id: 1,
        type: "room-small",
        cameFromDir: null,
        flavor: null,
        doors: [],
        isEntrance: true,
        monsters: { name: "Orc", hp: 6, damage: 3, abilities: [], count: 1 },
      }
    : {
        id: 1,
        type: "corridor",
        cameFromDir: null,
        flavor: null,
        doors: [],
        isEntrance: true,
      };
  return {
    dungeonTypeKey: "palace",
    dungeonName: "The Palace of the Secret Horrors",
    entranceFlavor: "A torchlit hall.",
    levels: [
      {
        depth: 1,
        segments: [room],
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
    nextMonsterId: 2,
    selectedSegId: 1,
    currentSegId: 1,
    stats: { segments: 1, corridors: 0, rooms: 1, staircases: 0, doorsRemaining: 0, finalRooms: 0 },
    log: [],
    ...RESOURCES,
    combat: inCombat
      ? {
          segId: 1,
          monsters: [
            {
              id: 1,
              name: "Orc",
              hp: 6,
              maxHp: 6,
              damage: 3,
              abilities: [],
              bonusDamage: 0,
              deathtouchPending: false,
              paralyzePending: 0,
              skipNextAttack: false,
            },
          ],
          paralyzedTurns: 0,
          pendingLootRolls: 0,
          isBoss: false,
          outcome: "ongoing",
          pendingDamage: null,
          playerDamageBonus: 0,
          engulfableBodies: 0,
        }
      : null,
    characterName: CHARACTER.name,
    raceName: CHARACTER.race.name,
    className: CHARACTER.cls.name,
    weaponFormula: CHARACTER.cls.weaponDamage,
    alive: true,
    deathCause: null,
  };
}

async function seed(page: Page, extra: Record<string, unknown>) {
  await page.goto("/");
  await page.evaluate(
    ({ character, resources, world, extra }) => {
      localStorage.clear();
      localStorage.setItem(
        "notequest:session",
        JSON.stringify({
          character,
          resources,
          world,
          dungeonHistory: [],
          activeRunId: null,
          ...extra,
        }),
      );
    },
    { character: CHARACTER, resources: RESOURCES, world: WORLD, extra },
  );
  await page.reload();
}

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the World map gets the full width, and Enter City is reachable", async ({ page }) => {
    await seed(page, {});
    const enter = page.getByRole("button", { name: "Enter City" });
    await expect(enter).toBeInViewport();
    // The map's sheet -- the column that collapsed to ~40px.
    const box = await page.locator(".screen-sheet").first().boundingBox();
    expect(box!.width).toBeGreaterThan(300);
    await enter.click();
    await expect(page.getByText("Town Square")).toBeVisible();
  });
});

test("a dungeon run that crashes on render can be left from the crash screen", async ({ page }) => {
  // A hand-built snapshot missing fields a real reducer state always has -- standing in for any
  // render crash inside a resumed run.
  const broken = {
    runId: "run-broken",
    dungeon: makeDungeon(true),
    forcedTypeRoll: null,
    noExit: false,
    enteredFromTown: false,
  };
  await seed(page, { liveRun: broken });

  await expect(page.getByRole("heading", { name: "Something broke" })).toBeVisible();
  // The crash screen persists across reloads -- exactly the trap it exists to get out of.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Something broke" })).toBeVisible();

  await page.getByRole("button", { name: "Leave the Dungeon" }).click();
  await expect(page.getByRole("button", { name: "Enter City" })).toBeVisible();
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem("notequest:session")!));
  expect(session.liveRun).toBeNull();
  expect(session.character.name).toBe(CHARACTER.name);
});
