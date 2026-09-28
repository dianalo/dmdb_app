import { mdiClose } from '@mdi/js';
import { useEffect, useId, useRef, type ReactNode, type SyntheticEvent } from 'react';
import { Icon } from '@/components/Shell/Icon';
import { de } from '@/i18n/de';
import styles from './Dialog.module.css';

export interface DialogProps {
  title: string;
  /** Escape, Tipp auf den Hintergrund und «×» rufen `onClose` auf. */
  onClose(): void;
  children: ReactNode;
  /** Buttons unten rechts. */
  footer?: ReactNode;
  /** `wide` für Dialoge mit Editor oder viel Text. */
  size?: 'normal' | 'wide';
  /** Solange true, schliessen Escape und Hintergrund nicht (z. B. während des Speicherns). */
  busy?: boolean;
  /** Absendbares Formular: Enter in einem Eingabefeld ruft `onSubmit` auf. */
  onSubmit?(): void;
}

/** Elemente, die als Erstes den Fokus bekommen (Inhalt vor Footer, «×» zuletzt). */
const FOCUSABLE =
  '[data-autofocus], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"], button:not([disabled]), a[href]';

/**
 * Modaler Dialog auf Basis von `<dialog>` und `showModal()`: Fokusfalle, Escape
 * und Top-Layer übernimmt der Browser. Wird gerendert, solange er offen ist;
 * zum Schliessen rendert der Aufrufer ihn nicht mehr.
 */
export function Dialog({
  title,
  onClose,
  children,
  footer,
  size = 'normal',
  busy = false,
  onSubmit,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const latest = useRef({ onClose, busy });
  /** Pointerdown auf dem Hintergrund? Nur dann schliesst der folgende Klick. */
  const downOnBackdrop = useRef(false);

  useEffect(() => {
    latest.current = { onClose, busy };
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    const first =
      bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE) ??
      footerRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    return () => {
      if (dialog.open) dialog.close();
      // Fokus zurück auf den Auslöser (z. B. den «⋯»-Button), falls er noch da ist.
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  const onCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    // Escape: während `busy` offen lassen (best effort, der Browser darf es übergehen).
    if (latest.current.busy) event.preventDefault();
  };

  const onNativeClose = () => {
    // Der Browser hat den Dialog geschlossen (Escape): React nachziehen.
    // Ist er schon wieder offen (StrictMode baut Effekte doppelt auf), ignorieren.
    if (!ref.current?.open) latest.current.onClose();
  };

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      data-size={size}
      aria-labelledby={titleId}
      onCancel={onCancel}
      onClose={onNativeClose}
      onPointerDown={(event) => {
        downOnBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && downOnBackdrop.current && !busy) onClose();
        downOnBackdrop.current = false;
      }}
    >
      <form
        className={styles.frame}
        method="dialog"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) onSubmit?.();
        }}
      >
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            aria-label={de.dialogs.close}
            onClick={onClose}
            disabled={busy}
          >
            <Icon path={mdiClose} />
          </button>
        </header>
        <div ref={bodyRef} className={styles.body}>
          {children}
        </div>
        {footer && (
          <div ref={footerRef} className={styles.footer}>
            {footer}
          </div>
        )}
      </form>
    </dialog>
  );
}
