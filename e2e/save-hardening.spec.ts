import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";

/**
 * Issue #142: the save is one localStorage blob, so it could vanish, fail to write, or be overwritten
 * by a second tab -- all silently. These cover the three guards: Export/Import Save, the warning when
 * storage refuses a write, and the takeover overlay when another tab saves.
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
  spellUses: {},
  monsterKills: 0,
  bossKills: 0,
  killsByName: {},
  killsByAbility: {},
  provisions: 20,
};

const WORLD = {
  climate: "hot",
  home: { q: 0, r: 0 },
  player: { q: 0, r: 0 },
  tiles: { "0,0": { terrain: "plain", location: "humanCity" } },
};

const GRAVEYARD_ENTRY = {
  name: "Bram",
  dungeon: "The Crypt of the Broken Curse",
  causeOfDeath: "combat",
};

async function seed(page: Page) {
  await page.goto("/");
  await page.evaluate(
    ({ character, resources, world, graveyardEntry }) => {
      localStorage.clear();
      localStorage.setItem(
        "notequest:session",
        JSON.stringify({ character, resources, dungeonHistory: [], activeRunId: null, world }),
      );
      localStorage.setItem("notequest:graveyard", JSON.stringify([graveyardEntry]));
    },
    { character: CHARACTER, resources: RESOURCES, world: WORLD, graveyardEntry: GRAVEYARD_ENTRY },
  );
  await page.reload();
  await expect(page.getByRole("button", { name: "Enter City" })).toBeVisible();
}

test("an exported save survives Reset Everything and loads back in", async ({ page }) => {
  await seed(page);

  await page.getByRole("button", { name: "Settings" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Save" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^gerdquest-.+-\d{4}-\d{2}-\d{2}\.json$/);
  const exported = readFileSync((await download.path())!, "utf8");
  expect(JSON.parse(exported)).toMatchObject({
    format: "gerdquest-save",
    session: { character: { name: CHARACTER.name } },
    graveyard: [{ name: GRAVEYARD_ENTRY.name }],
  });

  await page.getByRole("button", { name: "Reset Everything…" }).click();
  await page.getByRole("button", { name: "Reset Everything", exact: true }).click();
  await expect(page.getByLabel("Character creation sheet")).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Save file to import").setInputFiles({
    name: "save.json",
    mimeType: "application/json",
    buffer: Buffer.from(exported),
  });
  await expect(page.getByText("Load This Save?")).toBeVisible();
  await page.getByRole("button", { name: "Load Save" }).click();

  // Back on the map with the same character, and the Graveyard came along.
  await expect(page.getByRole("button", { name: "Enter City" })).toBeVisible();
  const graveyard = await page.evaluate(() => localStorage.getItem("notequest:graveyard"));
  expect(JSON.parse(graveyard!)).toEqual([GRAVEYARD_ENTRY]);
});

test("importing something that isn't a save explains why and changes nothing", async ({ page }) => {
  await seed(page);
  const before = await page.evaluate(() => localStorage.getItem("notequest:session"));

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Save file to import").setInputFiles({
    name: "notes.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ shopping: ["torches"] })),
  });
  await page.getByRole("button", { name: "Load Save" }).click();

  await expect(page.getByRole("alert")).toHaveText("That file isn't a GerdQuest save.");
  expect(await page.evaluate(() => localStorage.getItem("notequest:session"))).toBe(before);
});

test("a second tab that changes the game takes over the save from the first", async ({ page }) => {
  await seed(page);

  const second = await page.context().newPage();
  await second.goto("/");
  await expect(second.getByRole("button", { name: "Enter City" })).toBeVisible();
  // Merely opening a second tab re-saves an identical blob, which fires no `storage` event -- two
  // tabs holding the same game can't clobber each other. The takeover is the first real change.
  await expect(page.getByText("Open in Another Tab")).toHaveCount(0);

  await second.getByRole("button", { name: "Settings" }).click();
  await second.getByRole("button", { name: "Reset Everything…" }).click();
  await second.getByRole("button", { name: "Reset Everything", exact: true }).click();

  await expect(page.getByText("Open in Another Tab")).toBeVisible();
  await expect(second.getByText("Open in Another Tab")).toHaveCount(0);

  // Taking it back loads the latest save -- the reset one -- rather than resurrecting this tab's copy.
  await page.getByRole("button", { name: "Play Here Instead" }).click();
  await expect(page.getByLabel("Character creation sheet")).toBeVisible();
});

test("a browser refusing storage gets a warning instead of silent loss", async ({ page }) => {
  await seed(page);
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await page.reload();

  const warning = page.getByRole("alert");
  await expect(warning).toContainText("progress isn't being saved");
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(warning).toHaveCount(0);
});
