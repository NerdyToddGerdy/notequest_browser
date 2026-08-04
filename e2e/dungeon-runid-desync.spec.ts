import { test, expect } from "@playwright/test";

/**
 * Issue #123, reported as: "Returned to town. Tried to go back to the dungeon. It created a new
 * dungeon."
 *
 * `HexTile.dungeonRunId` is stamped the instant "Enter Dungeon" is clicked -- before the run has
 * rolled anything. Backing out of the pre-roll gate makes `handleLeaveDungeon` drop the
 * never-rolled run, and the hex was left pointing at an id that existed nowhere. From then on every
 * visit resolved the stale id to neither `activeDungeon` nor `resumeDungeon`, so `DungeonScreen`'s
 * mount initializer fell through to `crypto.randomUUID()` and rolled a brand-new dungeon under an id
 * the hex never learned -- permanently, and invisibly, because by then the player had genuinely
 * played a dungeon and nothing on screen hinted the hex was poisoned.
 *
 * This lives in e2e rather than Vitest because the desync is between persisted `localStorage` state
 * and the real mounted screen: the stamp is written by `App.tsx`, dropped by an unmount cleanup in
 * `DungeonScreen`, and only observable by driving both.
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

/** A Ruins hex, never entered -- no `dungeonRunId` yet, so "Enter Dungeon" takes the first-find
 * path that does the stamping. Deliberately not a City/Fortress, so the World screen shows the map
 * and `HexInspector`'s own Enter Dungeon button rather than swapping in `TownScreen` (issue #122). */
const WORLD = {
  climate: "hot",
  home: { q: 0, r: 0 },
  player: { q: 1, r: 0 },
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

/** The hex's stamp as actually persisted, which is the thing that used to go stale. */
async function storedRunId(page: import("@playwright/test").Page): Promise<string | undefined> {
  return page.evaluate(() => {
    const raw = localStorage.getItem("notequest:session");
    if (!raw) return undefined;
    return JSON.parse(raw)?.world?.tiles?.["1,0"]?.dungeonRunId;
  });
}

/** Every run id `dungeonHistory` actually holds. */
async function storedHistoryIds(page: import("@playwright/test").Page): Promise<string[]> {
  return page.evaluate(() => {
    const raw = localStorage.getItem("notequest:session");
    if (!raw) return [];
    return (JSON.parse(raw).dungeonHistory ?? []).map((pd: { id: string }) => pd.id);
  });
}

/** The hex's stamp, once it resolves to a run that genuinely exists. Polled rather than read
 * straight after the click, since App persists the whole session from an effect. */
async function expectStampResolves(page: import("@playwright/test").Page): Promise<string> {
  await expect
    .poll(async () => {
      const stamped = await storedRunId(page);
      if (!stamped) return false;
      return (await storedHistoryIds(page)).includes(stamped);
    })
    .toBe(true);
  return (await storedRunId(page))!;
}

test("backing out of the pre-roll gate leaves the hex un-stamped, so it can still be found later", async ({
  page,
}) => {
  await seed(page);

  // Step 1 of the report's repro: enter, then leave without ever rolling.
  await page.getByRole("button", { name: "Enter Dungeon" }).click();
  await expect(page.getByRole("button", { name: "Roll for Dungeon" })).toBeVisible();
  await page.getByRole("button", { name: "Back to Town" }).click();

  // The run was dropped for having no levels, so the stamp must have gone with it. Before the fix
  // this held a run id that existed in no history anywhere -- and nothing could ever repair it.
  await expect.poll(() => storedRunId(page)).toBeUndefined();
});

test("a dungeon rolled after backing out is the one the hex remembers", async ({ page }) => {
  await seed(page);

  // Poison the hex the way the report did: enter and back out without rolling.
  await page.getByRole("button", { name: "Enter Dungeon" }).click();
  await page.getByRole("button", { name: "Back to Town" }).click();

  // Now genuinely roll one and retreat, exactly as the player did.
  await page.getByRole("button", { name: "Enter Dungeon" }).click();
  await page.getByRole("button", { name: "Roll for Dungeon" }).click();
  await expect(page.getByRole("button", { name: "Retreat to Town" })).toBeVisible({
    timeout: 15000,
  });

  const rolledName = await page.locator("h1, h2").first().textContent();
  // Mid-run retreat is confirmation-gated (issue #36), unlike the pre-roll "Back to Town".
  await page.getByRole("button", { name: "Retreat to Town" }).click();
  await page.getByRole("button", { name: "Retreat", exact: true }).click();

  // The hex now points at the run that actually exists...
  await expectStampResolves(page);

  // ...and going back in resumes it rather than rolling a third dungeon. This is the reported
  // symptom: the pre-roll gate reappearing here means a fresh dungeon was about to be created.
  await page.getByRole("button", { name: "Enter Dungeon" }).click();
  await expect(page.getByRole("button", { name: "Roll for Dungeon" })).toHaveCount(0);
  expect(await page.locator("h1, h2").first().textContent()).toBe(rolledName);
});

test("a save already poisoned by the old bug repairs itself on the next visit", async ({
  page,
}) => {
  await seed(page);
  // Exactly the broken state the bug left behind: a stamp pointing at a run in no history. Existing
  // saves are already like this, so the fix has to heal them rather than only prevent new ones.
  await page.evaluate(() => {
    const raw = localStorage.getItem("notequest:session")!;
    const session = JSON.parse(raw);
    session.world.tiles["1,0"].dungeonRunId = "run-that-never-existed";
    localStorage.setItem("notequest:session", JSON.stringify(session));
  });
  await page.reload();

  await page.getByRole("button", { name: "Enter Dungeon" }).click();
  await page.getByRole("button", { name: "Roll for Dungeon" }).click();
  await expect(page.getByRole("button", { name: "Retreat to Town" })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("button", { name: "Retreat to Town" }).click();
  await page.getByRole("button", { name: "Retreat", exact: true }).click();

  // The stale id is gone, replaced by one that resolves -- the hex is usable again.
  const stamped = await expectStampResolves(page);
  expect(stamped).not.toBe("run-that-never-existed");
});
