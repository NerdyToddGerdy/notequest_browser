import type { AnimalDef } from "../../../data/types.ts";
import { canBuyMount } from "../../../engine/animals.ts";
import type { AdventurerResources } from "../../../engine/town.ts";
import styles from "./Animals.module.css";

export interface AnimalsProps {
  /** Every Mount buyable at this specific hex right now (see `qualifiesForBuyingMount()`). */
  buyableMounts: AnimalDef[];
  resources: AdventurerResources;
  onBuyMount: (name: string) => void;
}

/** Animals (Expanded World, issue #26) -- trained/bought companions. Purely cosmetic once
 * acquired: this app doesn't model an animal as a real combatant (no live HP tracking, no death)
 * -- see CLAUDE.md's Animals note for why. Current ownership is `CharacterSheet`'s own status
 * line now (issue #77), not this component's job anymore (issue #85, which dropped the "My
 * Animals" ownership list that used to duplicate it here) -- this is Town-only "Buy a Mount"
 * purchasing UI now, nothing else, so it renders nothing at all once there's nothing buyable. */
export function Animals({ buyableMounts, resources, onBuyMount }: AnimalsProps) {
  if (buyableMounts.length === 0) return null;

  return (
    <div className={styles.panel}>
      <h3>Buy a Mount</h3>
      <ul className={styles.list}>
        {buyableMounts.map((mount) => (
          <li key={mount.name} className={styles.row}>
            <span className={styles.name}>{mount.name}</span>
            <button
              type="button"
              className={styles.buyBtn}
              disabled={!canBuyMount(resources, mount)}
              onClick={() => onBuyMount(mount.name)}
            >
              Buy ({mount.mountCost} coins)
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
