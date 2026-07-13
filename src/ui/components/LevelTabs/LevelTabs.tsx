import styles from "./LevelTabs.module.css";

export interface LevelTabsProps {
  count: number;
  activeLevel: number;
  onSwitchLevel: (levelIndex: number) => void;
}

export function LevelTabs({ count, activeLevel, onSwitchLevel }: LevelTabsProps) {
  if (count === 0) return null;
  return (
    <div className={styles.tabs}>
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          className={`${styles.tab} ${i === activeLevel ? styles.active : ""}`}
          onClick={() => onSwitchLevel(i)}
        >
          Level {i + 1}
        </button>
      ))}
    </div>
  );
}
