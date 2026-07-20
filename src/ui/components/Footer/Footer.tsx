import { useState } from "react";
import { ConfirmDialog } from "../ConfirmDialog/ConfirmDialog.tsx";
import styles from "./Footer.module.css";

export interface FooterProps {
  /** e.g. "THE DUNGEON" -- rendered as "NOTEQUEST · <screenLabel>". */
  screenLabel: string;
  onHardReset: () => void;
}

/** The credit block + Settings hard-reset control, shared by every screen (issue #50) so the
 * four near-identical inline footers didn't each need their own reset-confirmation wiring. */
export function Footer({ screenLabel, onHardReset }: FooterProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <footer className={styles.credit}>
      <p>NOTEQUEST · {screenLabel}</p>
      <p className={styles.creditSub}>
        NoteQuest was created by Tiago Junges — this is an unofficial fan-made adaptation. Support
        the original on{" "}
        <a
          className={styles.creditLink}
          href="https://www.drivethrurpg.com/en/product/365859/notequest-expanded-world?src=also_purchased"
          target="_blank"
          rel="noopener noreferrer"
        >
          DriveThruRPG
        </a>
        .
      </p>
      <p className={styles.creditVersion}>v{__APP_VERSION__}</p>
      <button type="button" className={styles.settingsBtn} onClick={() => setConfirming(true)}>
        Settings
      </button>
      {confirming && (
        <ConfirmDialog
          title="Reset Everything?"
          message="This permanently wipes your character, the Graveyard, every dungeon ever found, and the World map. This can't be undone."
          confirmLabel="Reset Everything"
          onConfirm={() => {
            setConfirming(false);
            onHardReset();
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </footer>
  );
}
