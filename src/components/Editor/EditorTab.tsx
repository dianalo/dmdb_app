import { mdiPlay } from '@mdi/js';
import type { EditorView } from '@codemirror/view';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Shell/Icon';
import { Results } from '@/components/Results/Results';
import { SplitPane } from '@/components/SplitPane/SplitPane';
import { markRange, runTarget } from '@/editor/cmSetup';
import { de } from '@/i18n/de';
import { EMPTY_TAB_RESULTS, useResultStore } from '@/store/resultStore';
import { useScratchbookStore } from '@/store/scratchbookStore';
import { useUiStore, type Tab } from '@/store/uiStore';
import { SqlEditor } from './SqlEditor';
import styles from './EditorTab.module.css';

/** Anfangsinhalt des Editors: Ad-hoc-SQL oder Inhalt des Scratch-Books. */
function initialDocFor(tab: Tab): string {
  if (tab.kind === 'scratchbook' && tab.refId !== undefined) {
    return useScratchbookStore.getState().contents[tab.refId] ?? '';
  }
  return useUiStore.getState().adhocSql;
}

/** Editor-Tab: oben der SQL-Editor, unten die Ausgabe, dazwischen der Splitter. */
export function EditorTab({ tab, active }: { tab: Tab; active: boolean }) {
  const viewRef = useRef<EditorView | null>(null);
  const running = useResultStore((state) => (state.byTab[tab.id] ?? EMPTY_TAB_RESULTS).running);
  const run = useResultStore((state) => state.run);
  const splitRatio = useUiStore((state) => state.splitRatio);
  const maximized = useUiStore((state) => state.outputMaximized);
  const setSplitRatio = useUiStore((state) => state.setSplitRatio);
  const toggleMaximized = useUiStore((state) => state.toggleOutputMaximized);

  const onChange = useCallback(
    (doc: string) => {
      if (tab.kind === 'scratchbook' && tab.refId !== undefined) {
        useScratchbookStore.getState().updateContent(tab.refId, doc);
      } else {
        useUiStore.getState().setAdhocSql(doc);
      }
    },
    [tab.kind, tab.refId],
  );

  const onRun = useCallback(
    (sql: string, offset: number) => {
      void run(tab.id, sql, offset).then(() => {
        // Das erste fehlerhafte Statement gleich im Editor markieren.
        const failed = useResultStore
          .getState()
          .byTab[tab.id]?.results.find((result) => result.kind === 'error');
        const view = viewRef.current;
        if (failed && view) markRange(view, failed.range[0], failed.range[1]);
      });
    },
    [run, tab.id],
  );

  const onView = useCallback((view: EditorView | null) => {
    viewRef.current = view;
  }, []);

  const onRunClick = () => {
    const view = viewRef.current;
    if (!view) return;
    const target = runTarget(view.state);
    onRun(target.sql, target.offset);
  };

  const onShowRange = useCallback((range: [number, number]) => {
    const view = viewRef.current;
    if (!view) return;
    markRange(view, range[0], range[1]);
    view.focus();
  }, []);

  // Versteckte Editoren messen nichts; beim Aktivieren neu messen.
  useEffect(() => {
    if (active) viewRef.current?.requestMeasure();
  }, [active]);

  // Nur beim ersten Rendern lesen: der Editor ist danach unkontrolliert.
  const [initialDoc] = useState(() => initialDocFor(tab));

  return (
    <div className={styles.editorTab}>
      <div className={styles.actions}>
        <span className={styles.shortcut}>{de.editor.runShortcut}</span>
        <button
          type="button"
          className={styles.runButton}
          onClick={onRunClick}
          disabled={running}
          aria-busy={running}
        >
          <Icon path={mdiPlay} size={22} />
          <span>{running ? de.editor.running : de.editor.run}</span>
        </button>
      </div>
      <SplitPane
        ratio={splitRatio}
        maximized={maximized}
        onRatioChange={setSplitRatio}
        onToggleMaximized={toggleMaximized}
        top={
          <SqlEditor
            initialDoc={initialDoc}
            label={de.editor.editorLabel(tab.title)}
            onChange={onChange}
            onRun={onRun}
            onView={onView}
          />
        }
        bottom={<Results tabId={tab.id} onShowRange={onShowRange} />}
      />
    </div>
  );
}
