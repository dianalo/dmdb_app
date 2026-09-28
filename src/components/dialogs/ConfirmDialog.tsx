import { useState } from 'react';
import { translateThrown } from '@/db';
import { de } from '@/i18n/de';
import { Dialog } from './Dialog';
import styles from './Dialog.module.css';

export interface ConfirmDialogProps {
  title: string;
  text: string;
  /** Zusätzlicher Absatz unter `text`, z. B. ein Hinweis. */
  note?: string;
  confirmLabel: string;
  /** Rote Bestätigung für Aktionen, die Daten löschen. */
  danger?: boolean;
  /** Darf asynchron sein; wirft sie, bleibt der Dialog offen und zeigt die Meldung. */
  onConfirm(): void | Promise<void>;
  onClose(): void;
}

/** Rückfrage mit «Abbrechen» und einer Bestätigung. «Abbrechen» bekommt den Fokus. */
export function ConfirmDialog({
  title,
  text,
  note,
  confirmLabel,
  danger = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (thrown) {
      setBusy(false);
      setError(thrown instanceof Error ? thrown.message : translateThrown(thrown).title);
    }
  };

  return (
    <Dialog
      title={title}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className={styles.button} onClick={onClose} disabled={busy}>
            {de.dialogs.cancel}
          </button>
          <button
            type="button"
            className={`${styles.button} ${danger ? styles.danger : styles.primary}`}
            onClick={() => void confirm()}
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? de.dialogs.working : confirmLabel}
          </button>
        </>
      }
    >
      <p>{text}</p>
      {note && <p className={styles.hint}>{note}</p>}
      {error && (
        <p className={styles.fieldError} role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
