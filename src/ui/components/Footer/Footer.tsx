import { useState } from "react";
import { ConfirmDialog } from "../ConfirmDialog/ConfirmDialog.tsx";
import styles from "./Footer.module.css";

export interface FooterProps {
  /** e.g. "THE WORLD" -- rendered as "GERDQUEST: REALM OF DEPTHS · <screenLabel>". */
  screenLabel: string;
  onHardReset: () => void;
}

/** The credit block + Settings hard-reset control, shared by every screen (issue #50) so the
 * four near-identical inline footers didn't each need their own reset-confirmation wiring.
 *
 * Issue #113 renamed the app to "GerdQuest: Realm of Depths", which makes the credit line below
 * *more* load-bearing, not less: the old name did part of the crediting work just by existing, and
 * now it doesn't. The attribution here is deliberately unchanged and should stay prominent -- a
 * distinct name plus explicit credit is a better posture than a borrowed name, precisely because it
 * can no longer read as though this might be official.
 *
 * Two things make that credit line the *only* disambiguator now, so don't quietly trim it. First,
 * "GerdQuest" shares NoteQuest's own word+Quest shape -- the one construction issue #113 flagged as
 * risking a "sub-brand" read. Second, the earlier "Nerdy Gerdy's" possessive, which made the fan-work
 * status obvious at a glance, is gone: "GerdQuest" is now a series prefix (a sibling title,
 * "GerdQuest: Idle Depths", is planned), not a personal signature.
 *
 * Both halves of the name are unused elsewhere -- no game, npm package or GitHub repo for either
 * "GerdQuest" or "Realm of Depths" -- so the subtitle is branding, not a uniqueness requirement. */
export function Footer({ screenLabel, onHardReset }: FooterProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <footer className={styles.credit}>
      <p>GERDQUEST: REALM OF DEPTHS · {screenLabel}</p>
      <p className={styles.creditSub}>
        GerdQuest: Realm of Depths is an unofficial fan-made adaptation of NoteQuest, created by
        Tiago Junges. Support the original on{" "}
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
