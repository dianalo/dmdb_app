import { beforeEach, describe, expect, it } from 'vitest';
import type { Database } from 'sql.js';
import { escapeLike, pageTable } from './browse';
import { createTestDb } from './testUtils';

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
});

describe('pageTable: Grundlagen', () => {
  it('liefert Spalten, Zeilen und die Gesamtzahl', () => {
    const page = pageTable(db, { table: 'song', offset: 0, limit: 200 });
    expect(page.columns).toEqual(['id', 'titel', 'album_id', 'dauer_sek']);
    expect(page.rows).toHaveLength(4);
    expect(page.total).toBe(4);
  });

  it('beachtet limit und offset, ohne total zu verändern', () => {
    const page = pageTable(db, { table: 'song', offset: 2, limit: 2 });
    expect(page.rows.map((row) => row[0])).toEqual([3, 4]);
    expect(page.total).toBe(4);
  });

  it('meldet eine unbekannte Tabelle in der Sprache von SQLite', () => {
    expect(() => pageTable(db, { table: 'nixda', offset: 0, limit: 10 })).toThrow(
      'no such table: nixda',
    );
  });
});

describe('pageTable: Sortierung', () => {
  it('sortiert aufsteigend und absteigend', () => {
    const asc = pageTable(db, {
      table: 'song',
      sort: { column: 'dauer_sek', dir: 'asc' },
      offset: 0,
      limit: 10,
    });
    expect(asc.rows.map((row) => row[3])).toEqual([150, 184, 212, 301]);

    const desc = pageTable(db, {
      table: 'song',
      sort: { column: 'dauer_sek', dir: 'desc' },
      offset: 0,
      limit: 10,
    });
    expect(desc.rows.map((row) => row[3])).toEqual([301, 212, 184, 150]);
  });

  it('ignoriert eine unbekannte Sortierspalte, statt einen Fehler zu werfen', () => {
    const page = pageTable(db, {
      table: 'song',
      sort: { column: 'gibtsnicht; DROP TABLE song', dir: 'asc' },
      offset: 0,
      limit: 10,
    });
    expect(page.rows.map((row) => row[0])).toEqual([1, 2, 3, 4]);
    expect(page.total).toBe(4);
  });
});

describe('pageTable: Suche', () => {
  it('sucht über alle Spalten', () => {
    const page = pageTable(db, { table: 'song', filter: 'Nacht', offset: 0, limit: 10 });
    expect(page.rows.map((row) => row[1])).toEqual(['Nacht ohne Ende']);
    expect(page.total).toBe(1);
  });

  it('findet auch Zahlen, weil alle Spalten als Text verglichen werden', () => {
    const page = pageTable(db, { table: 'song', filter: '301', offset: 0, limit: 10 });
    expect(page.total).toBe(1);
    expect(page.rows[0]?.[1]).toBe('Nacht ohne Ende');
  });

  it('behandelt % und _ in der Eingabe als normale Zeichen', () => {
    const prozent = pageTable(db, { table: 'song', filter: '100%', offset: 0, limit: 10 });
    expect(prozent.total).toBe(1);
    expect(prozent.rows[0]?.[1]).toBe('100% Gefuehl');

    const nurProzent = pageTable(db, { table: 'song', filter: '%', offset: 0, limit: 10 });
    expect(nurProzent.total).toBe(1);

    const unterstrich = pageTable(db, { table: 'song', filter: '_', offset: 0, limit: 10 });
    expect(unterstrich.total).toBe(0);
  });

  it('kombiniert Suche, Sortierung und Seitengrösse und zählt die Treffer gesamthaft', () => {
    const page = pageTable(db, {
      table: 'song',
      filter: 'e',
      sort: { column: 'titel', dir: 'asc' },
      offset: 1,
      limit: 1,
    });
    expect(page.total).toBe(3); // «Nordwind» enthält kein e.
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]?.[1]).toBe('Liebe im Schnee');
  });

  it('ignoriert eine leere Suche', () => {
    const page = pageTable(db, { table: 'song', filter: '   ', offset: 0, limit: 10 });
    expect(page.total).toBe(4);
  });

  it('escapeLike entwertet die Platzhalter', () => {
    expect(escapeLike('100%')).toBe('100\\%');
    expect(escapeLike('a_b')).toBe('a\\_b');
    expect(escapeLike('c\\d')).toBe('c\\\\d');
  });
});
