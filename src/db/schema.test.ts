import { beforeEach, describe, expect, it } from 'vitest';
import type { Database } from 'sql.js';
import {
  columnNames,
  errorContext,
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

  it('meldet eine unbekannte Tabelle in der Sprache von SQLite', () => {
    expect(() => tableInfo(db, 'nixda')).toThrow('no such table: nixda');
    expect(tableDdl(db, 'nixda')).toBe('');
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
