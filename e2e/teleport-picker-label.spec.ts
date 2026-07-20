import { test, expect } from "@playwright/test";

/**
 * Issue #56: TeleportPicker listed every valid destination room but gave no indication of which
 * room the player was actually fleeing from -- just a flat list with no "you are here" reference
 * point. Fixed by showing a non-interactive "Fleeing from Level X — [Type] (Segment N)" line
 * above the destination list, looked up from the same `levels`/`excludeSegId` the destination
 * list itself already uses.
 *
 * The destination room here is deliberately the dungeon's own entrance: on RETURN_TO_DUNGEON,
 * every other already-built room gets flagged for the "fresh monsters may have moved in" reroll
 * (see CLAUDE.md's Monster table re-roll on return / issue #55) and isn't a valid teleport target
 * again until the player has walked back into it -- but the entrance is permanently exempt from
 * that flag (#55) the same way it's exempt from ever holding monsters at all (#43), so it's the
 * one room guaranteed to already be a valid, unflagged destination the instant the run resumes.
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
  spellUses: { "basic:3": 1 }, // Teleport, one use -- the only spell this test needs
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
  tiles: { "0,0": { terrain: "plain", location: "humanCity", dungeonRunId: "run-teleport" } },
};

function makeDungeon() {
  const entrance = {
    id: 1,
    type: "room-small",
    cameFromDir: null,
    flavor: null,
    doors: [],
    isEntrance: true,
  };
  const fightRoom = {
    id: 2,
    type: "room-large",
    cameFromDir: null,
    flavor: null,
    doors: [],
    isEntrance: false,
    monsters: { name: "Orc", hp: 6, damage: 3, abilities: [], count: 1 },
  };
  return {
    dungeonTypeKey: "palace",
    dungeonName: "The Palace of the Secret Horrors",
    entranceFlavor: "A torchlit hall.",
    levels: [
      {
        depth: 1,
        segments: [entrance, fightRoom],
        connectors: [],
        doorsRemaining: 0,
        hasStaircase: false,
        isFinalRoomLevel: false,
        finalRoomPlaced: false,
        stairwayTarget: null,
      },
    ],
    activeLevel: 0,
    nextSegmentId: 3,
    nextLogId: 1,
    nextMonsterId: 2,
    selectedSegId: 2,
    currentSegId: 2,
    stats: { segments: 2, corridors: 0, rooms: 2, staircases: 0, doorsRemaining: 0, finalRooms: 0 },
    log: [],
    ...RESOURCES,
    combat: {
      segId: 2,
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
    },
    characterName: CHARACTER.name,
    raceName: CHARACTER.race.name,
    className: CHARACTER.cls.name,
    weaponFormula: CHARACTER.cls.weaponDamage,
    alive: true,
    deathCause: null,
  };
}

test("TeleportPicker labels the room being fled from, above the destination list", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(
    ({ character, resources, world, dungeon }) => {
      const dungeonHistory = [{ id: "run-teleport", lastCharacterName: character.name, dungeon }];
      localStorage.setItem(
        "notequest:session",
        JSON.stringify({ character, resources, dungeonHistory, activeRunId: "run-teleport", world }),
      );
    },
    { character: CHARACTER, resources: RESOURCES, world: WORLD, dungeon: makeDungeon() },
  );
  await page.reload();
  await page.getByRole("button", { name: "Enter Dungeon" }).click();

  // Confirms the seeded fight resumed live before trying to flee it.
  await expect(page.getByText("Orc", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: /Flee — Teleport/ }).click();

  // The starting room -- excluded from its own destination list -- is still identified above it.
  await expect(page.getByText("Fleeing from Level 1 — Large Room (Segment 2)")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Level 1 — Small Room (Segment 1)" }),
  ).toBeVisible();
  // Never offered as a destination for itself.
  await expect(page.getByRole("button", { name: /Segment 2\)/ })).toHaveCount(0);
});
