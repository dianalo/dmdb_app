import { EditorView } from '@codemirror/view';
import { useEffect, useId, useRef, useState } from 'react';
import { ErrorBox } from '@/components/Results/ErrorBox';
import { SqlError, translateThrown, type TranslatedError } from '@/db';
import { createEditorState } from '@/editor/cmSetup';
import { de } from '@/i18n/de';
import { useDbStore } from '@/store/dbStore';
import { isNameTaken } from '@/store/names';
import { Dialog } from './Dialog';
import styles from './Dialog.module.css';
import own from './NewDatabaseDialog.module.css';

/**
 * Dialog «Neue Datenbank»: Name und DDL-Script. Das Script läuft in einer
 * frischen Datenbank; bei einem Fehler bleibt der Dialog offen und nichts wird gespeichert.
 */
export function NewDatabaseDialog({
  onClose,
  onCreated,
}: {
  onClose(): void;
  onCreated(name: string): void;
}) {
  const nameId = useId();
  const nameErrorId = useId();
  const sqlLabelId = useId();
  const sqlHintId = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [sqlError, setSqlError] = useState<TranslatedError | null>(null);
  const [busy, setBusy] = useState(false);
  const submitRef = useRef<() => void>(() => undefined);

  const submit = async () => {
    const trimmed = name.trim();
    const existing = useDbStore.getState().databases.map((db) => db.name);
    const problem = !trimmed
      ? de.dialogs.nameRequired
      : isNameTaken(trimmed, existing)
        ? de.dialogs.dbNameTaken(trimmed)
        : null;
    setNameError(problem);
    if (problem) {
      document.getElementById(nameId)?.focus();
      return;
    }
    const sql = viewRef.current?.state.doc.toString() ?? '';
    setBusy(true);
    setSqlError(null);
    try {
      await useDbStore.getState().createFromDdl(trimmed, sql);
      onCreated(trimmed);
      onClose();
    } catch (thrown) {
      setBusy(false);
      setSqlError(thrown instanceof SqlError ? thrown.translated : translateThrown(thrown));
    }
  };

  useEffect(() => {
    submitRef.current = () => void submit();
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const view = new EditorView({
      parent: host,
      state: createEditorState(
        de.dialogs.newDb.example,
        {
          // Ctrl/Cmd + Enter erstellt die Datenbank.
          onRun: () => submitRef.current(),
          onChange: () => setSqlError(null),
        },
        {},
        de.dialogs.newDb.editorLabel,
      ),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  return (
    <Dialog
      title={de.dialogs.newDb.title}
      size="wide"
      onClose={onClose}
      busy={busy}
      onSubmit={() => void submit()}
      footer={
        <>
          <button type="button" className={styles.button} onClick={onClose} disabled={busy}>
            {de.dialogs.cancel}
          </button>
          <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={busy}>
            {busy ? de.dialogs.working : de.dialogs.newDb.create}
          </button>
        </>
      }
    >
      <div className={styles.field}>
        <label htmlFor={nameId} className={styles.label}>
          {de.dialogs.nameLabel}
        </label>
        <input
          id={nameId}
          className={styles.input}
          value={name}
          placeholder={de.dialogs.newDb.namePlaceholder}
          onChange={(event) => {
            setName(event.target.value);
            if (nameError) setNameError(null);
          }}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          required
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? nameErrorId : undefined}
        />
        {nameError && (
          <p id={nameErrorId} className={styles.fieldError} role="alert">
            {nameError}
          </p>
        )}
      </div>
      <div className={styles.field}>
        <span id={sqlLabelId} className={styles.label}>
          {de.dialogs.newDb.sqlLabel}
        </span>
        <span id={sqlHintId} className={styles.hint}>
          {de.dialogs.newDb.sqlHint}
        </span>
        <div
          ref={hostRef}
          className={own.editor}
          aria-labelledby={sqlLabelId}
          aria-describedby={sqlHintId}
        />
      </div>
      {sqlError && <ErrorBox error={sqlError} afterOthers={false} />}
    </Dialog>
  );
}
