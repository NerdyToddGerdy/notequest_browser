import type { HirelingDef } from "../../../data/types.ts";
import { HIRELING_BY_NAME } from "../../../data/hirelings.ts";
import styles from "./Hireling.module.css";

export interface HirelingProps {
  /** The currently-employed Hireling's name, or `null`. */
  hireling: string | null;
  /** The roster available at the current hex (see `hirelingsFor()`), rendered as a "Hire a
   * Hireling" list -- current-employment status is `CharacterSheet`'s own job now (issue #77);
   * the dungeon-sidebar read-only status card this component used to also render for that
   * (issue #85, once TownScreen's own call site turned out to be the only one left) is gone. */
  roster: HirelingDef[];
  /** Whether the currently-selected roster entry is affordable/hireable -- `TownScreen` computes
   * this per entry via `canHireHireling()`, since it alone has the culture/fortress context. */
  canHire: (name: string) => boolean;
  onHire: (name: string) => void;
}

/** Hirelings (Expanded World, issue #25) -- paid companions hired for one dungeon trip at a time.
 * Purely cosmetic once hired: this app doesn't model a Hireling as a real combatant (no live HP
 * tracking, no death) -- see CLAUDE.md's Hirelings note for why. */
export function Hireling({ hireling, roster, canHire, onHire }: HirelingProps) {
  const currentDef = hireling ? HIRELING_BY_NAME[hireling] : null;

  return (
    <div className={styles.panel}>
      <h3>Hire a Hireling</h3>
      {currentDef && (
        <p className={styles.currentStatus}>
          Currently hired: {currentDef.name} ({currentDef.hp} HP)
        </p>
      )}
      <ul className={styles.list}>
        {roster.map((def) => (
          <li key={def.name} className={styles.row}>
            <div className={styles.rowTop}>
              <span className={styles.name}>{def.name}</span>
              <span className={styles.hp}>{def.hp} HP</span>
              <button
                type="button"
                className={styles.hireBtn}
                disabled={!canHire(def.name)}
                onClick={() => onHire(def.name)}
              >
                Hire ({def.cost} coins)
              </button>
            </div>
            <p className={styles.equipment}>{def.equipmentText}</p>
            <p className={styles.ability}>{def.abilityText}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
