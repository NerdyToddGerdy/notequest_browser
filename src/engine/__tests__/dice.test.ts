import { describe, expect, it } from "vitest";
import { rollDie, roll2d6 } from "../dice.ts";
import { fixedDie, mulberry32, sequenceDie } from "../../test/mulberry32.ts";

describe("rollDie", () => {
  it("stays within 1-6 across many seeded draws", () => {
    const rng = mulberry32(12345);
    for (let i = 0; i < 1000; i++) {
      const v = rollDie(rng);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("hits every face 1-6 over enough seeded draws", () => {
    const rng = mulberry32(42);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(rollDie(rng));
    expect(seen).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  it("respects a fixed RNG for deterministic tests", () => {
    expect(rollDie(fixedDie(1))).toBe(1);
    expect(rollDie(fixedDie(6))).toBe(6);
  });
});

describe("roll2d6", () => {
  it("rolls two independent dice in sequence", () => {
    const rng = sequenceDie([3, 5]);
    expect(roll2d6(rng)).toEqual([3, 5]);
  });

  it("sums land in the valid 2-12 range", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      const [a, b] = roll2d6(rng);
      expect(a + b).toBeGreaterThanOrEqual(2);
      expect(a + b).toBeLessThanOrEqual(12);
    }
  });
});
