import { beforeEach, describe, expect, it } from 'vitest';
import type { Database } from 'sql.js';
import { runScript } from './runScript';
import { errorContext } from './schema';
import { ROW_CAP } from './types';
import type { StatementResult } from './types';
import { createTestDb } from './testUtils';

let db: Database;

const run = (sql: string, offset = 0) => runScript(db, sql, errorContext(db), offset);

/** Bequemer Zugriff mit Typwissen, damit die Tests ohne Casts lesbar bleiben. */
function at<K extends StatementResult['kind']>(
  results: StatementResult[],
  index: number,
  kind: K,
): Extract<StatementResult, { kind: K }> {
  const result = results[index];
  expect(result?.kind).toBe(kind);
  return result as Extract<StatementResult, { kind: K }>;
}

beforeEach(async () => {
  db = await createTestDb();
});

describe('runScript: Zerlegung in Statements', () => {
  it('liefert für leere Eingabe kein Resultat', () => {
    expect(run('')).toEqual({ results: [], dirty: false });
    expect(run('   \n\t ')).toEqual({ results: [], dirty: false });
  });

  it('liefert für reine Kommentare kein Resultat', () => {
    const outcome = run('-- nur ein Kommentar\n/* und ein Block */\n');
    expect(outcome).toEqual({ results: [], dirty: false });
  });

  it('behandelt Semikolon in Strings und Kommentaren als Text', () => {
    const outcome = run(
      "SELECT 'a;b' AS x; -- kommentar; mit semikolon\n/* auch; hier */ SELECT 2 AS y;",
    );
    expect(outcome.results).toHaveLength(2);
    expect(at(outcome.results, 0, 'rows').rows).toEqual([['a;b']]);
    expect(at(outcome.results, 1, 'rows').rows).toEqual([[2]]);
    expect(outcome.dirty).toBe(false);
  });

  it('meldet Zeichenbereiche im Quelltext und addiert den Offset', () => {
    const sql = 'SELECT 1;\nSELECT 2;';
    const plain = run(sql);
    const first = at(plain.results, 0, 'rows');
    const second = at(plain.results, 1, 'rows');
    expect(sql.slice(first.range[0], first.range[1])).toBe('SELECT 1;');
    expect(sql.slice(second.range[0], second.range[1])).toBe('SELECT 2;');

    const shifted = run(sql, 100);
    expect(at(shifted.results, 0, 'rows').range).toEqual([
      100 + first.range[0],
      100 + first.range[1],
    ]);
    expect(at(shifted.results, 1, 'rows').range).toEqual([
      100 + second.range[0],
      100 + second.range[1],
    ]);
  });
});

describe('runScript: Klassifikation', () => {
  it('erkennt Resultatmengen', () => {
    expect(at(run('SELECT titel FROM song;').results, 0, 'rows').columns).toEqual(['titel']);
    expect(at(run('WITH x AS (SELECT 1 AS a) SELECT a FROM x;').results, 0, 'rows').rows).toEqual([
      [1],
    ]);
    expect(at(run('VALUES (1, 2);').results, 0, 'rows').rows).toEqual([[1, 2]]);
    const pragma = at(run('PRAGMA table_info(song);').results, 0, 'rows');
    expect(pragma.columns).toContain('name');
    expect(pragma.rows.length).toBe(4);
  });

  it('meldet bei DML die Zahl der geänderten Zeilen', () => {
    const insert = run("INSERT INTO kuenstler (id, name) VALUES (9, 'Neu');");
    expect(at(insert.results, 0, 'changes').changes).toBe(1);
    expect(insert.dirty).toBe(true);

    const update = run('UPDATE song SET titel = titel WHERE album_id = 1;');
    expect(at(update.results, 0, 'changes').changes).toBe(2);

    const del = run('DELETE FROM bewertung WHERE nutzer_id = 1;');
    expect(at(del.results, 0, 'changes').changes).toBe(2);
  });

  it('zeigt auch «0 Zeilen geändert» an und meldet den Lauf dann nicht als dirty', () => {
    const outcome = run('DELETE FROM song WHERE id = 9999;');
    expect(at(outcome.results, 0, 'changes').changes).toBe(0);
    expect(outcome.dirty).toBe(false);
  });

  it('erkennt DDL am geänderten Schema und nennt das Verb', () => {
    const created = run('CREATE TABLE tmp (a INTEGER);');
    expect(at(created.results, 0, 'ddl').verb).toBe('CREATE');
    expect(created.dirty).toBe(true);

    expect(at(run('ALTER TABLE tmp ADD COLUMN b TEXT;').results, 0, 'ddl').verb).toBe('ALTER');
    expect(at(run('DROP TABLE tmp;').results, 0, 'ddl').verb).toBe('DROP');
  });

  it('lässt getRowsModified nicht in DDL-Resultate durchsickern', () => {
    const outcome = run(
      "INSERT INTO kuenstler (id, name) VALUES (7, 'A'); CREATE TABLE tmp2 (a INTEGER);",
    );
    expect(at(outcome.results, 0, 'changes').changes).toBe(1);
    const ddl = at(outcome.results, 1, 'ddl');
    expect(ddl).not.toHaveProperty('changes');
    expect(ddl.verb).toBe('CREATE');
  });

  it('klassifiziert eine PRAGMA-Zuweisung als «OK» ohne dirty', () => {
    const outcome = run('PRAGMA foreign_keys = OFF;');
    expect(at(outcome.results, 0, 'ok').sql).toBe('PRAGMA foreign_keys = OFF;');
    expect(outcome.dirty).toBe(false);
  });

  it('erkennt WITH … DELETE als schreibend, WITH … SELECT nicht', () => {
    const reading = run('WITH x AS (SELECT id FROM song WHERE id = 1) SELECT * FROM x;');
    expect(reading.dirty).toBe(false);

    const writing = run(
      'WITH alt AS (SELECT id FROM song WHERE dauer_sek > 300) DELETE FROM song WHERE id IN (SELECT id FROM alt);',
    );
    expect(at(writing.results, 0, 'changes').changes).toBe(1);
    expect(writing.dirty).toBe(true);
  });

  it('liefert bei INSERT … RETURNING Zeilen und meldet den Lauf als dirty', () => {
    const outcome = run(
      "INSERT INTO kuenstler (id, name) VALUES (42, 'Rueckgabe') RETURNING id, name;",
    );
    const rows = at(outcome.results, 0, 'rows');
    expect(rows.rows).toEqual([[42, 'Rueckgabe']]);
    expect(outcome.dirty).toBe(true);
  });
});

describe('runScript: Grenzen und Fehler', () => {
  it('begrenzt Resultatmengen auf ROW_CAP und meldet die Kürzung', () => {
    const outcome = run(
      'WITH RECURSIVE zahlen(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM zahlen WHERE n < 5000) SELECT n FROM zahlen;',
    );
    const rows = at(outcome.results, 0, 'rows');
    expect(rows.rows).toHaveLength(ROW_CAP);
    expect(rows.truncated).toBe(true);
    expect(rows.rows[0]).toEqual([1]);
  });

  it('meldet keine Kürzung, wenn das Resultat genau passt', () => {
    const outcome = run('SELECT id FROM song;');
    expect(at(outcome.results, 0, 'rows').truncated).toBe(false);
  });

  it('stoppt beim ersten Fehler, behält frühere Statements und nennt das Statement', () => {
    const sql = [
      "INSERT INTO kuenstler (id, name) VALUES (3, 'Drei');",
      'SELECT * FROM nixda;',
      "INSERT INTO kuenstler (id, name) VALUES (4, 'Vier');",
    ].join('\n');
    const outcome = run(sql);

    expect(outcome.results).toHaveLength(2);
    expect(at(outcome.results, 0, 'changes').changes).toBe(1);
    const failure = at(outcome.results, 1, 'error');
    expect(failure.sql).toContain('nixda');
    expect(failure.sql).not.toContain('Vier');
    expect(failure.error.title).toBe('Die Tabelle «nixda» existiert nicht.');
    expect(failure.error.original).toBe('no such table: nixda');
    expect(sql.slice(failure.range[0], failure.range[1])).toBe('SELECT * FROM nixda;');
    expect(outcome.dirty).toBe(true);

    // Das erste Statement ist wirksam geblieben, das dritte wurde nie ausgeführt.
    const check = run('SELECT id FROM kuenstler WHERE id IN (3, 4);');
    expect(at(check.results, 0, 'rows').rows).toEqual([[3]]);
  });

  it('meldet Laufzeitfehler mit dem Bereich des auslösenden Statements', () => {
    const sql = "SELECT 1;\nINSERT INTO kuenstler (id, name) VALUES (1, 'Doppelt');";
    const outcome = run(sql);
    const failure = at(outcome.results, 1, 'error');
    expect(failure.error.original).toBe('UNIQUE constraint failed: kuenstler.id');
    expect(sql.slice(failure.range[0], failure.range[1])).toContain('Doppelt');
  });

  it('schaltet die Fremdschlüssel vor jedem Lauf wieder ein', () => {
    run('PRAGMA foreign_keys = OFF;');
    const outcome = run('DELETE FROM album WHERE id = 1;');
    expect(at(outcome.results, 0, 'error').error.original).toBe('FOREIGN KEY constraint failed');
  });
});
