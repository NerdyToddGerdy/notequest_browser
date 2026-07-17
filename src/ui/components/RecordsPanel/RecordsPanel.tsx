import { useState } from "react";
import type { GraveyardEntry } from "../../../engine/graveyard.ts";
import type { PendingDungeon } from "../../../engine/dungeonState.ts";
import { Graveyard } from "../Graveyard/Graveyard.tsx";
import { DungeonsList } from "../DungeonsList/DungeonsList.tsx";
import styles from "./RecordsPanel.module.css";

export interface RecordsPanelProps {
  graveyardEntries: GraveyardEntry[];
  dungeons: PendingDungeon[];
}

/** Both the Graveyard and the Dungeons list are "running record" panels that render in the same
 * spot (`CharacterCreationScreen`, `TownScreen`) and would otherwise compete for the same space --
 * a tab switcher between them, shown only once there's actually something in both to switch
 * between. With just one populated, that one renders directly, matching the Graveyard's own
 * previous (tab-less) behavior exactly. */
export function RecordsPanel({ graveyardEntries, dungeons }: RecordsPanelProps) {
  const hasGraveyard = graveyardEntries.length > 0;
  const hasDungeons = dungeons.length > 0;
  const [activeTab, setActiveTab] = useState<"graveyard" | "dungeons">(hasGraveyard ? "graveyard" : "dungeons");

  if (!hasGraveyard && !hasDungeons) return null;

  return (
    <div className={styles.wrap}>
      {hasGraveyard && hasDungeons && (
        <div className={styles.tabs}>
          <button
            type="button"
            className={activeTab === "graveyard" ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab("graveyard")}
          >
            Graveyard
          </button>
          <button
            type="button"
            className={activeTab === "dungeons" ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab("dungeons")}
          >
            Dungeons
          </button>
        </div>
      )}
      {activeTab === "graveyard" ? (
        <Graveyard entries={graveyardEntries} />
      ) : (
        <DungeonsList dungeons={dungeons} />
      )}
    </div>
  );
}
