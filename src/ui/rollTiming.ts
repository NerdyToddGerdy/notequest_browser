export const DIE_STAGGER_MS = 90;
export const DIE_TOSS_MS = 850;
export const REVEAL_BUFFER_MS = 150;
/** How long to hold Heal's post-heal HP bump on screen before dispatching the cast (which also
 * resolves the same round's monster counter-attack) -- long enough to read as its own beat, short
 * enough not to feel like a delay. No die is rolled for Heal, so this doesn't use revealDelay(). */
export const HEAL_PREVIEW_MS = 650;

/** How long to wait before revealing a roll's result, given how many dice were staggered. */
export function revealDelay(diceCount: number): number {
  return Math.max(0, diceCount - 1) * DIE_STAGGER_MS + DIE_TOSS_MS + REVEAL_BUFFER_MS;
}
