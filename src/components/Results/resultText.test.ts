import { describe, expect, it } from 'vitest';
import { cellText, ddlMessage, summaryText } from './resultText';

describe('components/Results/resultText', () => {
  it('benennt DDL-Statements nach Objekt und Name', () => {
    expect(ddlMessage('CREATE TABLE notiz (id INTEGER);', 'CREATE')).toBe(
      'Tabelle «notiz» erstellt',
    );
    expect(ddlMessage('-- Kommentar\n  drop table if exists "alte Liste";', 'DROP')).toBe(
      'Tabelle «alte Liste» gelöscht',
    );
    expect(ddlMessage('ALTER TABLE song ADD COLUMN x;', 'ALTER')).toBe('Tabelle «song» geändert');
    expect(ddlMessage('CREATE UNIQUE INDEX idx_a ON song(titel);', 'CREATE')).toBe(
      'Index «idx_a» erstellt',
    );
    expect(ddlMessage('CREATE TEMP VIEW v AS SELECT 1;', 'CREATE')).toBe('Sicht «v» erstellt');
    expect(ddlMessage('VACUUM;', 'OTHER')).toBe('Ausgeführt');
  });

  it('fasst Resultate zusammen', () => {
    const base = { sql: 'x', ms: 1, range: [0, 1] as [number, number] };
    expect(summaryText({ ...base, kind: 'changes', changes: 1 })).toBe('1 Zeile geändert');
    expect(summaryText({ ...base, kind: 'changes', changes: 3 })).toBe('3 Zeilen geändert');
    expect(summaryText({ ...base, kind: 'ok' })).toBe('Ausgeführt');
    expect(
      summaryText({ ...base, kind: 'rows', columns: ['a'], rows: [[1]], truncated: false }),
    ).toBe('1 Zeile');
    const many = Array.from({ length: 1000 }, (_, i) => [i]);
    expect(
      summaryText({ ...base, kind: 'rows', columns: ['a'], rows: many, truncated: true }),
    ).toBe('Mehr als 1000 Zeilen');
  });

  it('stellt NULL und BLOB dar', () => {
    expect(cellText(null)).toBe('NULL');
    expect(cellText(new Uint8Array(12))).toBe('BLOB (12 Bytes)');
    expect(cellText(3.5)).toBe('3.5');
    expect(cellText('Rock')).toBe('Rock');
  });
});
