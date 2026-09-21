import { beforeAll, describe, expect, it } from 'vitest';
import type { Database } from 'sql.js';
import { errorContext } from '../schema';
import type { ErrorContext } from '../types';
import { createTestDb } from '../testUtils';
import { translateError } from './translate';

let db: Database;
let ctx: ErrorContext;

/** Führt fehlerhaftes SQL wirklich aus, damit die Muster nie von SQLite abdriften. */
function messageOf(sql: string): string {
  try {
    db.exec(sql);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error(`Erwartet wurde ein SQLite-Fehler für: ${sql}`);
}

interface Case {
  name: string;
  sql: string;
  original: string;
  title: string;
  suggestion?: string;
  hint?: RegExp;
}

const cases: Case[] = [
  {
    name: 'no such table',
    sql: 'SELECT * FROM sng;',
    original: 'no such table: sng',
    title: 'Die Tabelle «sng» existiert nicht.',
    suggestion: 'Meintest du «song»?',
    hint: /Seitenleiste/,
  },
  {
    name: 'Tippfehler im Schlüsselwort',
    sql: 'SELET * FROM song;',
    original: 'near "SELET": syntax error',
    title: 'Syntaxfehler bei «SELET».',
    suggestion: 'Meintest du «SELECT»?',
  },
  {
    name: 'Tippfehler FORM statt FROM',
    sql: 'SELECT titel FORM song;',
    original: 'near "song": syntax error',
    title: 'Syntaxfehler bei «song».',
    hint: /Tippfehler/,
  },
  {
    name: 'Komma vor FROM',
    sql: 'SELECT titel, FROM song;',
    original: 'near "FROM": syntax error',
    title: 'Syntaxfehler bei «FROM».',
    hint: /Komma/,
  },
  {
    name: 'no such column',
    sql: 'SELECT nme FROM song;',
    original: 'no such column: nme',
    title: 'Die Spalte «nme» existiert nicht.',
    suggestion: 'Meintest du «name»?',
    hint: /einfache Anführungszeichen/,
  },
  {
    name: 'qualifizierte Spalte',
    sql: 'SELECT song.titl FROM song;',
    original: 'no such column: song.titl',
    title: 'Die Spalte «song.titl» existiert nicht.',
    suggestion: 'Meintest du «song.titel»?',
  },
  {
    name: 'typografische Anführungszeichen',
    sql: 'SELECT * FROM song WHERE titel = ’Rock’;',
    original: 'no such column: ’Rock’',
    title: 'Unbekanntes Zeichen bei «’Rock’».',
    suggestion: "Schreibe «'Rock'» statt «’Rock’».",
    hint: /Autokorrektur/,
  },
  {
    name: 'typografischer Gedankenstrich',
    sql: 'SELECT * FROM song WHERE dauer_sek — 1;',
    original: 'near "—": syntax error',
    title: 'Unbekanntes Zeichen bei «—».',
    suggestion: 'Schreibe «--» statt «—».',
  },
  {
    name: 'nicht geschlossener String',
    sql: "SELECT * FROM song WHERE titel = 'offen;",
    original: `unrecognized token: "'offen;"`,
    title: "Unbekanntes Zeichen bei «'offen;».",
    hint: /nicht geschlossen/,
  },
  {
    name: 'unvollständige Eingabe',
    sql: 'SELECT * FROM song WHERE (id = 1',
    original: 'incomplete input',
    title: 'Die Anweisung ist unvollständig.',
    hint: /Klammer/,
  },
  {
    name: 'mehrdeutige Spalte',
    sql: 'SELECT id FROM song JOIN album ON song.album_id = album.id;',
    original: 'ambiguous column name: id',
    title: 'Die Spalte «id» kommt in mehreren Tabellen vor.',
    hint: /album\.titel/,
  },
  {
    name: 'FOREIGN KEY',
    sql: 'DELETE FROM kuenstler WHERE id = 1;',
    original: 'FOREIGN KEY constraint failed',
    title: 'Die Verweise zwischen den Tabellen würden ungültig.',
    hint: /DELETE/,
  },
  {
    name: 'UNIQUE',
    sql: "INSERT INTO kuenstler (id, name) VALUES (1, 'Doppelt');",
    original: 'UNIQUE constraint failed: kuenstler.id',
    title: 'Der Wert in «kuenstler.id» ist schon vorhanden.',
    hint: /eindeutig/,
  },
  {
    name: 'zusammengesetzter Schlüssel',
    sql: 'INSERT INTO bewertung (nutzer_id, song_id, sterne) VALUES (1, 1, 4);',
    original: 'UNIQUE constraint failed: bewertung.nutzer_id, bewertung.song_id',
    title: 'Die Kombination aus «bewertung.nutzer_id» und «bewertung.song_id» gibt es schon.',
  },
  {
    name: 'NOT NULL',
    sql: 'INSERT INTO kuenstler (id, name) VALUES (50, NULL);',
    original: 'NOT NULL constraint failed: kuenstler.name',
    title: 'Die Spalte «kuenstler.name» darf nicht leer (NULL) sein.',
  },
  {
    name: 'CHECK',
    sql: 'INSERT INTO bewertung (nutzer_id, song_id, sterne) VALUES (2, 3, 9);',
    original: 'CHECK constraint failed: sterne BETWEEN 1 AND 5',
    title: 'Der Wert verletzt die Regel «sterne BETWEEN 1 AND 5».',
    hint: /Sterne/,
  },
  {
    name: 'zu wenige Werte',
    sql: "INSERT INTO kuenstler VALUES (60, 'Ohne Land');",
    original: 'table kuenstler has 3 columns but 2 values were supplied',
    title: 'Die Tabelle «kuenstler» hat 3 Spalten, du hast 2 Werte angegeben.',
  },
  {
    name: 'Werte passen nicht zur Spaltenliste',
    sql: "INSERT INTO kuenstler (id, name) VALUES (61, 'Zuviel', 'CH');",
    original: '3 values for 2 columns',
    title: 'Du hast 3 Werte für 2 Spalten angegeben.',
  },
  {
    name: 'unbekannte Funktion',
    sql: 'SELECT cout(*) FROM song;',
    original: 'no such function: cout',
    title: 'Die Funktion «cout» gibt es nicht.',
    suggestion: 'Meintest du «count»?',
  },
  {
    name: 'Aggregat am falschen Ort',
    sql: 'SELECT titel FROM song WHERE COUNT(*) > 1;',
    original: 'misuse of aggregate function COUNT()',
    title: 'Die Aggregatfunktion «COUNT()» steht am falschen Ort.',
    hint: /HAVING/,
  },
  {
    name: 'HAVING ohne GROUP BY',
    sql: 'SELECT titel FROM song HAVING dauer_sek > 1;',
    original: 'HAVING clause on a non-aggregate query',
    title: 'HAVING braucht eine Gruppierung davor.',
    hint: /WHERE/,
  },
  {
    name: 'Tabelle existiert bereits',
    sql: 'CREATE TABLE song (id INTEGER);',
    original: 'table song already exists',
    title: 'Die Tabelle «song» existiert bereits.',
    hint: /DROP TABLE song/,
  },
  {
    name: 'Datentyp passt nicht',
    sql: "INSERT INTO song (id, titel, album_id) VALUES ('abc', 'X', 1);",
    original: 'datatype mismatch',
    title: 'Der Datentyp passt nicht.',
    hint: /INTEGER PRIMARY KEY/,
  },
  {
    name: 'Transaktionszustand',
    sql: 'COMMIT;',
    original: 'cannot commit - no transaction is active',
    title: 'Der Transaktionsbefehl passt nicht zum Zustand.',
    hint: /BEGIN/,
  },
];

beforeAll(async () => {
  db = await createTestDb();
  ctx = errorContext(db);
});

describe('translateError: Regeln gegen echte SQLite-Meldungen', () => {
  it.each(cases)('$name', ({ sql, original, title, suggestion, hint }) => {
    const message = messageOf(sql);
    expect(message).toBe(original);

    const translated = translateError(message, ctx);
    expect(translated.title).toBe(title);
    expect(translated.original).toBe(original);
    if (suggestion === undefined) {
      expect(translated.suggestion).toBeUndefined();
    } else {
      expect(translated.suggestion).toBe(suggestion);
    }
    if (hint !== undefined) expect(translated.hint).toMatch(hint);
  });
});

describe('translateError: Sonderfälle', () => {
  it('meldet doppelte Anführungszeichen nicht als Fehler, SQLite auch nicht', () => {
    // «WHERE name = "Rock"» liefert kein Resultat, aber auch keinen Fehler.
    const result = db.exec('SELECT * FROM kuenstler WHERE name = "Rock";');
    expect(result).toEqual([]);
  });

  it('fällt bei unbekannten Meldungen auf einen neutralen Text zurück', () => {
    const translated = translateError('some unexpected sqlite failure', ctx);
    expect(translated.title).toBe('SQLite meldet einen Fehler.');
    expect(translated.original).toBe('some unexpected sqlite failure');
    expect(translated.hint).toBeDefined();
  });

  it('entfernt ein vorangestelltes «Error: » aus der Originalmeldung', () => {
    expect(translateError('Error: no such table: song').original).toBe('no such table: song');
  });

  it('schlägt ohne Schema-Kontext nichts vor, übersetzt aber trotzdem', () => {
    const translated = translateError('no such table: sng');
    expect(translated.title).toBe('Die Tabelle «sng» existiert nicht.');
    expect(translated.suggestion).toBeUndefined();
  });

  it('alle Texte sind in Schweizer Rechtschreibung', () => {
    for (const { sql } of cases) {
      const translated = translateError(messageOf(sql), ctx);
      const text = [translated.title, translated.hint ?? '', translated.suggestion ?? ''].join(' ');
      // Schweizer Rechtschreibung: das Eszett darf in keinem Text vorkommen.
      expect(text).not.toMatch(/ß/);
    }
  });
});
