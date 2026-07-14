import type { HeldItem } from "../../../engine/dungeonState.ts";
import styles from "./Pack.module.css";

export interface PackProps {
  items: HeldItem[];
  /** Set only in Town -- rendering a Sell button per row and enabling the "Sell Items" city action. */
  onSell?: (index: number) => void;
}

/** Coin-valued items found by opening Treasures -- held until there's a town to sell them in. */
export function Pack({ items, onSell }: PackProps) {
  if (items.length === 0) return null;

  const totalWorth = items.reduce((sum, item) => sum + item.worth, 0);

  return (
    <div className={styles.panel}>
      <h3>Pack</h3>
      <p className={styles.note}>
        {onSell
          ? `Worth ${totalWorth} coins total.`
          : `Worth ${totalWorth} coins once there's a town to sell them in.`}
      </p>
      <ul className={styles.list}>
        {items.map((item, index) => (
          <li key={index} className={styles.row}>
            <span className={styles.name}>{item.name}</span>
            <span className={styles.worth}>{item.worth}c</span>
            {onSell && (
              <button type="button" className={styles.sellBtn} onClick={() => onSell(index)}>
                Sell
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
