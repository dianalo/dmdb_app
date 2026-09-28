import { EditorView } from '@codemirror/view';
import { memo, useEffect, useRef } from 'react';
import { createEditorState, setSchema, toSqlNamespace } from '@/editor/cmSetup';
import { useDbStore } from '@/store/dbStore';
import styles from './EditorTab.module.css';

interface SqlEditorProps {
  /** Anfangsinhalt; spätere Änderungen dieser Prop werden ignoriert (unkontrolliert). */
  initialDoc: string;
  label: string;
  onChange(doc: string): void;
  onRun(sql: string, offset: number): void;
  /** Liefert die EditorView nach dem Erstellen (und `null` beim Abbauen). */
  onView(view: EditorView | null): void;
}

/**
 * Dünner Wrapper um CodeMirror. Der Editor ist unkontrolliert: React rendert ihn
 * einmal, danach gehört das DOM CodeMirror. Callbacks laufen über Refs, damit
 * neue Funktionsreferenzen keinen Neuaufbau auslösen.
 */
export const SqlEditor = memo(function SqlEditor({
  initialDoc,
  label,
  onChange,
  onRun,
  onView,
}: SqlEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const callbacks = useRef({ onChange, onRun, onView });
  const initial = useRef({ initialDoc, label });

  useEffect(() => {
    callbacks.current = { onChange, onRun, onView };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const view = new EditorView({
      parent: host,
      state: createEditorState(
        initial.current.initialDoc,
        {
          onChange: (doc) => callbacks.current.onChange(doc),
          onRun: (sql, offset) => callbacks.current.onRun(sql, offset),
        },
        toSqlNamespace(useDbStore.getState().errorContext),
        initial.current.label,
      ),
    });
    viewRef.current = view;
    callbacks.current.onView(view);

    // Schema für Autocomplete nachführen (DDL, Datenbankwechsel), ohne React-Render.
    const unsubscribe = useDbStore.subscribe((state, previous) => {
      if (state.errorContext !== previous.errorContext) {
        setSchema(view, toSqlNamespace(state.errorContext));
      }
    });

    return () => {
      unsubscribe();
      callbacks.current.onView(null);
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  return <div className={styles.editor} ref={hostRef} />;
});
