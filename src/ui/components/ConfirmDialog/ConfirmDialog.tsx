import styles from "./ConfirmDialog.module.css";

export interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A generic, viewport-covering confirmation modal -- the first of its kind in this codebase (no
 * existing dialog/backdrop pattern to reuse), so it's kept deliberately small and self-contained
 * rather than folded into any one screen. Clicking the backdrop itself cancels, matching the
 * Cancel button. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div
      className={styles.backdrop}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby="confirmDialogTitle">
        <p id="confirmDialogTitle" className={styles.title}>
          {title}
        </p>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={styles.confirmBtn} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
