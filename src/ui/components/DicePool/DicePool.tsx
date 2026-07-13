import { Die } from "../Die/Die.tsx";
import styles from "./DicePool.module.css";

export interface DicePoolProps {
  /** Face values to display, one per die. */
  values: number[];
  /** Change this together with `values` each time a new roll should animate. */
  rollToken: number;
  /** Delay between each die's animation start. */
  staggerMs?: number;
  size?: number;
}

export function DicePool({ values, rollToken, staggerMs = 90, size }: DicePoolProps) {
  return (
    <div className={styles.diceRow}>
      {values.map((value, index) => (
        <Die
          key={index}
          value={value}
          rollToken={rollToken}
          delayMs={index * staggerMs}
          size={size}
        />
      ))}
    </div>
  );
}
