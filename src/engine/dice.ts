import type { RNG } from "./rng.ts";

export function rollDie(rng: RNG = Math.random): number {
  return 1 + Math.floor(rng() * 6);
}

export function roll2d6(rng: RNG = Math.random): [number, number] {
  return [rollDie(rng), rollDie(rng)];
}
