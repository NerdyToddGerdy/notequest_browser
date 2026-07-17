import type { GraveyardEntry } from "../../../engine/graveyard.ts";
import styles from "./Graveyard.module.css";

export interface GraveyardProps {
  entries: GraveyardEntry[];
  /** True when rendered in Town Square's narrow Records column -- drops the standalone panel's
   * own border/shadow/padding (the column itself already supplies a frame) and forces the same
   * single-column row layout the panel would otherwise only reach for under a narrow *viewport*,
   * since a column can be narrow on a wide screen the `@media` query below never sees. */
  compact?: boolean;
}

const CAUSE_LABELS: Record<GraveyardEntry["causeOfDeath"], string> = {
  darkness: "Lost to the Darkness",
  combat: "Slain in Combat",
};

/** The Graveyard play-sheet -- a running record of every character who died exploring these dungeons. */
export function Graveyard({ entries, compact = false }: GraveyardProps) {
  if (entries.length === 0) return null;

  return (
    <section className={compact ? styles.panelCompact : styles.panel}>
      <h2 className={compact ? styles.titleCompact : styles.title}>The Graveyard</h2>
      <p className={styles.note}>
        {entries.length} adventurer{entries.length === 1 ? "" : "s"} lost to these dungeons.
      </p>
      <ul className={styles.list}>
        {[...entries].reverse().map((entry, index) => (
          <li key={index} className={compact ? `${styles.row} ${styles.rowCompact}` : styles.row}>
            <span className={styles.nameCol}>
              <span className={styles.name}>{entry.name}</span>
              {entry.race && entry.cls && (
                <span className={styles.subtitle}>
                  The {entry.race} {entry.cls}
                </span>
              )}
            </span>
            <span className={styles.dungeon}>{entry.dungeon}</span>
            {(entry.monsterKills !== undefined || entry.bossKills !== undefined) && (
              <span className={styles.kills}>
                {entry.monsterKills ?? 0} killed
                {entry.bossKills ? ` · ${entry.bossKills} Boss${entry.bossKills === 1 ? "" : "es"}` : ""}
              </span>
            )}
            <span className={styles.cause}>{CAUSE_LABELS[entry.causeOfDeath]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
