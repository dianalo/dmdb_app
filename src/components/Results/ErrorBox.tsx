import { mdiAlertCircleOutline, mdiCrosshairsGps } from '@mdi/js';
import type { TranslatedError } from '@/db';
import { Icon } from '@/components/Shell/Icon';
import { de } from '@/i18n/de';
import styles from './Results.module.css';

interface ErrorBoxProps {
  error: TranslatedError;
  /** true, wenn vor dem Fehler schon Anweisungen ausgeführt wurden. */
  afterOthers: boolean;
  /** Markiert das fehlerhafte Statement im Editor. */
  onShow?: () => void;
}

/** Roter Fehlerblock: deutsche Kurzmeldung, Ursache, Vorschlag, Originalmeldung einklappbar. */
export function ErrorBox({ error, afterOthers, onShow }: ErrorBoxProps) {
  return (
    <div className={styles.error} role="alert" onClick={onShow}>
      <p className={styles.errorTitle}>
        <Icon path={mdiAlertCircleOutline} size={20} />
        <span>{error.title}</span>
      </p>
      {error.hint && <p className={styles.errorText}>{error.hint}</p>}
      {error.suggestion && <p className={styles.errorSuggestion}>{error.suggestion}</p>}
      {afterOthers && <p className={styles.errorText}>{de.results.errorBefore}</p>}
      <details className={styles.errorDetails} onClick={(event) => event.stopPropagation()}>
        <summary>{de.results.errorOriginal}</summary>
        <code>{error.original}</code>
      </details>
      {onShow && (
        <button
          type="button"
          className={styles.errorShow}
          onClick={(event) => {
            event.stopPropagation();
            onShow();
          }}
        >
          <Icon path={mdiCrosshairsGps} size={18} />
          <span>{de.results.errorShow}</span>
        </button>
      )}
    </div>
  );
}
