import styles from "./TallyModal.module.css";

export interface TallyModalProps {
  /** Shown as the dialog's heading, e.g. "Kills" or "Curiosities". */
  title: string;
  /** A `Record<name, count>` tally -- `killsByName`, `curiosities`, or any later one of the same shape. */
  tally: Record<string, number>;
  /** Shown in place of the list when the tally is empty. */
  emptyText: string;
  onClose: () => void;
}

function capitalize(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Dismiss-only, no confirm/cancel choice -- a simpler component than `ConfirmDialog`, though it
 * borrows that one's backdrop/overlay visual language rather than designing one from scratch (the
 * first informational, as opposed to confirm/cancel, modal in this codebase).
 *
 * Generalized from the Kills-only `KillBreakdownModal` when Curiosities (issues #109/#115) needed the
 * identical thing: a `Record<name, count>` listed highest-first behind a `CharacterSheet` stat. */
export function TallyModal({ title, tally, emptyText, onClose }: TallyModalProps) {
  const entries = Object.entries(tally).sort(([, a], [, b]) => b - a);

  return (
    <div
      className={styles.backdrop}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tallyModalTitle"
      >
        <p id="tallyModalTitle" className={styles.title}>
          {title}
        </p>
        {entries.length === 0 ? (
          <p className={styles.empty}>{emptyText}</p>
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
