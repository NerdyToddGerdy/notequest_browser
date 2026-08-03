import { test, expect } from "@playwright/test";

/**
 * Issue #120: a wilderness Event used to strip the character to `hp` and a weapon formula -- no
 * armor absorption, no spells, no Hireling, no animals, no potions -- and offered exactly one
 * button, Fight. A player walked onto a plain and lost a character to a Wyvern.
 *
 * The engine tests cover the rules; this covers the thing only the real app can show: that the
 * fight a player is *forced into* now presents the character they actually built, and has an exit.
 */

const CHARACTER = {
  name: "Wanderer",
  race: { roll: 7, name: "Human", hp: 12, ability: "None." },
  cls: {
    roll: 7,
    name: "Fighter",
    hpBonus: 4,
    ability: "None.",
    weapon: "Sword",
    weaponDamage: "1d6+1",
  },
  totalHp: 20,
  spells: [],
  fixedGrants: [],
  torches: 10,
  coins: 20,
};

const RESOURCES = {
  torches: 8,
  hp: 20,
  maxHp: 20,
  coins: 5,
  treasures: 0,
  keys: 0,
  heldItems: [],
  consumables: [
    {
      name: "Health Potion",
      text: "Health Potion (Recovers all HP).",
      effect: { kind: "healAll" },
    },
  ],
  armor: [{ piece: "breastplate", hp: 10, maxHp: 10 }],
  weapon: null,
  spareWeapons: [],
  spareArmor: [],
  spellUses: { "basic:1": 2, "basic:6": 1 },
  maxSpellUses: { "basic:1": 2, "basic:6": 1 },
  monsterKills: 0,
  bossKills: 0,
  killsByName: {},
  killsByAbility: {},
  provisions: 20,
  advancedClasses: [],
  hireling: "Mercenary",
  hirelingHp: 14,
  curiosities: {},
  animals: ["Snake"],
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

const WORLD = {
  climate: "hot",
  home: { q: 0, r: 0 },
  player: { q: 0, r: 0 },
  tiles: {
    "0,0": { terrain: "plain", location: "humanCity", name: "Haven" },
    "1,0": { terrain: "plain", location: null },
  },
};

test("a wilderness fight brings the whole character, and can be fled", async ({ page }) => {
  // Every die a 1: the 2d6 arrival roll totals 2, which is the Plains "Result 2" row -- the Wyvern
  // from the report.
  await page.addInitScript(() => {
    Math.random = () => 0.0;
  });
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

  // A seeded session on a city hex lands on the map directly as of issue #122 -- no "Explore the
  // World" click needed to get out of the Town Square first.
  // The <svg> owns the pan/zoom handlers so it intercepts pointer events; force past the
  // actionability check and aim at the neighbour's top edge, which the inspector card doesn't cover.
  const neighbour = page.locator("svg polygon").nth(1);
  const box = (await neighbour.boundingBox())!;
  await neighbour.click({ force: true, position: { x: box.width / 2, y: 12 } });

  await expect(page.getByText("A Wyvern drops out of the sky.")).toBeVisible();
  await page.getByRole("button", { name: "Fight", exact: true }).click();

  // Everything that used to be silently absent from a wilderness fight.
  // "Mercenary" also appears on the sidebar sheet, so scope to the first match.
  await expect(page.getByText("Mercenary").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Mercenary Attacks" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Snake Attacks" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Heal \(2\)/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Fireball \(1\)/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Drink Health Potion/ })).toBeVisible();
  // The character's real weapon, not a bare fallback.
  await expect(page.getByText("Sword (1d6+1)").first()).toBeVisible();

  // ...and the exit that didn't exist. Fleeing costs a provision and ends the encounter.
  await page.getByRole("button", { name: /Flee/ }).click();
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  // The encounter is over -- which is the whole point: it used to have no exit at all. What
  // fleeing costs is asserted in `events.test.ts`, where the arithmetic is legible.
  await expect(page.getByText("A Wyvern drops out of the sky.")).toHaveCount(0);
});
