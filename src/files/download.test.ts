import { describe, expect, it } from 'vitest';
import { SQLITE_MIME, SQL_TEXT_MIME, sanitizeFilename } from './download';

// Die eigentliche Download-Funktion braucht `document` und `URL.createObjectURL`;
// beides gibt es in der Node-Umgebung nicht. Sie ist deshalb absichtlich dünn
// gehalten und wird im Playwright-Smoke-Test abgedeckt.

describe('files/download: sanitizeFilename', () => {
  it('behält gewöhnliche Namen samt Endung', () => {
    expect(sanitizeFilename('musik-streaming.sqlite')).toBe('musik-streaming.sqlite');
  });

  it('behält Umlaute und Guillemets-freie Sonderzeichen', () => {
    expect(sanitizeFilename('Küche & Müsli (Übung 3).sql')).toBe('Küche & Müsli (Übung 3).sql');
  });

  it('entfernt Pfadtrenner', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('etcpasswd');
    expect(sanitizeFilename('C:\\Temp\\db.sqlite')).toBe('CTempdb.sqlite');
  });

  it('entfernt Steuerzeichen und auf Windows verbotene Zeichen', () => {
    expect(sanitizeFilename('a\u0000b\nc\td?e*f"g<h>i|j')).toBe('abcdefghij');
  });

  it('macht aus leerem oder unbrauchbarem Namen «unbenannt»', () => {
    expect(sanitizeFilename('')).toBe('unbenannt');
    expect(sanitizeFilename('   ')).toBe('unbenannt');
    expect(sanitizeFilename('///')).toBe('unbenannt');
    expect(sanitizeFilename('..')).toBe('unbenannt');
  });

  it('kürzt sehr lange Namen', () => {
    expect(sanitizeFilename('x'.repeat(500))).toHaveLength(120);
  });

  it('nennt die erwarteten MIME-Typen', () => {
    expect(SQLITE_MIME).toBe('application/vnd.sqlite3');
    expect(SQL_TEXT_MIME).toBe('text/plain;charset=utf-8');
  });
});
