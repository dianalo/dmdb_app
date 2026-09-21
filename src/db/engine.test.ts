import { beforeEach, describe, expect, it } from 'vitest';
import type { SqlJsStatic } from 'sql.js';
import { createEngine } from './engine';
import type { Engine } from './engine';
import { SqlError } from './errors/translate';
import type { StatementResult } from './types';
import { TEST_SCHEMA, loadTestSqlJs } from './testUtils';

let SQL: SqlJsStatic;
let engine: Engine;

/** Erstes Resultat eines Laufs, mit geprüfter Art. */
function only<K extends StatementResult['kind']>(
  results: StatementResult[],
  kind: K,
): Extract<StatementResult, { kind: K }> {
  expect(results).toHaveLength(1);
  expect(results[0]?.kind).toBe(kind);
  return results[0] as Extract<StatementResult, { kind: K }>;
}

beforeEach(async () => {
  SQL = await loadTestSqlJs();
  engine = createEngine(SQL);
  await engine.openFromSql(TEST_SCHEMA);
});

describe('Engine: Lebenszyklus', () => {
  it('ist erst nach dem Öffnen offen und danach wieder zu', async () => {
    const fresh = createEngine(SQL);
    expect(fresh.isOpen()).toBe(false);
    await fresh.open();
    expect(fresh.isOpen()).toBe(true);
    await fresh.close();
    expect(fresh.isOpen()).toBe(false);
  });

  it('wirft ohne offene Datenbank einen übersetzten Fehler', async () => {
    const fresh = createEngine(SQL);
    await expect(fresh.listTables()).rejects.toBeInstanceOf(SqlError);
  });

  it('lässt nach einem fehlerhaften DDL-Script keine Datenbank offen', async () => {
    const fresh = createEngine(SQL);
    let caught: unknown;
    try {
      await fresh.openFromSql('CREATE TABLE ok (a INTEGER); CREATE TABEL kaputt (b INTEGER);');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SqlError);
    expect((caught as SqlError).translated.title).toContain('Syntaxfehler');
    expect((caught as SqlError).translated.original).toContain('syntax error');
    expect(fresh.isOpen()).toBe(false);
  });

  it('listet Tabellen, Spalten und die Zeilenzahl', async () => {
    expect(await engine.listTables()).toEqual(['album', 'bewertung', 'kuenstler', 'song']);
    const info = await engine.tableInfo('song');
    expect(info.rowCount).toBe(4);
    expect(info.columns.map((column) => column.name)).toEqual([
      'id',
      'titel',
      'album_id',
      'dauer_sek',
    ]);
    expect(await engine.integrityCheck()).toBe(true);
  });
});

describe('Engine: snapshot', () => {
  it('hält PRAGMA foreign_keys vor und nach dem Export aktiv', async () => {
    const before = await engine.run('DELETE FROM kuenstler WHERE id = 1;');
    expect(only(before.results, 'error').error.original).toBe('FOREIGN KEY constraint failed');

    await engine.snapshot(); // export() schliesst die Verbindung und verliert alle PRAGMAs.

    const after = await engine.run('DELETE FROM kuenstler WHERE id = 1;');
    expect(only(after.results, 'error').error.original).toBe('FOREIGN KEY constraint failed');
  });

  it('liefert Bytes, aus denen eine frische Engine dieselben Daten liest', async () => {
    await engine.run("INSERT INTO kuenstler (id, name, land) VALUES (3, 'Drittes', 'Italien');");
    const bytes = await engine.snapshot();

    const restored = createEngine(SQL);
    await restored.open(bytes);
    const page = await restored.pageTable({ table: 'kuenstler', offset: 0, limit: 10 });
    expect(page.total).toBe(3);
    expect(page.rows).toEqual([
      [1, 'Nordlicht', 'Schweiz'],
      [2, 'Blaue Stunde', 'Deutschland'],
      [3, 'Drittes', 'Italien'],
    ]);
    // Auch die wiederhergestellte Datenbank achtet auf die Fremdschlüssel.
    const outcome = await restored.run('DELETE FROM kuenstler WHERE id = 1;');
    expect(only(outcome.results, 'error').error.original).toBe('FOREIGN KEY constraint failed');
  });

  it('verweigert den Export bei offener Transaktion mit einem übersetzten Fehler', async () => {
    await engine.run('BEGIN;');
    let caught: unknown;
    try {
      await engine.snapshot();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SqlError);
    expect((caught as SqlError).translated.original).toContain('within a transaction');
    await engine.run('ROLLBACK;');
    await expect(engine.snapshot()).resolves.toBeInstanceOf(Uint8Array);
  });
});

describe('Engine: recover', () => {
  it('öffnet nach einem Absturz den letzten Stand erneut', async () => {
    const bytes = await engine.snapshot();
    await engine.run('DELETE FROM bewertung;');
    expect((await engine.tableInfo('bewertung')).rowCount).toBe(0);

    await engine.recover(bytes);

    expect(engine.isOpen()).toBe(true);
    expect((await engine.tableInfo('bewertung')).rowCount).toBe(2);
    const outcome = await engine.run('DELETE FROM kuenstler WHERE id = 1;');
    expect(only(outcome.results, 'error').error.original).toBe('FOREIGN KEY constraint failed');
  });

  it('öffnet ohne Bytes eine leere Datenbank', async () => {
    await engine.recover();
    expect(await engine.listTables()).toEqual([]);
  });
});

describe('Engine: run', () => {
  it('meldet einen schreibenden Lauf als dirty und reicht den Offset durch', async () => {
    const outcome = await engine.run('UPDATE song SET dauer_sek = 200 WHERE id = 1;', 40);
    expect(only(outcome.results, 'changes').changes).toBe(1);
    expect(outcome.dirty).toBe(true);
    expect(only(outcome.results, 'changes').range[0]).toBe(40);
  });

  it('kennt beim Übersetzen die Tabellen der geöffneten Datenbank', async () => {
    const outcome = await engine.run('SELECT * FROM sng;');
    expect(only(outcome.results, 'error').error.suggestion).toBe('Meintest du «song»?');
  });
});
