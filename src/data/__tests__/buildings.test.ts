import { describe, expect, it } from "vitest";
import {
  BUILDING_ORDER,
  BUILDING_TABLE,
  buildingCost,
  buildingRequirementMet,
  buildingTaxTotal,
} from "../buildings.ts";

describe("BUILDING_TABLE completeness", () => {
  it("every entry has a name, positive cost, requirement text, and non-negative defense/tax", () => {
    for (const def of Object.values(BUILDING_TABLE)) {
      expect(def.name, def.name).toBeTruthy();
      expect(def.cost, def.name).toBeGreaterThan(0);
      expect(def.requirementText, def.name).toBeTruthy();
      expect(def.defense, def.name).toBeGreaterThan(0);
      expect(def.tax, def.name).toBeGreaterThanOrEqual(0);
    }
  });

  it("BUILDING_ORDER lists every kind exactly once", () => {
    expect(BUILDING_ORDER.length).toBe(Object.keys(BUILDING_TABLE).length);
    expect(new Set(BUILDING_ORDER).size).toBe(BUILDING_ORDER.length);
  });

  it("House/Tower have no tax, Palace/Castle/City/Fortress do", () => {
    expect(BUILDING_TABLE.House.tax).toBe(0);
    expect(BUILDING_TABLE.Tower.tax).toBe(0);
    expect(BUILDING_TABLE.Palace.tax).toBeGreaterThan(0);
    expect(BUILDING_TABLE.Castle.tax).toBeGreaterThan(0);
    expect(BUILDING_TABLE.City.tax).toBeGreaterThan(0);
    expect(BUILDING_TABLE.Fortress.tax).toBeGreaterThan(0);
  });
});

describe("buildingCost", () => {
  it("is unchanged on Plains", () => {
    expect(buildingCost("House", "plain", "Human")).toBe(BUILDING_TABLE.House.cost);
  });

  it("doubles off-Plains for a race with no exemption", () => {
    expect(buildingCost("House", "mountain", "Human")).toBe(BUILDING_TABLE.House.cost * 2);
    expect(buildingCost("Tower", "forest", "Human")).toBe(BUILDING_TABLE.Tower.cost * 2);
  });

  it("Dwarves are exempt on Mountain specifically, not other off-Plains terrain", () => {
    expect(buildingCost("House", "mountain", "Dwarf")).toBe(BUILDING_TABLE.House.cost);
    expect(buildingCost("House", "forest", "Dwarf")).toBe(BUILDING_TABLE.House.cost * 2);
  });

  it("Elves are exempt on Forest specifically, not other off-Plains terrain", () => {
    expect(buildingCost("House", "forest", "Elf")).toBe(BUILDING_TABLE.House.cost);
    expect(buildingCost("House", "mountain", "Elf")).toBe(BUILDING_TABLE.House.cost * 2);
  });
});

describe("buildingTaxTotal", () => {
  it("sums the tax of every owned building kind", () => {
    expect(buildingTaxTotal(["House", "Tower"])).toBe(0);
    expect(buildingTaxTotal(["Palace", "City"])).toBe(BUILDING_TABLE.Palace.tax + BUILDING_TABLE.City.tax);
  });

  it("is 0 for an empty list", () => {
    expect(buildingTaxTotal([])).toBe(0);
  });
});

describe("buildingRequirementMet", () => {
  it("House/Tower need nothing", () => {
    expect(buildingRequirementMet("House", [])).toBe(true);
    expect(buildingRequirementMet("Tower", [])).toBe(true);
  });

  it("Palace/Castle need Noble", () => {
    expect(buildingRequirementMet("Palace", [])).toBe(false);
    expect(buildingRequirementMet("Palace", ["Noble"])).toBe(true);
    expect(buildingRequirementMet("Castle", ["Noble"])).toBe(true);
  });

  it("City needs Lord", () => {
    expect(buildingRequirementMet("City", ["Noble"])).toBe(false);
    expect(buildingRequirementMet("City", ["Lord"])).toBe(true);
  });

  it("Fortress needs King", () => {
    expect(buildingRequirementMet("Fortress", ["Lord"])).toBe(false);
    expect(buildingRequirementMet("Fortress", ["King"])).toBe(true);
  });
});
