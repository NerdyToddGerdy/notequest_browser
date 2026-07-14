import styles from "./RoomEntryPrompt.module.css";

export interface RoomEntryPromptProps {
  torches: number;
  onAttack: () => void;
  onMoveSilently: () => void;
}

/**
 * Shown the moment a quiet arrival (an unlocked door, a picked lock, a fresh staircase) reveals a
 * room with monsters -- per the rulebook, opening a door quietly always lets the player choose
 * Move Silently before combat starts. "Attack First" is the free, no-risk default (same outcome
 * this app always gave before this choice existed); Move Silently spends a torch for a chance to
 * skip the fight entirely, at the risk of the monsters attacking first instead if detected.
 */
export function RoomEntryPrompt({ torches, onAttack, onMoveSilently }: RoomEntryPromptProps) {
  return (
    <div className={styles.panel}>
      <p className={styles.title}>Monsters Ahead</p>
      <p className={styles.copy}>
        You&apos;ve slipped in quietly so far. Attack now and you strike first for free, or spend 1 torch to try
        moving silently past them -- if any of them notice you, they attack first instead.
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.attackBtn} onClick={onAttack}>
          Attack First
        </button>
        <button type="button" className={styles.silentBtn} disabled={torches < 1} onClick={onMoveSilently}>
          Move Silently (1 torch)
        </button>
      </div>
    </div>
  );
}
