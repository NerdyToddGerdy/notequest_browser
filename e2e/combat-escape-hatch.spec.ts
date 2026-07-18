import { test, expect, type Page } from "@playwright/test";

/**
 * Regression coverage for a tester report: while in a combat you're about to lose, clicking
 * "Start a New Dungeon" let you escape death entirely -- it discarded the fight (and the whole
 * run) and reset the character's kills/HP/spells to hardcoded defaults instead of their real
 * current stats, with no combat guard at all (unlike the neighboring "Retreat to Town" button,
 * which was already correctly hidden mid-fight).
 *
 * The fix removed "Start a New Dungeon" entirely rather than patching it: a hex's dungeon is
 * meant to be a persistent, findable place (see CLAUDE.md's per-hex dungeon persistence note),
 * and letting a player abandon it for a fresh roll on a whim -- combat or not -- undermined that.
 * These tests assert the button is gone everywhere, not just gated behind a combat check.
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

async function seedAndEnterDungeon(page: Page, inCombat: boolean) {
  await page.goto("/");
  await page.evaluate(
    ({ character, resources, world, dungeon }) => {
      const dungeonHistory = [
        { id: "run-combat", lastCharacterName: character.name, dungeon },
      ];
      localStorage.setItem(
        "notequest:session",
        JSON.stringify({ character, resources, dungeonHistory, activeRunId: "run-combat", world }),
      );
    },
    { character: CHARACTER, resources: RESOURCES, world: WORLD, dungeon: makeDungeon(inCombat) },
  );
  await page.reload();
  await page.getByRole("button", { name: "Enter Dungeon" }).click();
}

test("no escape hatch exists while a fight is underway, even one you're about to lose", async ({ page }) => {
  await seedAndEnterDungeon(page, true);

  // Confirms the seeded fight actually resumed live, not some fallback screen.
  await expect(page.getByText("Orc", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Attack" }).first()).toBeVisible();

  // The reported exploit: this button doesn't exist anywhere on the page anymore, mid-fight or not.
  await expect(page.getByRole("button", { name: "Start a New Dungeon" })).toHaveCount(0);

  // Retreat to Town was already correctly guarded before this fix -- kept as a sanity baseline.
  await expect(page.getByRole("button", { name: "Retreat to Town" })).toHaveCount(0);
});

test("'Start a New Dungeon' is gone outside of combat too -- removed entirely, not just combat-gated", async ({
  page,
}) => {
  await seedAndEnterDungeon(page, false);

  // Retreat to Town is available here (not in combat), confirming this is a real, live dungeon
  // screen and not some degraded fallback state.
  await expect(page.getByRole("button", { name: "Retreat to Town" })).toBeVisible();

  await expect(page.getByRole("button", { name: "Start a New Dungeon" })).toHaveCount(0);
});
