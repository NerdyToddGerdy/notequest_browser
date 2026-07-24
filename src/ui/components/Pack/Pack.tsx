import type { HeldItem } from "../../../engine/dungeonState.ts";
import { MAX_HELD_ITEMS } from "../../../engine/town.ts";
import styles from "./Pack.module.css";

export interface PackProps {
  items: HeldItem[];
  /** Set only in Town -- rendering a Sell button per row and enabling the "Sell Items" city action. */
  onSell?: (index: number) => void;
  /** Free discard, available anywhere -- renders a Discard button per row (issue #82). */
  onDiscard?: (index: number) => void;
  /** An item that didn't fit when the Pack was already at MAX_HELD_ITEMS (issue #82, dungeon-only --
   * only OPEN_TREASURE/COLLECT_REMAINS can ever trigger this). */
  pendingItem?: HeldItem | null;
  /** Resolves the swap prompt: a number discards that existing row to make room for the incoming
   * item; "decline" leaves the incoming item behind for good. */
  onResolveSwap?: (discardIndex: number | "decline") => void;
}

/** Coin-valued items found by opening Treasures -- held until there's a town to sell them in. */
export function Pack({ items, onSell, onDiscard, pendingItem = null, onResolveSwap }: PackProps) {
  if (items.length === 0 && !pendingItem) return null;

  const totalWorth = items.reduce((sum, item) => sum + item.worth, 0);
  const swapping = pendingItem != null && !!onResolveSwap;

  return (
    <div className={styles.panel}>
      <h3>Pack</h3>
      <p className={styles.note}>
        {onSell
          ? `Worth ${totalWorth} coins total.`
          : `Worth ${totalWorth} coins once there's a town to sell them in.`}{" "}
        ({items.length}/{MAX_HELD_ITEMS})
      </p>

      {swapping && (
        <div className={styles.swapPrompt}>
          <p className={styles.swapText}>
            Your Pack is full -- <strong>{pendingItem.name}</strong> doesn't fit. Discard something
            below to make room, or leave it behind.
          </p>
          <button
            type="button"
            className={styles.declineBtn}
            onClick={() => onResolveSwap!("decline")}
          >
            Leave {pendingItem.name} Behind
          </button>
        </div>
      )}

      <ul className={styles.list}>
        {items.map((item, index) => (
          <li key={index} className={styles.row}>
            <span className={styles.name}>{item.name}</span>
            <span className={styles.worth}>{item.worth}c</span>
            {swapping ? (
              <button
                type="button"
                className={styles.sellBtn}
                onClick={() => onResolveSwap!(index)}
              >
                Discard &amp; Keep
              </button>
            ) : (
              <>
                {onSell && (
                  <button type="button" className={styles.sellBtn} onClick={() => onSell(index)}>
                    Sell
                  </button>
                )}
                {onDiscard && (
                  <button
                    type="button"
                    className={styles.discardBtn}
                    onClick={() => onDiscard(index)}
                  >
                    Discard
                  </button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
