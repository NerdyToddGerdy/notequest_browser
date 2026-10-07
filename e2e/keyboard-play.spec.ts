import { test, expect } from "@playwright/test";

/**
 * Issue #143: the core loop -- pick a hex, pick a dungeon room -- used to be mouse-only, since both
 * were click handlers on non-focusable elements. The World map is one tab stop moved with the arrow
 * keys; reachable dungeon segments are each a tab stop. Enter/Space does whatever a click does.
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
  tiles: {
    "0,0": { terrain: "plain", location: "humanCity", dungeonRunId: "run-combat" },
    "1,0": { terrain: "forest", location: null },
  },
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

test("the World map can be explored and used from the keyboard alone", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(
    ({ character, resources, world }) => {
      localStorage.setItem(
        "notequest:session",
        JSON.stringify({ character, resources, world, dungeonHistory: [], activeRunId: null }),
      );
    },
    { character: CHARACTER, resources: RESOURCES, world: WORLD },
  );
  await page.reload();

  // The map is a single tab stop, starting on the player's own hex.
  const home = page.getByRole("button", { name: /you are here/ });
  await expect(home).toHaveAttribute("tabindex", "0");
  await expect(page.locator('g[role="button"][tabindex="0"]')).toHaveCount(1);
  await home.focus();

  // An arrow moves focus -- and only focus -- to the hex beside it.
  await page.keyboard.press("ArrowRight");
  const forest = page.getByRole("button", { name: /^Forest/ });
  await expect(forest).toBeFocused();
  await expect(forest).toHaveAccessibleName(/press Enter to travel here/);
  await expect(home).toHaveAccessibleName(/you are here/);

  // And back, where Enter does what a click does: open the city.
  await page.keyboard.press("ArrowLeft");
  await expect(home).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Enter City" })).toBeVisible();
});

test("a dungeon segment can be selected from the keyboard", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(
    ({ character, resources, world, dungeon }) => {
      localStorage.setItem(
        "notequest:session",
        JSON.stringify({
          character,
          resources,
          world,
          activeRunId: "run-combat",
          dungeonHistory: [{ id: "run-combat", lastCharacterName: character.name, dungeon }],
        }),
      );
    },
    {
      character: CHARACTER,
      resources: RESOURCES,
      world: WORLD, // Nothing selected yet, so the inspector only appears if Enter actually selects.
      dungeon: { ...makeDungeon(false), selectedSegId: null },
    },
  );
  await page.reload();
  await page.getByRole("button", { name: "Enter City" }).click();
  await page.getByRole("button", { name: "Enter Dungeon" }).click();
  // Resuming always re-selects the first segment, so clear the selection in the run's own saved
  // snapshot and reload -- the inspector then only appears if Enter actually selects.
  await expect(page.getByText("Segment 1 · Corridor")).toBeVisible();
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("notequest:session")!);
    s.liveRun.dungeon.selectedSegId = null;
    localStorage.setItem("notequest:session", JSON.stringify(s));
  });
  await page.reload();

  const segment = page.getByRole("button", { name: /Corridor S1, you are here/ });
  await expect(segment).toHaveAttribute("tabindex", "0");
  await expect(page.getByText("Segment 1 · Corridor")).toHaveCount(0);
  await segment.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Segment 1 · Corridor")).toBeVisible();
});
