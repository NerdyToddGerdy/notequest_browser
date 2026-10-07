import { Component, type ErrorInfo, type ReactNode } from "react";
import { abandonLiveRun, hasStoredLiveRun } from "../../../engine/session.ts";
import { downloadSave } from "../../downloadSave.ts";
import styles from "./ErrorBoundary.module.css";

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * The app's only error boundary, wrapped around `App` in `main.tsx`.
 *
 * Without it a render crash is a blank screen. That used to be survivable -- a reload landed on
 * the map -- but since #141 a reload resumes straight into the saved dungeon run, so a run that
 * crashes would crash on every reload, with no way out short of clearing site data. This screen
 * is that way out: leave the run (`abandonLiveRun()`), or take the save somewhere safe first.
 *
 * Deliberately self-sufficient: it reads storage directly rather than anything from `App`, since
 * by the time it renders, `App` is gone.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("GerdQuest crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const inRun = hasStoredLiveRun();

    return (
      <main className={styles.page}>
        <div className={styles.card} role="alert">
          <h1 className={styles.title}>Something broke</h1>
          <p className={styles.message}>
            {inRun
              ? "The game hit an error inside a dungeon. Your save is intact. Leave the dungeon to get back to the map — you'll keep your character, but lose what happened on this trip."
              : "The game hit an error. Your save is intact. Reload to try again."}
          </p>
          <div className={styles.actions}>
            {inRun ? (
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => {
                  abandonLiveRun();
                  location.reload();
                }}
              >
                Leave the Dungeon
              </button>
            ) : (
              <button type="button" className={styles.primaryBtn} onClick={() => location.reload()}>
                Reload
              </button>
            )}
            <button type="button" className={styles.secondaryBtn} onClick={downloadSave}>
              Export Save
            </button>
          </div>
          <details className={styles.details}>
            <summary>Error details</summary>
            <pre>{this.state.error.message}</pre>
          </details>
        </div>
      </main>
    );
  }
}
