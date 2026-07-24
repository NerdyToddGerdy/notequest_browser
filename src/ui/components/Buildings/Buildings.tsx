import { BUILDING_TABLE } from "../../../data/buildings.ts";
import type { OwnedBuilding } from "../../../engine/dungeonState.ts";
import styles from "./Buildings.module.css";

export interface BuildingsProps {
  buildings: OwnedBuilding[];
}

/** Buildings (Expanded World, issue #27) -- a read-only "My Buildings" card, same shape/precedent
 * as `Animals`'s own "My Animals" list. Only ever rendered when non-empty (see `TownScreen.tsx`) --
 * building itself happens via `HexInspector`, on an empty hex, never from here. */
export function Buildings({ buildings }: BuildingsProps) {
  return (
    <div className={styles.panel}>
      <h3>My Buildings</h3>
      <ul className={styles.list}>
        {buildings.map((owned, i) => {
          const def = BUILDING_TABLE[owned.kind];
          return (
            <li key={i} className={styles.row}>
              <span className={styles.name}>
                {def.name} ({owned.hexKey})
              </span>
              <span className={styles.hp}>{def.tax > 0 ? `${def.tax} coins/Boss` : "No tax"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
