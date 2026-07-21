import type { HirelingDef } from "../../../data/types.ts";
import { HIRELING_BY_NAME } from "../../../data/hirelings.ts";
import styles from "./Hireling.module.css";

export interface HirelingProps {
  /** The currently-employed Hireling's name, or `null`. */
  hireling: string | null;
  /** Provided only in Town -- the roster available at the current hex (see
   * `hirelingsFor()`), rendered as a "Hire a Hireling" list. Omitted entirely in the dungeon
   * sidebar, where this renders as a small read-only status card instead. */
  roster?: HirelingDef[];
  /** Whether the currently-selected roster entry is affordable/hireable -- `TownScreen` computes
   * this per entry via `canHireHireling()`, since it alone has the culture/fortress context. */
  canHire?: (name: string) => boolean;
  onHire?: (name: string) => void;
}

/** Hirelings (Expanded World, issue #25) -- paid companions hired for one dungeon trip at a time.
 * Purely cosmetic once hired: this app doesn't model a Hireling as a real combatant (no live HP
 * tracking, no death) -- see CLAUDE.md's Hirelings note for why. */
export function Hireling({ hireling, roster, canHire, onHire }: HirelingProps) {
  const currentDef = hireling ? HIRELING_BY_NAME[hireling] : null;

  if (!roster) {
    // Dungeon sidebar: a small read-only card, only shown while someone's actually employed.
    if (!currentDef) return null;
    return (
      <div className={styles.panel}>
        <h3>Hireling</h3>
        <div className={styles.currentRow}>
          <span className={styles.name}>{currentDef.name}</span>
          <span className={styles.hp}>{currentDef.hp} HP</span>
        </div>
        <p className={styles.equipment}>{currentDef.equipmentText}</p>
        <p className={styles.ability}>{currentDef.abilityText}</p>
      </div>
    );
  }

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
                disabled={!canHire?.(def.name)}
                onClick={() => onHire?.(def.name)}
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
