import { countUnlootedRemains, isDungeonBeaten, type PendingDungeon } from "../../../engine/dungeonState.ts";
import styles from "./DungeonsList.module.css";

export interface DungeonsListProps {
  /** Every dungeon any character has touched, unbeaten or beaten -- App.tsx's own dungeonHistory,
   * unfiltered, mirroring Graveyard's "every adventurer" scope. */
  dungeons: PendingDungeon[];
  /** True when rendered in Town Square's narrow Records column -- see Graveyard's own `compact`
   * doc comment, the same reasoning applies here. */
  compact?: boolean;
}

/** A running record of every dungeon that's ever been found, styled like the Graveyard's own panel
 * (see `RecordsPanel`, which switches between the two). */
export function DungeonsList({ dungeons, compact = false }: DungeonsListProps) {
  if (dungeons.length === 0) return null;

  return (
    <section className={compact ? styles.panelCompact : styles.panel}>
      <h2 className={compact ? styles.titleCompact : styles.title}>Dungeons</h2>
      <p className={styles.note}>
        {dungeons.length} dungeon{dungeons.length === 1 ? "" : "s"} found across these lands.
      </p>
      <ul className={compact ? `${styles.list} ${styles.listCompact}` : styles.list}>
        {[...dungeons].reverse().map((pd) => {
          const beaten = isDungeonBeaten(pd.dungeon);
          const remains = countUnlootedRemains(pd.dungeon);
          return (
            <li key={pd.id} className={compact ? `${styles.row} ${styles.rowCompact}` : styles.row}>
              <span className={styles.nameCol}>
                <span className={styles.name}>{pd.dungeon.dungeonName ?? "An unnamed dungeon"}</span>
                <span className={styles.subtitle}>Last explored by {pd.lastCharacterName}</span>
              </span>
              <span className={beaten ? styles.statusCleared : styles.statusUnfinished}>
                {beaten ? "Cleared" : "Unfinished"}
              </span>
              {remains > 0 && (
                <span className={styles.remains}>
                  {remains} unrecovered bod{remains === 1 ? "y" : "ies"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
