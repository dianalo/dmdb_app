/**
 * CodeMirror-Konfiguration für die SQL-Editoren.
 *
 * Farben kommen als CSS-Variablen aus `tokens.css`, damit ein späteres dunkles
 * Theme nur einen Variablenblock braucht.
 */
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { SQLite, sql, type SQLNamespace } from '@codemirror/lang-sql';
import {
  HighlightStyle,
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import {
  Compartment,
  EditorSelection,
  EditorState,
  Prec,
  StateEffect,
  StateField,
  type Extension,
} from '@codemirror/state';
import {
  Decoration,
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  type DecorationSet,
} from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import type { ErrorContext } from '@/db';
import { smartPunctuationFix } from './smartPunctuation';

/** Tabellen und Spalten im Format, das `@codemirror/lang-sql` für Autocomplete erwartet. */
export function toSqlNamespace(ctx: ErrorContext): SQLNamespace {
  const namespace: Record<string, readonly string[]> = {};
  for (const table of ctx.tables) namespace[table] = ctx.columns[table] ?? [];
  return namespace;
}

/** SQL-Sprache mit SQLite-Dialekt und Schema der aktiven Datenbank. */
export function sqlLanguage(schema: SQLNamespace): Extension {
  return sql({ dialect: SQLite, schema, upperCaseKeywords: true });
}

const highlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword, t.modifier], color: 'var(--syntax-keyword)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--syntax-string)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--syntax-number)' },
  {
    tag: [t.lineComment, t.blockComment, t.comment],
    color: 'var(--syntax-comment)',
    fontStyle: 'italic',
  },
  { tag: t.typeName, color: 'var(--syntax-keyword)' },
]);

const theme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '16px', // ≥ 16 px, sonst zoomt iOS beim Fokussieren
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-text)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.5' },
  '.cm-content': { padding: '8px 0', caretColor: 'var(--color-text)' },
  '.cm-gutters': {
    backgroundColor: 'var(--color-gutter)',
    color: 'var(--color-title)',
    border: 'none',
  },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 12px', minWidth: '3ch' },
  '.cm-activeLine': { backgroundColor: 'var(--color-line-focus)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--color-line-focus)' },
  '.cm-errorRange': {
    backgroundColor: 'color-mix(in srgb, var(--color-error) 14%, transparent)',
    textDecoration: 'underline wavy var(--color-error)',
    textUnderlineOffset: '3px',
  },
  '.cm-tooltip': { fontSize: '15px' },
  '.cm-tooltip-autocomplete ul li': { padding: '4px 8px' },
});

/* ---------- Fehlermarkierung ---------- */

const setErrorMark = StateEffect.define<{ from: number; to: number } | null>();
const errorMark = Decoration.mark({ class: 'cm-errorRange' });

const errorMarkField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(marks, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setErrorMark)) {
        const range = effect.value;
        return range && range.to > range.from
          ? Decoration.set([errorMark.range(range.from, range.to)])
          : Decoration.none;
      }
    }
    // Bei der nächsten Bearbeitung verschwindet die Markierung.
    return tr.docChanged ? Decoration.none : marks;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/** Markiert den Bereich `[from, to]` (z. B. das fehlerhafte Statement) und scrollt hin. */
export function markRange(view: EditorView, from: number, to: number): void {
  const length = view.state.doc.length;
  const start = Math.max(0, Math.min(from, length));
  const end = Math.max(start, Math.min(to, length));
  view.dispatch({
    effects: [
      setErrorMark.of({ from: start, to: end }),
      EditorView.scrollIntoView(start, { y: 'center' }),
    ],
  });
}

export function clearMark(view: EditorView): void {
  view.dispatch({ effects: setErrorMark.of(null) });
}

/* ---------- Ausführen ---------- */

/** Was ausgeführt wird: die Selektion, falls vorhanden, sonst der ganze Inhalt. */
export function runTarget(state: EditorState): { sql: string; offset: number } {
  const { from, to } = state.selection.main;
  if (to > from) return { sql: state.sliceDoc(from, to), offset: from };
  return { sql: state.doc.toString(), offset: 0 };
}

export interface EditorCallbacks {
  onRun(sql: string, offset: number): void;
  onChange(doc: string): void;
}

/** Hält das Schema pro Editor, damit es beim Wechsel der Datenbank neu gesetzt werden kann. */
export const schemaCompartment = new Compartment();

/** Setzt das Schema für Autocomplete neu (nach DDL oder Datenbankwechsel). */
export function setSchema(view: EditorView, schema: SQLNamespace): void {
  view.dispatch({ effects: schemaCompartment.reconfigure(sqlLanguage(schema)) });
}

/** Alle Extensions eines SQL-Editors. */
export function editorExtensions(
  callbacks: EditorCallbacks,
  schema: SQLNamespace,
  label: string,
): Extension[] {
  return [
    Prec.highest(
      keymap.of([
        {
          key: 'Mod-Enter',
          preventDefault: true,
          run: (view) => {
            const target = runTarget(view.state);
            callbacks.onRun(target.sql, target.offset);
            return true;
          },
        },
      ]),
    ),
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    drawSelection(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion({ activateOnTyping: true }),
    highlightActiveLine(),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...completionKeymap,
      indentWithTab,
    ]),
    schemaCompartment.of(sqlLanguage(schema)),
    syntaxHighlighting(highlightStyle),
    theme,
    errorMarkField,
    smartPunctuationFix(),
    EditorView.contentAttributes.of({
      autocorrect: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
      'aria-label': label,
    }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) callbacks.onChange(update.state.doc.toString());
    }),
  ];
}

/** Erstellt den Anfangszustand eines Editors. */
export function createEditorState(
  doc: string,
  callbacks: EditorCallbacks,
  schema: SQLNamespace,
  label: string,
): EditorState {
  return EditorState.create({
    doc,
    selection: EditorSelection.cursor(doc.length),
    extensions: editorExtensions(callbacks, schema, label),
  });
}
