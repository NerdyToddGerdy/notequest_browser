import { useRef, useState } from "react";
import { importSaveFile } from "../../../engine/saveFile.ts";
import { downloadSave } from "../../downloadSave.ts";
import { ConfirmDialog } from "../ConfirmDialog/ConfirmDialog.tsx";
import styles from "./SettingsDialog.module.css";

export interface SettingsDialogProps {
  onHardReset: () => void;
  onClose: () => void;
}

/**
 * Footer's Settings menu (issue #142): the save file's way in and out, beside the hard reset that
 * used to be the button's only job (issue #50). Both destructive actions -- importing over the
 * current game, and wiping it -- still go through a `ConfirmDialog`.
 */
export function SettingsDialog({ onHardReset, onClose }: SettingsDialogProps) {
  const [confirm, setConfirm] = useState<"reset" | "import" | null>(null);
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0];
    e.target.value = ""; // so picking the same file again still fires a change
    if (!chosen) return;
    setError(null);
    setPendingImport(await chosen.text());
    setConfirm("import");
  }

  function handleConfirmImport() {
    if (pendingImport === null) return;
    const result = importSaveFile(pendingImport);
    if (!result.ok) {
      setPendingImport(null);
      setConfirm(null);
      setError(result.error);
      return;
    }
    // App seeds all of its state from storage once, on mount -- a reload is that path, unduplicated.
    location.reload();
  }

  if (confirm === "reset") {
    return (
      <ConfirmDialog
        title="Reset Everything?"
        message="This permanently wipes your character, the Graveyard, every dungeon ever found, and the World map. This can't be undone."
        confirmLabel="Reset Everything"
        onConfirm={() => {
          onClose();
          onHardReset();
        }}
        onCancel={onClose}
      />
    );
  }

  if (confirm === "import") {
    return (
      <ConfirmDialog
        title="Load This Save?"
        message="This replaces your current character, the Graveyard, every dungeon found, and the World map with the ones in the file. Export first if you want to keep this game."
        confirmLabel="Load Save"
        onConfirm={handleConfirmImport}
        onCancel={() => {
          setPendingImport(null);
          setConfirm(null);
        }}
      />
    );
  }

  return (
    <div
      className={styles.backdrop}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settingsTitle"
      >
        <p id="settingsTitle" className={styles.title}>
          Settings
        </p>

        <section className={styles.group}>
          <h3 className={styles.groupTitle}>Your Save</h3>
          <p className={styles.note}>
            Your game lives only in this browser. Export it to keep a backup, or to carry it to
            another browser or device.
          </p>
          <div className={styles.row}>
            <button type="button" className={styles.btn} onClick={downloadSave}>
              Export Save
            </button>
            <button type="button" className={styles.btn} onClick={() => fileInput.current?.click()}>
              Import Save…
            </button>
            <input
              ref={fileInput}
              className={styles.fileInput}
              type="file"
              accept=".json,application/json"
              aria-label="Save file to import"
              onChange={handleFileChosen}
            />
          </div>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </section>

        <section className={styles.group}>
          <h3 className={styles.groupTitle}>Danger</h3>
          <div className={styles.row}>
            <button
              type="button"
              className={`${styles.btn} ${styles.dangerBtn}`}
              onClick={() => setConfirm("reset")}
            >
              Reset Everything…
            </button>
          </div>
        </section>

        <div className={styles.actions}>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
