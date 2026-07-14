import styles from "./TrapToast.module.css";

export interface TrapToastProps {
  /** Bumped (not just toggled) each time a trap fires, so a second trap while the first toast is
   * still fading re-triggers the animation instead of silently no-op'ing. */
  token: number;
}

/** A brief, unmissable warning the instant a trap is confirmed -- fired before the trap's actual
 * effect (damage, ambush, etc.) resolves into the log, so it reads as "you're being ambushed" and
 * not just another line of after-the-fact flavor text. */
export function TrapToast({ token }: TrapToastProps) {
  if (token === 0) return null;
  return (
    <div className={styles.wrap} aria-live="assertive">
      <div key={token} className={styles.toast}>
        A trap!
      </div>
    </div>
  );
}
