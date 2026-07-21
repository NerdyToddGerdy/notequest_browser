import { ANIMAL_BY_NAME } from "../../../data/animals.ts";
import type { AnimalDef } from "../../../data/types.ts";
import { canBuyMount } from "../../../engine/animals.ts";
import type { AdventurerResources } from "../../../engine/town.ts";
import styles from "./Animals.module.css";

export interface AnimalsProps {
  /** Owned animal/mount names -- up to `MAX_ANIMALS`, at most one of which is ever a Mount. */
  animals: string[];
  /** Provided only in Town -- every Mount buyable at this specific hex right now (see
   * `qualifiesForBuyingMount()`). Omitted entirely in the dungeon sidebar, which only ever shows
   * the read-only "My Animals" list. */
  buyableMounts?: AnimalDef[];
  resources?: AdventurerResources;
  onBuyMount?: (name: string) => void;
}

/** Animals (Expanded World, issue #26) -- trained/bought companions. Purely cosmetic once
 * acquired: this app doesn't model an animal as a real combatant (no live HP tracking, no death)
 * -- see CLAUDE.md's Animals note for why. */
export function Animals({ animals, buyableMounts, resources, onBuyMount }: AnimalsProps) {
  return (
    <div className={styles.panel}>
      <h3>My Animals</h3>
      {animals.length === 0 ? (
        <p className={styles.empty}>No animals trained yet.</p>
      ) : (
        <ul className={styles.list}>
          {animals.map((name, i) => {
            const def = ANIMAL_BY_NAME[name];
            if (!def) return null;
            return (
              <li key={i} className={styles.row}>
                <span className={styles.name}>
                  {def.name}
                  {def.isMount ? " (Mount)" : ""}
                </span>
                <span className={styles.hp}>{def.hp} HP</span>
              </li>
            );
          })}
        </ul>
      )}
      {buyableMounts && buyableMounts.length > 0 && (
        <>
          <p className={styles.subheading}>Buy a Mount</p>
          <ul className={styles.list}>
            {buyableMounts.map((mount) => (
              <li key={mount.name} className={styles.row}>
                <span className={styles.name}>{mount.name}</span>
                <button
                  type="button"
                  className={styles.buyBtn}
                  disabled={!resources || !canBuyMount(resources, mount)}
                  onClick={() => onBuyMount?.(mount.name)}
                >
                  Buy ({mount.mountCost} coins)
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
