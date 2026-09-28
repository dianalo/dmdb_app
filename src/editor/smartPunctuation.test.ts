import { EditorSelection, EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import {
  fixTypedChange,
  normalizePasted,
  normalizeQuotes,
  smartPunctuationFix,
} from './smartPunctuation';

describe('editor/smartPunctuation', () => {
  it('wandelt typografische Anführungszeichen in gerade um', () => {
    expect(normalizeQuotes('WHERE name = ‘Rock’')).toBe("WHERE name = 'Rock'");
    expect(normalizeQuotes('SELECT “titel”, „x“')).toBe('SELECT "titel", "x"');
    expect(normalizeQuotes("schon 'gerade'")).toBe("schon 'gerade'");
  });

  it('wandelt beim Einfügen auch Gedankenstriche in -- um', () => {
    expect(normalizePasted('— Kommentar\nSELECT ‘a’;')).toBe("-- Kommentar\nSELECT 'a';");
    expect(normalizePasted('– x')).toBe('-- x');
  });

  it('korrigiert getippte Zeichen', () => {
    expect(fixTypedChange({ inserted: '’', replaced: '', before: 'x' })).toEqual({
      text: "'",
      extendBack: 0,
    });
    expect(fixTypedChange({ inserted: '“', replaced: '', before: '' })).toEqual({
      text: '"',
      extendBack: 0,
    });
    expect(fixTypedChange({ inserted: 'a', replaced: '', before: '' })).toBeNull();
  });

  it('wandelt Gedankenstriche nur als Ersatz für -- zurück', () => {
    // iPadOS ersetzt das erste «-» durch «—».
    expect(fixTypedChange({ inserted: '—', replaced: '-', before: ' ' })).toEqual({
      text: '--',
      extendBack: 0,
    });
    // Oder fügt «—» direkt nach einem «-» ein.
    expect(fixTypedChange({ inserted: '—', replaced: '', before: '-' })).toEqual({
      text: '--',
      extendBack: 1,
    });
    // Ein bewusst getippter Gedankenstrich bleibt.
    expect(fixTypedChange({ inserted: '–', replaced: '', before: 'A' })).toBeNull();
  });

  describe('Transaktionsfilter', () => {
    const make = (doc: string) =>
      EditorState.create({
        doc,
        selection: EditorSelection.cursor(doc.length),
        extensions: smartPunctuationFix(),
      });

    it('korrigiert getippte Anführungszeichen und setzt den Cursor dahinter', () => {
      const state = make("WHERE name = 'Rock");
      const next = state.update({
        changes: { from: state.doc.length, insert: '’' },
        selection: EditorSelection.cursor(state.doc.length + 1),
        userEvent: 'input.type',
      }).state;
      expect(next.doc.toString()).toBe("WHERE name = 'Rock'");
      expect(next.selection.main.head).toBe(next.doc.length);
    });

    it('macht aus — als Ersatz für - wieder --', () => {
      const state = make('SELECT 1; -');
      const end = state.doc.length;
      const next = state.update({
        changes: { from: end - 1, to: end, insert: '—' },
        userEvent: 'input.type',
      }).state;
      expect(next.doc.toString()).toBe('SELECT 1; --');
      expect(next.selection.main.head).toBe(next.doc.length);
    });

    it('lässt programmatische Änderungen in Ruhe', () => {
      const state = make('');
      const next = state.update({ changes: { from: 0, insert: '’' } }).state;
      expect(next.doc.toString()).toBe('’');
    });
  });
});
