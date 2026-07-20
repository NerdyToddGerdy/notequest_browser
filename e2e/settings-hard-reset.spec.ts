import { test, expect } from "@playwright/test";

/**
 * Issue #50: Settings' "Reset Everything" wipes both localStorage keys this app writes to
 * (notequest:session, notequest:graveyard) and every piece of App-level in-memory state, landing
 * back on Character Creation with a totally blank slate.
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

test("Settings > Reset Everything wipes localStorage and returns to Character Creation", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(
    ({ character, resources, world, graveyardEntry }) => {
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
      localStorage.setItem("notequest:graveyard", JSON.stringify([graveyardEntry]));
    },
    { character: CHARACTER, resources: RESOURCES, world: WORLD, graveyardEntry: GRAVEYARD_ENTRY },
  );
  await page.reload();

  // Confirms the seeded session actually loaded -- Town Square, not Character Creation.
  await expect(page.getByText("Town Square")).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByText("Reset Everything?")).toBeVisible();

  // Cancel first: nothing should change.
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Town Square")).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Reset Everything" }).click();

  // Lands back on Character Creation with no character.
  await expect(page.getByLabel("Character creation sheet")).toBeVisible();
  await expect(page.getByText("Adventurer's Ledger")).toBeVisible();

  const storageAfterReset = await page.evaluate(() => ({
    session: localStorage.getItem("notequest:session"),
    graveyard: localStorage.getItem("notequest:graveyard"),
  }));
  // clearSession() removes the key, but App.tsx's persistence effect immediately re-fires on the
  // now-empty state and re-saves it -- so the key exists again, just holding nothing of value
  // (the graveyard has no such effect re-saving it, so that key stays gone entirely).
  expect(JSON.parse(storageAfterReset.session!)).toEqual({
    character: null,
    resources: null,
    dungeonHistory: [],
    activeRunId: null,
    world: null,
  });
  expect(storageAfterReset.graveyard).toBeNull();

  // A reload doesn't resurrect anything from some other in-memory leftover.
  await page.reload();
  await expect(page.getByLabel("Character creation sheet")).toBeVisible();
});
