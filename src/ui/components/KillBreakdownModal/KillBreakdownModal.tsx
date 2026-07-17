import styles from "./KillBreakdownModal.module.css";

export interface KillBreakdownModalProps {
  /** Keyed by the defeated monster's own lowercased `name` -- see DungeonState.killsByName. */
  killsByName: Record<string, number>;
  onClose: () => void;
}

function capitalize(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Dismiss-only, no confirm/cancel choice -- a new, simpler component than `ConfirmDialog`, though
 * it borrows that one's backdrop/overlay visual language as a starting point rather than designing
 * one from scratch (the first informational, as opposed to confirm/cancel, modal in this codebase). */
export function KillBreakdownModal({ killsByName, onClose }: KillBreakdownModalProps) {
  const entries = Object.entries(killsByName).sort(([, a], [, b]) => b - a);

  return (
    <div
      className={styles.backdrop}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="killBreakdownTitle">
        <p id="killBreakdownTitle" className={styles.title}>
          Kills
        </p>
        {entries.length === 0 ? (
          <p className={styles.empty}>No monsters defeated yet.</p>
        ) : (
          <ul className={styles.list}>
            {entries.map(([name, count]) => (
              <li key={name} className={styles.row}>
                <span className={styles.name}>{capitalize(name)}</span>
                <span className={styles.count}>{count}</span>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
