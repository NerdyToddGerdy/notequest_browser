import type { HexTile } from "../../../engine/hexState.ts";
import type { PortalRoll } from "../../../engine/portals.ts";
import { DicePool } from "../DicePool/DicePool.tsx";
import styles from "./PortalPanel.module.css";

/** Portals (issue #21) -- what the player sees after stepping through a portal hex. Unlike
 * `EventPanel` there is no *choice* stage: "when going through a portal there is no turning back,"
 * so the roll is made and applied the moment the player confirms, and this panel reports it. The one
 * exception is rolls 11/14 ("you go to whatever hexagon you want" / the Slimemen's parting gift),
 * which need a destination before anything can move -- hence `destinations`.
 *
 * The destination picker is a list rather than a click-on-the-map interaction because this panel
 * covers the map while it's open, and a portal can legally send you *anywhere* known, not just
 * somewhere adjacent -- so there's no natural map affordance to reuse (unlike ordinary travel).
 */
export interface PortalPanelProps {
  roll: PortalRoll;
  /** False while the roll has been revealed but not yet applied -- the player acknowledges with "Step
   * Through" before anything happens. Not a choice (the dice have already fallen and the confirmation
   * came earlier), but it keeps the reveal readable and keeps application in an event handler. */
  applied: boolean;
  /** Set once the outcome has been applied -- the panel's terminal state. */
  resolvedMessage: string | null;
  /** Non-empty only while rolls 11/14 await a choice. */
  destinations: { coord: { q: number; r: number }; tile: HexTile; distance: number; label: string }[];
  onStepThrough: () => void;
  onChooseDestination: (coord: { q: number; r: number }) => void;
  onDismiss: () => void;
}

export function PortalPanel({
  roll,
  applied,
  resolvedMessage,
  destinations,
  onStepThrough,
  onChooseDestination,
  onDismiss,
}: PortalPanelProps) {
  const awaitingChoice = destinations.length > 0;
  // An established portal has no dice to show (`establishedPortal` returns zeroes) -- it's known
  // geography by then, so the roll isn't re-dramatized.
  const showDice = roll.dice.every((d) => d > 0);

  return (
    <div className={styles.panel}>
      <p className={styles.eyebrow}>The Portal</p>

      {showDice && (
        <div className={styles.diceRow}>
          <DicePool values={roll.dice} rollToken={roll.total} size={30} />
        </div>
      )}

      {roll.skippedWorlds.length > 0 && (
        <p className={styles.aside}>
          The portal pulls toward {joinWorlds(roll.skippedWorlds)} — but those doors are sealed, and it
          searches again.
        </p>
      )}

      <p className={styles.flavor}>{roll.row.text}</p>

      {resolvedMessage && <p className={styles.result}>{resolvedMessage}</p>}

      {awaitingChoice ? (
        <>
          <p className={styles.label}>Choose where it opens</p>
          <ul className={styles.destList}>
            {destinations.map(({ coord, label, distance }) => (
              <li key={`${coord.q},${coord.r}`}>
                <button type="button" className={styles.destBtn} onClick={() => onChooseDestination(coord)}>
                  <span className={styles.destName}>{label}</span>
                  <span className={styles.destMeta}>{distance} away</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : applied ? (
        <button type="button" className={styles.primaryBtn} onClick={onDismiss}>
          Continue
        </button>
      ) : (
        <button type="button" className={styles.primaryBtn} onClick={onStepThrough}>
          Step Through
        </button>
      )}
    </div>
  );
}

/** "Hell", "Hell and Pesadelum", "Hell, Pesadelum, and Candy World" -- deduplicated, since the same
 * world can be rolled past more than once. */
function joinWorlds(worlds: string[]): string {
  const unique = [...new Set(worlds)];
  if (unique.length === 1) return unique[0]!;
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique.slice(0, -1).join(", ")}, and ${unique[unique.length - 1]}`;
}
