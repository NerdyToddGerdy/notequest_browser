import type { RNG } from "../engine/rng.ts";

/** Small deterministic PRNG so engine tests can assert exact outcomes instead of just ranges. */
export function mulberry32(seed: number): RNG {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An RNG that always returns a value that makes rollDie() produce `value` (1-6). */
export function fixedDie(value: number): RNG {
  if (value < 1 || value > 6) throw new Error(`fixedDie value out of range: ${value}`);
  // rollDie does 1 + floor(rng() * 6); pick the midpoint of the bucket for `value`.
  return () => (value - 1 + 0.5) / 6;
}

/** An RNG that yields a fixed sequence of rollDie() results, one call per die roll. */
export function sequenceDie(values: number[]): RNG {
  let i = 0;
  return () => {
    const v = values[i % values.length]!;
    i += 1;
    return (v - 1 + 0.5) / 6;
  };
}
