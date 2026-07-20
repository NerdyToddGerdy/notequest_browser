import { ADVANCED_CLASS_TABLE } from "../../../data/advancedClasses.ts";
import type { CreatedCharacter } from "../../../data/types.ts";
import {
  canAcquireAdvancedClass,
  isAdvancedClassTrackable,
  meetsAdvancedClassRequirement,
  type AdvancedClassContext,
} from "../../../engine/advancedClasses.ts";
import type { GraveyardEntry } from "../../../engine/graveyard.ts";
import type { AdventurerResources } from "../../../engine/town.ts";
import styles from "./AdvancedClasses.module.css";

export interface AdvancedClassesProps {
  character: CreatedCharacter;
  resources: AdventurerResources;
  /** World-scoped, same as everywhere else the Graveyard is read -- see Gravedigger's requirement. */
  graveyard: GraveyardEntry[];
  onAcquire: (name: string) => void;
}

/** Advanced Classes (Expanded World, issue #23) -- every rulebook entry is listed for flavor and
 * completeness, always visible and `disabled` (not omitted) with an explanatory reason when it
 * can't be acquired right now, matching the established always-visible-but-disabled precedent
 * (`Ask`, spell "Cast" buttons). Sorted by cost, ascending, for a natural sense of progression. */
export function AdvancedClasses({ character, resources, graveyard, onAcquire }: AdvancedClassesProps) {
  const ctx: AdvancedClassContext = { character, resources, graveyard };
  const entries = Object.values(ADVANCED_CLASS_TABLE).sort((a, b) => a.cost - b.cost);

  return (
    <div className={styles.panel}>
      <h3>Advanced Classes</h3>
      <ul className={styles.list}>
        {entries.map((def) => {
          const owned = resources.advancedClasses.includes(def.name);
          const trackable = isAdvancedClassTrackable(def.name);
          const meetsRequirement = trackable && meetsAdvancedClassRequirement(def.name, ctx);
          const canAcquire = canAcquireAdvancedClass(ctx, def.name);
          const reason = owned
            ? "Already acquired."
            : !trackable
              ? "Requirement not yet trackable in this version."
              : !meetsRequirement
                ? "Requirement not met."
                : resources.coins < def.cost
                  ? "Not enough coins."
                  : null;
          return (
            <li key={def.name} className={styles.row}>
              <div className={styles.rowTop}>
                <span className={styles.name}>{def.name}</span>
                <span className={styles.hpBonus}>
                  {def.hpBonus > 0 ? `+${def.hpBonus} HP` : ""}
                </span>
                <button
                  type="button"
                  className={styles.acquireBtn}
                  disabled={!canAcquire}
                  onClick={() => onAcquire(def.name)}
                >
                  Acquire ({def.cost} coins)
                </button>
              </div>
              <p className={styles.requirement}>{def.requirementText}</p>
              <p className={styles.ability}>{def.abilityText}</p>
              {reason && <p className={styles.reason}>{reason}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
