import { chromium } from "@playwright/test";
const SHOTS =
  "/private/tmp/claude-501/-Users-toddgerdy-Development-notequest-browser/e826f681-1e8d-40e0-876a-b22413013556/scratchpad";
const CH = {
  name: "Plumber",
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
const RES = {
  torches: 10,
  hp: 900,
  maxHp: 900,
  coins: 0,
  treasures: 0,
  keys: 99,
  heldItems: [],
  armor: [],
  weapon: { name: "Sword", formula: "1d6+20" },
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
  animals: [],
  milestones: {
    hasCastSpell: false,
    hasCastColdRay: false,
    hasSoldItem: false,
    hasHadArmorDestroyed: false,
    hasFoughtInArena: false,
    locksOpened: 0,
    talkedToKing: false,
    vassalCount: 0,
    clearedASewer: false,
  },
  buildings: [],
  troops: 0,
  troopSources: [],
  travelStats: {
    forestsCrossed: 0,
    desertsCrossed: 0,
    territoriesSailed: 0,
    citiesVisited: [],
    provisionsSpentTotal: 0,
  },
  survivedRunIds: [],
  flyActive: false,
  catatonic: false,
  nextDungeonDamageBonus: 0,
};
const W = {
  climate: "hot",
  home: { q: 0, r: 0 },
  player: { q: 0, r: 0 },
  tiles: {
    "0,0": { terrain: "mountain", location: "ruins" },
    "0,1": { terrain: "plain", location: null },
  },
};
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1280, height: 1200 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
await page.goto("http://localhost:5173/");
const seg = new Set();
let done = false;
for (let run = 0; run < 40 && !done; run++) {
  await page.evaluate(
    ([c, r, w]) =>
      localStorage.setItem(
        "notequest:session",
        JSON.stringify({
          character: c,
          resources: r,
          dungeonHistory: [],
          activeRunId: null,
          world: w,
        }),
      ),
    [CH, RES, W],
  );
  await page.reload();
  await page.waitForSelector("text=Click a neighboring hex");
  await page.getByRole("button", { name: "Enter Dungeon" }).click();
  await page.waitForTimeout(180);
  await page.getByRole("button", { name: "Roll for Dungeon" }).click();
  await page.waitForTimeout(2100);
  if (!/The Sewers/.test(await page.textContent("body"))) continue;
  for (let i = 0; i < 45; i++) {
    for (let k = 0; k < 30; k++) {
      const a = page.locator("button", { hasText: /^Attack$/ });
      if (!(await a.count())) break;
      await a
        .first()
        .click()
        .catch(() => {});
      await page.waitForTimeout(320);
    }
    const f = page.getByRole("button", { name: "Attack First" });
    if (await f.count()) {
      await f.click().catch(() => {});
      await page.waitForTimeout(320);
    }
    const bd = await page.textContent("body");
    const m = bd.match(/Segment \d+ · ([A-Za-z][A-Za-z ]*?)(?=Recent Rolls)/);
    if (m) seg.add(m[1].trim());
    const climb = page.getByRole("button", { name: "Climb Out" });
    if (await climb.count()) {
      console.log("LADDER buttons:", await climb.count(), "(expect 1)");
      await page.screenshot({ path: `${SHOTS}/sw-3-ladder.png` });
      await climb.first().click();
      await page.waitForTimeout(900);
      const af = await page.textContent("body");
      console.log("victory:", (af.match(/Out, and Breathing Air/) ?? ["MISSING"])[0]);
      console.log("log   :", (af.match(/You climb the ladder[^.]*\./) ?? ["(none)"])[0]);
      console.log("copy  :", (af.match(/shoulders the manhole aside[^.]*\./) ?? ["(none)"])[0]);
      await page.screenshot({ path: `${SHOTS}/sw-4-out.png` });
      done = true;
      break;
    }
    const doors = page.locator('[class*="doorBtn"]');
    const n = await doors.count();
    if (!n) break;
    await doors
      .nth((i * 3 + 1) % n)
      .click({ force: true })
      .catch(() => {});
    await page.waitForTimeout(720);
    const lock = page.locator('[class*="lockChoice"]');
    if (await lock.count()) {
      await lock
        .getByRole("button", { name: /Use a Key/ })
        .first()
        .click()
        .catch(() => {});
      await page.waitForTimeout(740);
    }
  }
}
console.log("segment types visited:", [...seg]);
console.log("reached the ladder:", done);
await b.close();
