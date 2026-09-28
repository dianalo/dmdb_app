import { describe, expect, it } from 'vitest';
import { isNameTaken, nameFromFilename, uniqueName } from './names';

describe('names', () => {
  it('erkennt vergebene Namen ohne Gross-/Kleinschreibung und Leerzeichen', () => {
    expect(isNameTaken('  schule ', ['Schule'])).toBe(true);
    expect(isNameTaken('Schule 2', ['Schule'])).toBe(false);
    expect(isNameTaken('x', [])).toBe(false);
  });

  it('macht Namen mit « (2)», « (3)» eindeutig', () => {
    expect(uniqueName('Schule', [])).toBe('Schule');
    expect(uniqueName(' Schule ', ['Musik'])).toBe('Schule');
    expect(uniqueName('Schule', ['Schule'])).toBe('Schule (2)');
    expect(uniqueName('Schule', ['schule', 'Schule (2)'])).toBe('Schule (3)');
  });

  it('leitet Namen aus Dateinamen ab', () => {
    expect(nameFromFilename('schule.sqlite', 'X')).toBe('schule');
    expect(nameFromFilename('Übung K4.sql', 'X')).toBe('Übung K4');
    expect(nameFromFilename('archiv.tar.db', 'X')).toBe('archiv.tar');
    expect(nameFromFilename('ohne-endung', 'X')).toBe('ohne-endung');
    expect(nameFromFilename('C:\\Users\\a\\b.sqlite3', 'X')).toBe('b');
    expect(nameFromFilename('.sqlite', 'X')).toBe('X');
    expect(nameFromFilename('', 'X')).toBe('X');
  });
});
