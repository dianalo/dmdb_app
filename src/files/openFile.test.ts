import { describe, expect, it } from 'vitest';
import { readFileBytes, readFileText } from './openFile';

// `pickFile()` braucht `document` und einen echten Dateidialog; in der Node-Umgebung
// ist beides nicht verfügbar. Die Funktion bleibt deshalb dünn und wird manuell
// bzw. im Playwright-Smoke-Test geprüft. Die Lesehilfen sind hier abgedeckt.

describe('files/openFile', () => {
  it('liest eine Datei als Text', async () => {
    const file = new File(['SELECT * FROM song;'], 'kapitel3.sql', { type: 'text/plain' });
    await expect(readFileText(file)).resolves.toBe('SELECT * FROM song;');
  });

  it('liest eine Datei als Bytes', async () => {
    const bytes = new Uint8Array([0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x00, 0xff]);
    const file = new File([bytes], 'db.sqlite', { type: 'application/vnd.sqlite3' });

    const read = await readFileBytes(file);
    expect(read).toBeInstanceOf(Uint8Array);
    expect(Array.from(read)).toEqual(Array.from(bytes));
  });

  it('liest Umlaute als UTF-8', async () => {
    const file = new File(['-- Küche\nSELECT 1;'], 'ü.sql');
    await expect(readFileText(file)).resolves.toBe('-- Küche\nSELECT 1;');
  });
});
