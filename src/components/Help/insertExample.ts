/**
 * Fügt SQL am Ende des Tabs «SQL» an und aktiviert den Tab.
 *
 * Der Editor ist unkontrolliert (CodeMirror besitzt das Dokument), darum wird
 * nicht `adhocSql` gesetzt, sondern direkt in die EditorView geschrieben; deren
 * Update-Listener hält `adhocSql` wie beim Tippen nachgeführt. Die View wird über
 * `EditorView.findFromDOM` im Panel des SQL-Tabs gefunden, dafür braucht es keine
 * Änderung am Editor.
 */
import { EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { SQL_TAB_ID, tabPanelId, useUiStore } from '@/store/uiStore';

/** Trenner, damit das Beispiel auf einer eigenen Zeile nach einer Leerzeile beginnt. */
export function separatorFor(doc: string): string {
  if (doc.trim().length === 0) return doc.length > 0 && !doc.endsWith('\n') ? '\n' : '';
  if (doc.endsWith('\n\n')) return '';
  return doc.endsWith('\n') ? '\n' : '\n\n';
}

export function insertIntoSqlTab(text: string): void {
  const ui = useUiStore.getState();
  ui.activate(SQL_TAB_ID);
  const host = document.getElementById(tabPanelId(SQL_TAB_ID))?.querySelector('.cm-editor');
  const view = host instanceof HTMLElement ? EditorView.findFromDOM(host) : null;

  if (!view) {
    const doc = ui.adhocSql;
    ui.setAdhocSql(`${doc}${separatorFor(doc)}${text}\n`);
    return;
  }

  const doc = view.state.doc.toString();
  const insert = `${separatorFor(doc)}${text}\n`;
  const from = doc.length + separatorFor(doc).length;
  view.dispatch({
    changes: { from: doc.length, insert },
    // Das eingefügte Beispiel markieren: «Ausführen» führt dann genau dieses aus.
    selection: EditorSelection.range(from, from + text.length),
    scrollIntoView: true,
  });
  requestAnimationFrame(() => {
    view.requestMeasure();
    view.focus();
    view.dispatch({ effects: EditorView.scrollIntoView(from, { y: 'center' }) });
  });
}
