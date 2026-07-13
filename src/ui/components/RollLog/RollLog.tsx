import type { LogEntryState } from "../../../engine/dungeonState.ts";
import styles from "./RollLog.module.css";

export interface RollLogProps {
  entries: LogEntryState[];
}

export function RollLog({ entries }: RollLogProps) {
  return (
    <div className={styles.log}>
      <h3>Recent Rolls</h3>
      {entries.length === 0 ? (
        <p className={styles.empty}>Nothing rolled yet.</p>
      ) : (
        <ul>
          {entries.map((entry) => (
            <li key={entry.id} className={entry.variant === "descend" ? styles.descend : undefined}>
              {entry.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
