import { de } from '@/i18n/de';
import { Dialog } from './Dialog';
import styles from './Dialog.module.css';

/** Einfache Meldung mit «OK», z. B. wenn ein Import scheitert. */
export function MessageDialog({
  title,
  text,
  onClose,
}: {
  title: string;
  text: string;
  onClose(): void;
}) {
  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={
        <button type="button" className={`${styles.button} ${styles.primary}`} onClick={onClose}>
          {de.dialogs.ok}
        </button>
      }
    >
      <p role="alert">{text}</p>
    </Dialog>
  );
}
