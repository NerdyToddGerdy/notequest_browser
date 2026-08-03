import { describe, expect, it } from "vitest";

import { fixedDie } from "../../test/mulberry32.ts";
import { dungeonReducer } from "../dungeonReducer.ts";
import { createInitialDungeonState, type DungeonState } from "../dungeonState.ts";
import {
  benchUnusableWeapon,
  canWieldWeapon,
  DWARF_LAMP_NAME,
  handsFree,
  TORCHBEARER_NAME,
  twoHandedBlockReason,
} from "../hands.ts";

/**
 * "Your Hands" (issue #100) -- the hand economy that turns `WeaponEntry.twoHanded`, the Dwarf Lamp,
 * the Torchbearer Hireling and Blade Trap's roll-of-2 from tracked-but-inert into real rules.
 */

const HALBERD = { name: "Halberd", formula: "1d6+3", twoHanded: true };
const SWORD = { name: "Sword", formula: "1d6" };

function bearer(overrides: Partial<Parameters<typeof handsFree>[0]> = {}) {
  return {
    heldItems: [],
    hireling: null,
    weapon: null,
    spareWeapons: [],
    ...overrides,
  };
}

describe("handsFree", () => {
  it("is false by default -- one hand holds the torch", () => {
    expect(handsFree(bearer())).toBe(false);
  });

  it("is true with a Dwarven Lamp in the pack", () => {
    expect(handsFree(bearer({ heldItems: [{ name: DWARF_LAMP_NAME, worth: 5 }] }))).toBe(true);
  });

  it("is true while a Torchbearer is employed", () => {
    expect(handsFree(bearer({ hireling: TORCHBEARER_NAME }))).toBe(true);
  });

  it("is false for a Hireling who isn't the Torchbearer", () => {
    expect(handsFree(bearer({ hireling: "Mercenary" }))).toBe(false);
  });

  it("is true while a Light globe is lit", () => {
    expect(handsFree(bearer({ lightActive: true }))).toBe(true);
  });

  it("is false with a lost arm even holding a Lamp -- no light source gives an arm back", () => {
    const armless = bearer({
      armLost: true,
      heldItems: [{ name: DWARF_LAMP_NAME, worth: 5 }],
      hireling: TORCHBEARER_NAME,
      lightActive: true,
    });
    expect(handsFree(armless)).toBe(false);
    // And the reason names the arm rather than the torch, since that's the binding constraint.
    expect(twoHandedBlockReason(armless)).toContain("one arm");
  });
});

describe("canWieldWeapon", () => {
  it("never blocks a one-handed weapon, whatever the hands are doing", () => {
    expect(canWieldWeapon(bearer(), SWORD)).toBe(true);
    expect(canWieldWeapon(bearer({ armLost: true }), SWORD)).toBe(true);
  });

  it("blocks a two-handed weapon only when hands aren't free", () => {
    expect(canWieldWeapon(bearer(), HALBERD)).toBe(false);
    expect(canWieldWeapon(bearer({ lightActive: true }), HALBERD)).toBe(true);
  });
});

describe("benchUnusableWeapon", () => {
  it("moves an unusable two-hander into spareWeapons and names it", () => {
    const draft = bearer({ weapon: HALBERD });
    expect(benchUnusableWeapon(draft)).toBe("Halberd");
    expect(draft.weapon).toBeNull();
    expect(draft.spareWeapons).toEqual([HALBERD]);
  });

  it("leaves a usable weapon alone and reports nothing benched", () => {
    const lit = bearer({ weapon: HALBERD, lightActive: true });
    expect(benchUnusableWeapon(lit)).toBeNull();
    expect(lit.weapon).toEqual(HALBERD);

    const oneHanded = bearer({ weapon: SWORD });
    expect(benchUnusableWeapon(oneHanded)).toBeNull();
    expect(oneHanded.weapon).toEqual(SWORD);
  });
});

describe("WIELD_WEAPON enforcement", () => {
  function stateWith(overrides: Partial<DungeonState> = {}): DungeonState {
    return { ...createInitialDungeonState(), spareWeapons: [HALBERD], ...overrides };
  }

  it("refuses a two-hander with no light source, and says why", () => {
    const next = dungeonReducer(stateWith(), { type: "WIELD_WEAPON", index: 0 });

    expect(next.weapon).toBeNull();
    expect(next.spareWeapons).toEqual([HALBERD]); // still there to pick up later
    expect(next.log[0]?.message).toContain("Lamp");
  });

  it("allows it once a Torchbearer is holding the torch", () => {
    const next = dungeonReducer(stateWith({ hireling: TORCHBEARER_NAME }), {
      type: "WIELD_WEAPON",
      index: 0,
    });

    expect(next.weapon).toEqual(HALBERD);
    expect(next.spareWeapons).toEqual([]);
  });
});

describe("the Light globe is worth a torch, and goes out like one", () => {
  it("frees the hands when cast, then benches the two-hander on the next torch spent", () => {
    // Light is basic:2. Cast it, then spend a torch and watch the globe -- and the Halberd -- go.
    const lit = dungeonReducer(
      {
        ...createInitialDungeonState(4, 20, "1d6", { "basic:2": 1 }),
        spareWeapons: [HALBERD],
      },
      { type: "CAST_SPELL", table: "basic", spellRoll: 2 },
    );
    expect(lit.lightActive).toBe(true);

    const wielded = dungeonReducer(lit, { type: "WIELD_WEAPON", index: 0 });
    expect(wielded.weapon).toEqual(HALBERD);

    // Any torch spend uses the globe up. Rolling for the dungeon charges the entry torch.
    const spent = dungeonReducer(
      wielded,
      { type: "ROLL_DUNGEON", typeRoll: 1, nameRolls: [3, 3, 3] },
      fixedDie(1),
    );
    expect(spent.lightActive).toBe(false);
    expect(spent.weapon).toBeNull();
    expect(spent.spareWeapons).toEqual([HALBERD]);
  });
});

describe("a fresh dungeon entry benches what Town let you equip", () => {
  it("stows a two-hander carried in with no light source", () => {
    const state = createInitialDungeonState(
      5,
      20,
      "1d6",
      {},
      "Ari",
      0,
      0,
      0,
      [],
      20,
      [],
      HALBERD, // equipped in Town, where wielding is unrestricted
    );

    expect(state.weapon).toBeNull();
    expect(state.spareWeapons).toEqual([HALBERD]);
    expect(state.log[0]?.message).toContain("goes into your pack");
  });

  it("keeps it equipped when a Lamp came along", () => {
    const state = createInitialDungeonState(
      5,
      20,
      "1d6",
      {},
      "Ari",
      0,
      0,
      0,
      [{ name: DWARF_LAMP_NAME, worth: 5 }],
      20,
      [],
      HALBERD,
    );

    expect(state.weapon).toEqual(HALBERD);
    expect(state.spareWeapons).toEqual([]);
  });
});

// The Blade Trap's roll-of-2 arm loss is tested in `dungeonReducer.test.ts`, where the
// segment/door/level fixtures needed to actually fire a trap already live.
