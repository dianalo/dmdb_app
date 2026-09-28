/**
 * Gegen die «Smart Punctuation» von iPadOS (PLAN.md, «Browser-Kompatibilität»):
 * typografische Anführungszeichen und Gedankenstriche zerstören SQL-Strings und
 * Kommentare. Wir wandeln sie beim Tippen und Einfügen zurück.
 */
import {
  ChangeSet,
  EditorState,
  Transaction,
  type ChangeSpec,
  type Extension,
} from '@codemirror/state';
import { EditorView } from '@codemirror/view';

const SINGLE_QUOTES = /[‘’‚‛′]/g; // ‘ ’ ‚ ‛ ′
const DOUBLE_QUOTES = /[“”„‟″]/g; // “ ” „ ‟ ″
const DASHES = /[–—]/g; // – —
const SINGLE_DASH = /^[–—]$/;

/** Ersetzt typografische Anführungszeichen durch gerade. */
export function normalizeQuotes(text: string): string {
  return text.replace(SINGLE_QUOTES, "'").replace(DOUBLE_QUOTES, '"');
}

/** Eingefügter Text (Zwischenablage): Anführungszeichen gerade, Gedankenstriche zu `--`. */
export function normalizePasted(text: string): string {
  return normalizeQuotes(text).replace(DASHES, '--');
}

/** Eine einzelne Änderung beim Tippen. */
export interface TypedChange {
  /** Eingefügter Text. */
  inserted: string;
  /** Text, den die Änderung ersetzt. */
  replaced: string;
  /** Zeichen direkt vor dem ersetzten Bereich (oder `''`). */
  before: string;
}

/** Ergebnis: neuer Text und um wie viele Zeichen der Bereich nach links wächst. */
export interface TypedFix {
  text: string;
  extendBack: number;
}

/**
 * Korrigiert eine getippte Änderung. Gedankenstriche werden nur zurückgewandelt,
 * wenn sie als Ersatz für `--` entstanden sind: iPadOS ersetzt beim zweiten `-`
 * das erste durch `—` (oder fügt `—` direkt hinter einem `-` ein).
 * Liefert `null`, wenn nichts zu tun ist.
 */
export function fixTypedChange(change: TypedChange): TypedFix | null {
  const { inserted, replaced, before } = change;
  if (SINGLE_DASH.test(inserted)) {
    if (replaced === '-' || replaced === '--') return { text: '--', extendBack: 0 };
    if (replaced === '' && before === '-') return { text: '--', extendBack: 1 };
    return null;
  }
  const text = normalizeQuotes(inserted);
  return text === inserted ? null : { text, extendBack: 0 };
}

/** Transaktionsfilter für getippten Text (auch Autokorrektur-Ersetzungen). */
const typedFilter = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged || !tr.isUserEvent('input') || tr.isUserEvent('input.paste')) return tr;
  const specs: ChangeSpec[] = [];
  let modified = false;
  tr.changes.iterChanges((fromA, toA, _fromB, _toB, insertedText) => {
    const inserted = insertedText.toString();
    const fix = fixTypedChange({
      inserted,
      replaced: tr.startState.sliceDoc(fromA, toA),
      before: fromA > 0 ? tr.startState.sliceDoc(fromA - 1, fromA) : '',
    });
    if (fix) modified = true;
    specs.push({
      from: fromA - (fix?.extendBack ?? 0),
      to: toA,
      insert: fix ? fix.text : inserted,
    });
  });
  if (!modified) return tr;
  const changes = ChangeSet.of(specs, tr.startState.doc.length);
  return {
    changes,
    selection: tr.startState.selection.map(changes, 1),
    userEvent: tr.annotation(Transaction.userEvent) ?? 'input.type',
    scrollIntoView: true,
  };
});

/** Alles zusammen: Filter fürs Tippen, Filter für die Zwischenablage. */
export function smartPunctuationFix(): Extension {
  return [typedFilter, EditorView.clipboardInputFilter.of((text) => normalizePasted(text))];
}
