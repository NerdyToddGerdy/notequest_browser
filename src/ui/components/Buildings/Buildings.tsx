import { BUILDING_TABLE } from "../../../data/buildings.ts";
import type { OwnedBuilding } from "../../../engine/dungeonState.ts";
import styles from "./Buildings.module.css";

export interface BuildingsProps {
  buildings: OwnedBuilding[];
  /** Buildings' storage (issue #102) -- how many items sit in each building, keyed by hex. Read-only
   * here: depositing and withdrawing need you to be *standing* on the building, so they live in
   * `HexInspector`. This is the "what did I leave where" view, which is exactly what you want from
   * a city on the other side of the map. Optional so the card still works without it. */
  storedCounts?: Record<string, number>;
}

/** Buildings (Expanded World, issue #27) -- a read-only "My Buildings" card, same shape/precedent
 * as `Animals`'s own "My Animals" list. Only ever rendered when non-empty (see `TownScreen.tsx`) --
 * building itself happens via `HexInspector`, on an empty hex, never from here. */
export function Buildings({ buildings, storedCounts = {} }: BuildingsProps) {
  return (
    <div className={styles.panel}>
      <h3>My Buildings</h3>
      <ul className={styles.list}>
        {buildings.map((owned, i) => {
          const def = BUILDING_TABLE[owned.kind];
          const stored = storedCounts[owned.hexKey] ?? 0;
          return (
            <li key={i} className={styles.row}>
              <span className={styles.name}>
                {def.name} ({owned.hexKey})
                {stored > 0 && ` — ${stored} item${stored === 1 ? "" : "s"} stored`}
              </span>
              <span className={styles.hp}>{def.tax > 0 ? `${def.tax} coins/Boss` : "No tax"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
