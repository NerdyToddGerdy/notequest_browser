export const DIE_STAGGER_MS = 90;
export const DIE_TOSS_MS = 850;
export const REVEAL_BUFFER_MS = 150;

/** How long to wait before revealing a roll's result, given how many dice were staggered. */
export function revealDelay(diceCount: number): number {
  return Math.max(0, diceCount - 1) * DIE_STAGGER_MS + DIE_TOSS_MS + REVEAL_BUFFER_MS;
}
