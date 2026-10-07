import { test, expect, type Page } from "@playwright/test";

/**
 * Issue #141: a dungeon run used to live only in `DungeonScreen`'s reducer, reaching localStorage
 * on unmount (which a reload never triggers) or on beating the Boss. So a reload rewound the whole
 * trip -- and reloading on the death panel resurrected the character, already in the Graveyard, at
 * their pre-trip HP. `liveRun` now snapshots the run after every dispatch and a reload resumes it.
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
  tiles: { "0,0": { terrain: "plain", location: "humanCity", dungeonRunId: "run-reload" } },
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
          dungeonHistory: [],
          activeRunId: null,
          world,
          ...extra,
        }),
      );
    },
    { character: CHARACTER, resources: RESOURCES, world: WORLD, extra },
  );
  await page.reload();
}

function readLiveRun(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem("notequest:session");
    return raw
      ? (JSON.parse(raw) as { liveRun?: { dungeon: { log: unknown[]; hp: number } } | null })
          .liveRun
      : null;
  });
}

test("a reload mid-fight resumes the fight exactly where it was", async ({ page }) => {
  const dungeon = makeDungeon(true);
  await seed(page, {
    dungeonHistory: [{ id: "run-reload", lastCharacterName: CHARACTER.name, dungeon }],
    activeRunId: "run-reload",
  });
  await page.getByRole("button", { name: "Enter City" }).click();
  await page.getByRole("button", { name: "Enter Dungeon" }).click();

  await page.getByRole("button", { name: "Attack" }).first().click();
  await expect
    .poll(async () => (await readLiveRun(page))?.dungeon.log.length ?? 0)
    .toBeGreaterThan(0);
  const before = await readLiveRun(page);

  await page.reload();

  // Straight back into the dungeon -- no Enter City / Enter Dungeon -- with nothing rewound.
  await expect(page.getByRole("button", { name: "Enter City" })).toHaveCount(0);
  await expect(page.getByText("The Palace of the Secret Horrors").first()).toBeVisible();
  const after = await readLiveRun(page);
  expect(after?.dungeon.hp).toBe(before?.dungeon.hp);
  expect(after?.dungeon.log.length).toBe(before?.dungeon.log.length);
});

test("a reload on the death panel keeps the character dead, and doesn't bury them twice", async ({
  page,
}) => {
  const dungeon = { ...makeDungeon(false), hp: 0, alive: false, deathCause: "combat" };
  await seed(page, {
    liveRun: {
      runId: "run-reload",
      dungeon,
      forcedTypeRoll: null,
      noExit: false,
      enteredFromTown: true,
    },
  });

  await expect(page.getByText(`${CHARACTER.name} Has Fallen`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter City" })).toHaveCount(0);
  // The death was recorded before the reload; resuming the snapshot must not record it again.
  expect(await page.evaluate(() => localStorage.getItem("notequest:graveyard"))).toBeNull();

  await page.getByRole("button", { name: "Roll a New Adventurer" }).first().click();
  await expect.poll(() => readLiveRun(page)).toBeNull();
  await page.reload();
  await expect(page.getByText(`${CHARACTER.name} Has Fallen`)).toHaveCount(0);
});
