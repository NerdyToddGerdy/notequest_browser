import { useEffect, useState, useSyncExternalStore } from "react";
import { getSaveHealth, subscribeSaveHealth, watchForOtherTabs } from "../../../engine/session.ts";
import styles from "./SaveStatus.module.css";

/**
 * Issue #142: the two ways a save can stop working without the player noticing.
 *
 * - **Storage refused the write** (private browsing, a full quota): a dismissible strip. The game
 *   still plays, and Settings' Export can still rescue it, so it warns rather than blocks.
 * - **Another tab took over the save**: a blocking overlay. This tab has already stopped saving
 *   (`saveSession()` enforces that), so anything done here would be lost on the next reload --
 *   letting the player keep clicking would be the same silent loss in a different shape.
 *
 * Mounted once, beside `App`, so every screen gets it without threading anything through them.
 */
export function SaveStatus() {
  const health = useSyncExternalStore(subscribeSaveHealth, getSaveHealth);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => watchForOtherTabs(), []);

  if (health === "superseded") {
    return (
      <div className={styles.backdrop}>
        <div
          className={styles.dialog}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="saveStatusTitle"
        >
          <p id="saveStatusTitle" className={styles.title}>
            Open in Another Tab
          </p>
          <p className={styles.message}>
            Your game was saved from another tab or window, so this one has stopped saving to keep
            from overwriting it. Play on in the other tab, or load the latest save here instead.
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.primaryBtn} onClick={() => location.reload()}>
              Play Here Instead
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (health === "failing" && !dismissed) {
    return (
      <div className={styles.strip} role="alert">
        <span>
          Your progress isn&apos;t being saved — this browser is refusing storage (private browsing,
          or it&apos;s full). Use Settings → Export Save to keep it.
        </span>
        <button type="button" className={styles.dismissBtn} onClick={() => setDismissed(true)}>
          Dismiss
        </button>
      </div>
    );
  }

  return null;
}
