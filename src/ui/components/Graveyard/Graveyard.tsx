import type { GraveyardEntry } from "../../../engine/graveyard.ts";
import styles from "./Graveyard.module.css";

export interface GraveyardProps {
  entries: GraveyardEntry[];
}

const CAUSE_LABELS: Record<GraveyardEntry["causeOfDeath"], string> = {
  darkness: "Lost to the Darkness",
  combat: "Slain in Combat",
};

/** The Graveyard play-sheet -- a running record of every character who died exploring these dungeons. */
export function Graveyard({ entries }: GraveyardProps) {
  if (entries.length === 0) return null;

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>The Graveyard</h2>
      <p className={styles.note}>
        {entries.length} adventurer{entries.length === 1 ? "" : "s"} lost to these dungeons.
      </p>
      <ul className={styles.list}>
        {[...entries].reverse().map((entry, index) => (
          <li key={index} className={styles.row}>
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
