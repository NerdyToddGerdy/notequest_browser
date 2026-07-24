import { describe, expect, it } from "vitest";
import { TROOP_COST, stormingLootPayout } from "../warfare.ts";

describe("stormingLootPayout", () => {
  it("is 600 for a City, 1000 for a Fortress", () => {
    expect(stormingLootPayout(false)).toBe(600);
    expect(stormingLootPayout(true)).toBe(1000);
  });
});

describe("TROOP_COST", () => {
  it("is 200 coins", () => {
    expect(TROOP_COST).toBe(200);
  });
});
