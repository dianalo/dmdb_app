import { useId, useState } from 'react';
import { de } from '@/i18n/de';
import { Dialog } from './Dialog';
import styles from './Dialog.module.css';

export interface PromptDialogProps {
  title: string;
  label: string;
  initialValue: string;
  confirmLabel: string;
  /** Liefert eine Fehlermeldung oder `null`, wenn der (getrimmte) Wert gültig ist. */
  validate(value: string): string | null;
  onSubmit(value: string): void | Promise<void>;
  onClose(): void;
}

/** Dialog mit einem Textfeld, z. B. zum Umbenennen. */
export function PromptDialog({
  title,
  label,
  initialValue,
  confirmLabel,
  validate,
  onSubmit,
  onClose,
}: PromptDialogProps) {
  const inputId = useId();
  const errorId = useId();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = value.trim();
    const problem = validate(trimmed);
    setError(problem);
    if (problem) return;
    setBusy(true);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (thrown) {
      setBusy(false);
      setError(thrown instanceof Error ? thrown.message : de.dialogs.actionFailed);
    }
  };

  return (
    <Dialog
      title={title}
      onClose={onClose}
      busy={busy}
      onSubmit={() => void submit()}
      footer={
        <>
          <button type="button" className={styles.button} onClick={onClose} disabled={busy}>
            {de.dialogs.cancel}
          </button>
          <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={busy}>
            {busy ? de.dialogs.working : confirmLabel}
          </button>
        </>
      }
    >
      <div className={styles.field}>
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
        <input
          id={inputId}
          className={styles.input}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
          onFocus={(event) => event.target.select()}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        {error && (
          <p id={errorId} className={styles.fieldError} role="alert">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
