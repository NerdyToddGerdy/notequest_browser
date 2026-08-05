import { test, expect } from "@playwright/test";

/**
 * Cave (issue #138): the second dungeon family with no Boss and no Final Room, and the first whose
 * tunnels have a *width*.
 *
 * Three things here only exist end-to-end. A narrow tunnel is a brand-new `SegmentType`, so it has
 * to survive the whole persisted-state -> reducer -> rendered-map path (a segment type the map
 * can't draw is invisible in Vitest). Leaving via the flooded Grotto is the only completion the
 * type has, and it costs a torch -- which the reducer refuses to spend you to death over, so both
 * the enabled and disabled states of that one button matter. And a Reef/Volcano hex leading into a
 * real dungeon is the whole "last stubbed hex locations" half of the issue.
 */

const CHARACTER = {
  name: "Spelunk",
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

function resources(torches: number) {
  return {
    torches,
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
}

/** A Ruins hex on mountain -- one of the two real routes to a Cave (the Ruins 2d6 table's 2-4 band,
 * which substituted Sewers before this issue; the other is Mountain roll 6). Deliberately not a
 * City/Fortress, so the World screen keeps showing the map and `HexInspector` rather than swapping
 * in `TownScreen`, and not an empty hex, which offers no gate without an Ask marker. */
const WORLD = {
  climate: "hot",
  home: { q: 0, r: 0 },
  player: { q: 1, r: 0 },
  tiles: {
    "0,0": { terrain: "plain", location: "humanCity", name: "Haven" },
    "1,0": { terrain: "mountain", location: "ruins", dungeonRunId: "run-cave" },
  },
};

/** The flooded Grotto -- Room Content 2, the Cave's only exit, mid-run so there is a real map
 * around it. The wide tunnel is the entrance; the narrow tunnel hangs off it. */
function caveDungeon(torches: number) {
  return {
    dungeonTypeKey: "cave",
    dungeonName: "The Drowned Cave of the Frost Queen",
    entranceFlavor: "The wide tunnel runs on into the dark.",
    levels: [
      {
        depth: 1,
        segments: [
          {
            id: 1,
            x: 0,
            y: 100,
            w: 100,
            h: 40,
            cx: 50,
            cy: 120,
            type: "tunnel",
            cameFromDir: null,
            flavor: null,
            doors: [
              { dir: "E", opened: true, childId: 2, leadsToLevel: null, continuesTunnel: true },
            ],
            isEntrance: true,
          },
          {
            id: 2,
            x: 180,
            y: 110,
            w: 100,
            h: 20,
            cx: 230,
            cy: 120,
            type: "tunnel-narrow",
            cameFromDir: "W",
            flavor: null,
            doors: [
              { dir: "E", opened: true, childId: 3, leadsToLevel: null, continuesTunnel: true },
            ],
            isEntrance: false,
          },
          {
            id: 3,
            x: 360,
            y: 70,
            w: 120,
            h: 120,
            cx: 420,
            cy: 130,
            type: "room-medium",
            cameFromDir: "W",
            flavor: null,
            doors: [],
            isEntrance: false,
            roomContent: {
              text: "It's all flooded. Spend 1 torch to get out of this cave.",
              secretPassage: false,
              isExit: true,
              exitTorchCost: 1,
            },
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
    nextSegmentId: 4,
    nextLogId: 1,
    nextMonsterId: 1,
    selectedSegId: 3,
    currentSegId: 3,
    stats: { segments: 3, corridors: 0, rooms: 1, staircases: 0, doorsRemaining: 0, finalRooms: 0 },
    log: [],
    ...resources(torches),
    combat: null,
    characterName: CHARACTER.name,
    raceName: CHARACTER.race.name,
    className: CHARACTER.cls.name,
    weaponFormula: CHARACTER.cls.weaponDamage,
    alive: true,
    deathCause: null,
  };
}

async function seed(page: import("@playwright/test").Page, torches: number) {
  // Every empty room is flagged `needsMonsterReroll` when a run is restored, so stepping into the
  // Grotto rolls the Monsters table -- a fight there would hide the exit and make this flaky.
  // 0.5 -> die 4, so the 2d6 lands on 8: "There are no monsters in this room."
  await page.addInitScript(() => {
    Math.random = () => 0.5;
  });
  await page.goto("/");
  await page.evaluate(
    ({ character, res, world, dungeon }) => {
      localStorage.setItem(
        "notequest:session",
        JSON.stringify({
          character,
          resources: res,
          dungeonHistory: [{ id: "run-cave", lastCharacterName: character.name, dungeon }],
          activeRunId: "run-cave",
          world,
        }),
      );
    },
    { character: CHARACTER, res: resources(torches), world: WORLD, dungeon: caveDungeon(torches) },
  );
  await page.reload();
  await page.getByRole("button", { name: /enter dungeon/i }).click();
  // `RETURN_TO_DUNGEON` puts the player back at the level's entry segment regardless of where the
  // run was saved (`restoreMapFromPersisted()`), so the walk to the flooded Grotto is real -- and
  // it is the walk that proves both tunnels are reachable and selectable.
  await page
    .getByTitle(/Narrow Tunnel/)
    .first()
    .click();
  await expect(page.getByText(/Segment 2 · Narrow Tunnel/)).toBeVisible();
  await page
    .getByTitle(/Medium Room/)
    .first()
    .click();
}

test("a Cave draws its narrow tunnels and is finished by wading out", async ({ page }) => {
  await seed(page, 3);

  // The new segment type survived persistence and was drawn -- the map labels each segment by type.
  await expect(page.getByTitle(/Narrow Tunnel/).first()).toBeVisible();

  // Room Content 2 is the exit, and it names its own price -- Sewers' ladder is free.
  const leave = page.getByRole("button", { name: /leave the cave \(1 torch\)/i });
  await expect(leave).toBeEnabled();
  await leave.click();

  // No Boss was ever fought, and the run still counts as done.
  await expect(page.getByText(/out, and breathing air/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /return to town/i })).toBeVisible();
});

test("refuses to let you spend your last torch escaping", async ({ page }) => {
  await seed(page, 0);

  const leave = page.getByRole("button", { name: /leave the cave \(1 torch\)/i });
  await expect(leave).toBeDisabled();
  await expect(page.getByText(/need a torch to force your way out/i)).toBeVisible();
});
