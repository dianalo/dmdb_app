import { describe, expect, it } from 'vitest';
import { de } from './de';

/** Sammelt alle Texte, Funktionen werden mit Beispielwerten aufgerufen. */
function collect(value: unknown, path: string, out: { path: string; text: string }[]): void {
  if (typeof value === 'string') {
    out.push({ path, text: value });
  } else if (typeof value === 'function') {
    for (const sample of [1, 3, 'song']) {
      const text: unknown = (value as (arg: unknown) => unknown)(sample);
      if (typeof text === 'string') out.push({ path: `${path}(${String(sample)})`, text });
    }
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) collect(child, `${path}.${key}`, out);
  }
}

describe('i18n/de', () => {
  const texts: { path: string; text: string }[] = [];
  collect(de, 'de', texts);

  it('enthält Texte', () => {
    expect(texts.length).toBeGreaterThan(20);
  });

  it('verwendet Schweizer Rechtschreibung (kein «ß»)', () => {
    expect(texts.filter((t) => t.text.includes('ß'))).toEqual([]);
  });

  it('verwendet Guillemets statt typografischer oder gerader Anführungszeichen', () => {
    expect(texts.filter((t) => /[„“”"]/.test(t.text))).toEqual([]);
  });

  it('unterscheidet Einzahl und Mehrzahl', () => {
    expect(de.results.rows(1)).toBe('1 Zeile');
    expect(de.results.rows(300)).toBe('300 Zeilen');
    expect(de.results.changes(1)).toBe('1 Zeile geändert');
    expect(de.results.changes(0)).toBe('0 Zeilen geändert');
  });
});
