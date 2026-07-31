import {
  isUsableOutOfCombat,
  type Consumable,
  type HeldItem,
} from "../../../engine/dungeonState.ts";
import { MAX_HELD_ITEMS } from "../../../engine/town.ts";
import styles from "./Pack.module.css";

export interface PackProps {
  items: HeldItem[];
  /** Set only in Town -- rendering a Sell button per row and enabling the "Sell Items" city action. */
  onSell?: (index: number) => void;
  /** Free discard, available anywhere -- renders a Discard button per row (issue #82). */
  onDiscard?: (index: number) => void;
  /** An item that didn't fit when the Pack was already at `maxItems` (issue #82, dungeon-only --
   * only OPEN_TREASURE/COLLECT_REMAINS can ever trigger this). */
  pendingItem?: HeldItem | null;
  /** Resolves the swap prompt: a number discards that existing row to make room for the incoming
   * item; "decline" leaves the incoming item behind for good. */
  onResolveSwap?: (discardIndex: number | "decline") => void;
  /** The Pack's current capacity -- `MAX_HELD_ITEMS` (10) normally, 40 with a Cargo Ogre employed
   * (issue #63), +1 with a Monkey owned (issue #67) -- see `town.ts`'s `maxHeldItemsFor()`.
   * Callers compute this from whichever Hireling/Animals are currently employed/owned rather than
   * Pack importing the raw constant itself. */
  maxItems?: number;
  /** Held potions (issue #110), rendered as their own section. They share the Pack's slots with
   * `items`, per the rulebook's "up to 10 items in your backpack." */
  consumables?: Consumable[];
  /** Drinks one. Omitted where drinking isn't possible; a potion that does nothing in the current
   * context (Potion of Fury with no fight) is rendered disabled rather than hidden. */
  onUseConsumable?: (index: number) => void;
  onDiscardConsumable?: (index: number) => void;
  /** False on the World map and in Town, where there's no fight for a Potion of Fury to buff. */
  inCombatContext?: boolean;
}

/** Coin-valued items found by opening Treasures -- held until there's a town to sell them in. */
export function Pack({
  items,
  onSell,
  onDiscard,
  pendingItem = null,
  onResolveSwap,
  maxItems = MAX_HELD_ITEMS,
  consumables = [],
  onUseConsumable,
  onDiscardConsumable,
  inCombatContext = false,
}: PackProps) {
  if (items.length === 0 && consumables.length === 0 && !pendingItem) return null;

  const totalWorth = items.reduce((sum, item) => sum + item.worth, 0);
  const used = items.length + consumables.length;
  const swapping = pendingItem != null && !!onResolveSwap;

  return (
    <div className={styles.panel}>
      <h3>Pack</h3>
      <p className={styles.note}>
        {onSell
          ? `Worth ${totalWorth} coins total.`
          : `Worth ${totalWorth} coins once there's a town to sell them in.`}{" "}
        ({used}/{maxItems})
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

      {consumables.length > 0 && (
        <>
          <h4 className={styles.subheading}>Potions</h4>
          <ul className={styles.list}>
            {consumables.map((item, index) => {
              // Issue #110: a Potion of Fury is real, just useless right now -- disabled with a
              // reason beats hiding it, the same call `Ask` and the spell "Cast" buttons make.
              const usable = inCombatContext || isUsableOutOfCombat(item.effect);
              return (
                <li key={index} className={styles.row} title={item.text}>
                  <span className={styles.name}>{item.name}</span>
                  {onUseConsumable && (
                    <button
                      type="button"
                      className={styles.sellBtn}
                      disabled={!usable}
                      title={usable ? undefined : "Only useful in a fight."}
                      onClick={() => onUseConsumable(index)}
                    >
                      Use
                    </button>
                  )}
                  {onDiscardConsumable && (
                    <button
                      type="button"
                      className={styles.discardBtn}
                      onClick={() => onDiscardConsumable(index)}
                    >
                      Discard
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
