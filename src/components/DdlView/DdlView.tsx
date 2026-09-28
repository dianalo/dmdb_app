import { SQLite, sql } from '@codemirror/lang-sql';
import { syntaxHighlighting } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { memo, useEffect, useRef } from 'react';
import { highlightStyle } from '@/editor/cmSetup';
import styles from './DdlView.module.css';

const theme = EditorView.theme({
  '&': {
    fontSize: '16px',
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-text)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.5' },
  '.cm-content': { padding: '12px 16px' },
});

function createState(doc: string, label: string): EditorState {
  return EditorState.create({
    doc,
    extensions: [
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.lineWrapping,
      sql({ dialect: SQLite }),
      syntaxHighlighting(highlightStyle),
      theme,
      EditorView.contentAttributes.of({ 'aria-label': label, 'aria-readonly': 'true' }),
    ],
  });
}

/** Schreibgeschütztes, farbig hervorgehobenes SQL (hier: das `CREATE TABLE` einer Tabelle). */
export const DdlView = memo(function DdlView({ ddl, label }: { ddl: string; label: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const view = new EditorView({ parent: host, state: createState('', '') });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    viewRef.current?.setState(createState(ddl, label));
  }, [ddl, label]);

  return <div className={styles.ddl} ref={hostRef} />;
});
