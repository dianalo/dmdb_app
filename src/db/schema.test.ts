import { beforeEach, describe, expect, it } from 'vitest';
import type { Database } from 'sql.js';
import {
  columnNames,
  errorContext,
  formatDdl,
  listTables,
  quoteIdent,
  rowCount,
  tableDdl,
  tableInfo,
} from './schema';
import { createTestDb } from './testUtils';

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
});

describe('quoteIdent', () => {
  it('setzt Bezeichner in doppelte Anführungszeichen', () => {
    expect(quoteIdent('song')).toBe('"song"');
  });

  it('verdoppelt enthaltene Anführungszeichen', () => {
    expect(quoteIdent('mein"tisch')).toBe('"mein""tisch"');
  });
});

describe('listTables', () => {
  it('liefert die Tabellen alphabetisch', () => {
    expect(listTables(db)).toEqual(['album', 'bewertung', 'kuenstler', 'song']);
  });

  it('lässt interne sqlite-Tabellen weg', () => {
    db.run(
      'CREATE TABLE zaehler (id INTEGER PRIMARY KEY AUTOINCREMENT); INSERT INTO zaehler DEFAULT VALUES;',
    );
    expect(listTables(db)).toContain('zaehler');
    expect(listTables(db).some((name) => name.startsWith('sqlite_'))).toBe(false);
  });
});

describe('tableInfo', () => {
  it('liefert Spalten, Flags und Zeilenzahl', () => {
    const info = tableInfo(db, 'album');
    expect(info.name).toBe('album');
    expect(info.rowCount).toBe(2);
    expect(info.columns).toEqual([
      { name: 'id', type: 'INTEGER', notNull: false, primaryKey: true, defaultValue: null },
      { name: 'titel', type: 'TEXT', notNull: true, primaryKey: false, defaultValue: null },
      {
        name: 'kuenstler_id',
        type: 'INTEGER',
        notNull: true,
        primaryKey: false,
        defaultValue: null,
      },
      { name: 'jahr', type: 'INTEGER', notNull: false, primaryKey: false, defaultValue: null },
    ]);
  });

  it('markiert bei zusammengesetzten Schlüsseln alle Spalten des Schlüssels', () => {
    const info = tableInfo(db, 'bewertung');
    const keys = info.columns.filter((column) => column.primaryKey).map((column) => column.name);
    expect(keys).toEqual(['nutzer_id', 'song_id']);
  });

  it('liefert Standardwerte als Text', () => {
    db.run("CREATE TABLE test (a INTEGER DEFAULT 5, b TEXT DEFAULT 'x')");
    const info = tableInfo(db, 'test');
    expect(info.columns.map((column) => column.defaultValue)).toEqual(['5', "'x'"]);
  });

  it('gibt die DDL verbatim aus sqlite_master zurück', () => {
    const { ddl } = tableInfo(db, 'song');
    expect(ddl).toContain('CREATE TABLE song');
    expect(ddl).toContain('dauer_sek INTEGER');
    expect(ddl).toContain('FOREIGN KEY (album_id) REFERENCES album(id)');
    expect(ddl.split('\n').length).toBeGreaterThan(1);
  });

  it('zeigt mit ALTER TABLE hinzugefügte Spalten auf eigenen Zeilen', () => {
    db.run(`CREATE TABLE t (
  id INTEGER PRIMARY KEY,
  name TEXT,
  FOREIGN KEY (id) REFERENCES t(id)
)`);
    db.run('ALTER TABLE t ADD COLUMN x INTEGER');
    db.run("ALTER TABLE t ADD COLUMN y TEXT DEFAULT 'a, b'");
    expect(tableDdl(db, 't')).toBe(`CREATE TABLE t (
  id INTEGER PRIMARY KEY,
  name TEXT,
  x INTEGER,
  y TEXT DEFAULT 'a, b',
  FOREIGN KEY (id) REFERENCES t(id)
)`);
  });

  it('meldet eine unbekannte Tabelle in der Sprache von SQLite', () => {
    expect(() => tableInfo(db, 'nixda')).toThrow('no such table: nixda');
    expect(tableDdl(db, 'nixda')).toBe('');
  });
});

describe('formatDdl', () => {
  it('lässt einzeilige DDL unverändert', () => {
    const ddl = 'CREATE TABLE t (a INT, b INT)';
    expect(formatDdl(ddl)).toBe(ddl);
  });

  it('bricht nicht in Klammern, Strings, Bezeichnern und Kommentaren um', () => {
    const ddl = `CREATE TABLE t (
  a NUMERIC(10, 2) CHECK (a IN (1, 2)), -- eins, zwei
  "b, c" TEXT DEFAULT 'x, y' /* d, e */
)`;
    expect(formatDdl(ddl)).toBe(ddl);
  });

  it('übernimmt die Einrückung der Zeile', () => {
    expect(formatDdl('CREATE TABLE t (\n    a INT, b INT\n)')).toBe(
      'CREATE TABLE t (\n    a INT,\n    b INT\n)',
    );
  });
});

describe('errorContext', () => {
  it('sammelt Tabellen und Spalten für die Fehlervorschläge', () => {
    const ctx = errorContext(db);
    expect(ctx.tables).toEqual(['album', 'bewertung', 'kuenstler', 'song']);
    expect(ctx.columns['song']).toEqual(['id', 'titel', 'album_id', 'dauer_sek']);
    expect(Object.keys(ctx.columns)).toHaveLength(4);
  });
});

describe('rowCount und columnNames', () => {
  it('zählt Zeilen und nennt Spalten', () => {
    expect(rowCount(db, 'song')).toBe(4);
    expect(columnNames(db, 'kuenstler')).toEqual(['id', 'name', 'land']);
  });
});
