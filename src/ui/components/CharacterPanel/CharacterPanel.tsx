import { useState, type ReactNode } from "react";
import styles from "./CharacterPanel.module.css";

export type CharacterTab = "stats" | "equipment" | "items";

export interface CharacterPanelProps {
  /** The character sheet -- name, HP, resources, abilities, spells. */
  stats: ReactNode;
  /** Worn armor, the equipped weapon, and spares. Omitted on screens that have no gear actions. */
  equipment?: ReactNode;
  /** The Pack: sellable items, potions, and anything else carried. */
  items?: ReactNode;
}

const TABS: { key: CharacterTab; label: string }[] = [
  { key: "stats", label: "Stats" },
  { key: "equipment", label: "Gear" },
  { key: "items", label: "Pack" },
];

/**
 * The sidebar, as one tabbed panel instead of three stacked cards.
 *
 * Stacking `CharacterSheet` + `Equipment` + `Pack` made the sidebar taller than any screen,
 * so the whole page scrolled -- which is the thing the full-viewport box exists to stop. Only one
 * of the three is ever being read at a time, so they become tabs: the column now fills its cell
 * exactly, and scrolling (when a long spell list or a full Pack needs it) happens *inside* the
 * panel rather than moving the map out of view.
 *
 * Deliberately the same tab mechanism the City Square already uses (issues #76/#88) -- that pattern
 * was introduced there for the identical reason, a section that had grown past a screenful. Reusing
 * its vocabulary means one thing to learn, not two.
 *
 * A tab with no content is dropped rather than shown empty: `WorldScreen` has no gear or pack
 * actions, so out on the map this renders as a single untabbed panel.
 */
export function CharacterPanel({ stats, equipment, items }: CharacterPanelProps) {
  const available = TABS.filter(
    (t) =>
      (t.key === "stats" && stats) ||
      (t.key === "equipment" && equipment) ||
      (t.key === "items" && items),
  );
  const [active, setActive] = useState<CharacterTab>("stats");
  // If the active tab disappears (a screen that offers fewer), fall back during render -- the same
  // shape TownScreen's own tab state uses.
  const current = available.some((t) => t.key === active) ? active : "stats";

  return (
    <div className={styles.panel}>
      {available.length > 1 && (
        <div className={styles.tabs} role="tablist" aria-label="Character">
          {available.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={current === tab.key}
              className={current === tab.key ? styles.tabActive : styles.tab}
              onClick={() => setActive(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
      <div className={styles.body}>
        {current === "stats" && stats}
        {current === "equipment" && equipment}
        {current === "items" && items}
      </div>
    </div>
  );
}
