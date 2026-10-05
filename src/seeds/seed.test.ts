import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs, { type Database } from 'sql.js';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { buildSeedSql, SEED_VERSION } from '../../scripts/generate-seed';
import { BUILTIN_DB_ID_PREFIX, builtinDbId, builtinSeeds, musikStreaming } from './index';

const SQL_DATEI = join(dirname(fileURLToPath(import.meta.url)), 'musik_streaming.sql');
const sql = readFileSync(SQL_DATEI, 'utf8');

let db: Database;

/** Erste Spalte der ersten Zeile als Zahl. */
function zahl(query: string): number {
  const [ergebnis] = db.exec(query);
  return Number(ergebnis?.values[0]?.[0]);
}

/** Erste Spalte aller Zeilen. */
function spalte(query: string): unknown[] {
  const [ergebnis] = db.exec(query);
  return (ergebnis?.values ?? []).map((zeile) => zeile[0]);
}

beforeAll(async () => {
  const SQL = await initSqlJs();
  db = new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
  db.exec(sql);
});

afterAll(() => {
  db?.close();
});

describe('Seed «k♪t Musik-Streaming»', () => {
  it('ist identisch mit der Ausgabe des Generators', () => {
    expect(buildSeedSql()).toBe(sql);
  });

  it('trägt den vorgeschriebenen Kopfkommentar', () => {
    expect(sql.startsWith('-- k♪t Musik-Streaming, Beispieldatenbank der LPU')).toBe(true);
    expect(sql).toContain('Nicht von Hand editieren.');
    expect(sql).toContain('kanti♪tunes');
    expect(sql).toContain('\nBEGIN;\n');
    expect(sql.trimEnd().endsWith('COMMIT;')).toBe(true);
  });

  it('wird von der Registry in der Version des Generators angeboten', async () => {
    expect(musikStreaming.id).toBe('musik-streaming');
    expect(musikStreaming.name).toBe('k♪t Musik-Streaming');
    expect(musikStreaming.version).toBe(SEED_VERSION);
    expect(await musikStreaming.loadSql()).toBe(sql);
    expect(builtinSeeds).toEqual([musikStreaming]);
    expect(builtinDbId(musikStreaming)).toBe(`${BUILTIN_DB_ID_PREFIX}musik-streaming`);
  });
});

describe('Integrität der Beispieldatenbank', () => {
  it('verletzt keine Fremdschlüssel', () => {
    expect(db.exec('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('besteht den integrity_check', () => {
    expect(spalte('PRAGMA integrity_check')).toEqual(['ok']);
  });

  it('bildet das Tabellenschema der LPU ab', () => {
    const spalten = (tabelle: string) => spalte(`SELECT name FROM pragma_table_info('${tabelle}')`);
    expect(spalten('kuenstler')).toEqual(['id', 'name', 'land', 'gruendungsjahr']);
    expect(spalten('album')).toEqual(['id', 'titel', 'erscheinungsjahr', 'kuenstler_id']);
    expect(spalten('song')).toEqual(['id', 'titel', 'dauer_sek', 'album_id']);
    expect(spalten('genre')).toEqual(['id', 'name']);
    expect(spalten('song_genre')).toEqual(['id', 'song_id', 'genre_id']);
    expect(spalten('nutzer')).toEqual(['id', 'benutzername', 'email', 'land', 'registriert_am']);
    expect(spalten('abo')).toEqual(['id', 'typ', 'preis', 'gueltig_bis', 'nutzer_id']);
    expect(spalten('playlist')).toEqual(['id', 'name', 'erstellt_am', 'nutzer_id']);
    expect(spalten('playlist_song')).toEqual([
      'id',
      'playlist_id',
      'song_id',
      'position',
      'hinzugefuegt_am',
    ]);
    expect(spalten('bewertung')).toEqual(['id', 'nutzer_id', 'song_id', 'sterne', 'datum']);
  });

  it('gibt jeder Tabelle genau eine Schlüsselspalte id (keine zusammengesetzten Schlüssel)', () => {
    const tabellen = spalte("SELECT name FROM sqlite_master WHERE type = 'table'");
    for (const tabelle of tabellen) {
      expect(spalte(`SELECT name FROM pragma_table_info('${tabelle}') WHERE pk > 0`)).toEqual([
        'id',
      ]);
    }
  });

  it('enthält jedes Paar in den Beziehungstabellen höchstens einmal', () => {
    const paare: readonly (readonly [string, string, string])[] = [
      ['song_genre', 'song_id', 'genre_id'],
      ['playlist_song', 'playlist_id', 'song_id'],
      ['bewertung', 'nutzer_id', 'song_id'],
    ];
    for (const [tabelle, a, b] of paare) {
      expect(
        zahl(`SELECT COUNT(*) FROM (SELECT ${a}, ${b} FROM ${tabelle} GROUP BY ${a}, ${b})`),
      ).toBe(zahl(`SELECT COUNT(*) FROM ${tabelle}`));
    }
  });

  it('legt alle zehn Tabellen an', () => {
    expect(spalte("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")).toEqual([
      'abo',
      'album',
      'bewertung',
      'genre',
      'kuenstler',
      'nutzer',
      'playlist',
      'playlist_song',
      'song',
      'song_genre',
    ]);
  });
});

describe('Umfang der Daten', () => {
  const bereiche: readonly (readonly [string, number, number])[] = [
    ['kuenstler', 15, 20],
    ['album', 30, 40],
    ['song', 200, 400],
    ['genre', 8, 10],
    ['nutzer', 20, 30],
    ['playlist', 40, 60],
  ];

  it.each(bereiche)('%s hat zwischen %i und %i Zeilen', (tabelle, min, max) => {
    const anzahl = zahl(`SELECT COUNT(*) FROM ${tabelle}`);
    expect(anzahl).toBeGreaterThanOrEqual(min);
    expect(anzahl).toBeLessThanOrEqual(max);
  });

  it('hat mindestens 400 Bewertungen', () => {
    expect(zahl('SELECT COUNT(*) FROM bewertung')).toBeGreaterThanOrEqual(400);
  });

  it.each([
    'kuenstler',
    'album',
    'song',
    'genre',
    'song_genre',
    'nutzer',
    'abo',
    'playlist',
    'playlist_song',
    'bewertung',
  ])('%s hat lückenlose ids ab 1', (tabelle) => {
    expect(zahl(`SELECT MIN(id) FROM ${tabelle}`)).toBe(1);
    expect(zahl(`SELECT MAX(id) FROM ${tabelle}`)).toBe(zahl(`SELECT COUNT(*) FROM ${tabelle}`));
  });
});

describe('Haken für die Aufgaben', () => {
  it('hat genau eine:n Künstler:in ohne Album (LEFT JOIN)', () => {
    expect(
      zahl(
        'SELECT COUNT(*) FROM kuenstler k LEFT JOIN album a ON a.kuenstler_id = k.id WHERE a.id IS NULL',
      ),
    ).toBe(1);
  });

  it('hat mindestens zwei Künstler:innen ohne gruendungsjahr (IS NULL)', () => {
    expect(
      zahl('SELECT COUNT(*) FROM kuenstler WHERE gruendungsjahr IS NULL'),
    ).toBeGreaterThanOrEqual(2);
  });

  it('hat genau eine:n Nutzer:in aus Liechtenstein (=)', () => {
    expect(zahl("SELECT COUNT(*) FROM nutzer WHERE land = 'Liechtenstein'")).toBe(1);
  });

  it.each(['Schweiz', 'Deutschland', 'Österreich', 'USA', 'UK', 'Frankreich', 'Italien'])(
    'hat mindestens eine:n kuenstler und nutzer aus %s',
    (land) => {
      expect(zahl(`SELECT COUNT(*) FROM kuenstler WHERE land = '${land}'`)).toBeGreaterThan(0);
      expect(zahl(`SELECT COUNT(*) FROM nutzer WHERE land = '${land}'`)).toBeGreaterThan(0);
    },
  );

  it('hat ein Album mit genau 12 Songs', () => {
    expect(
      zahl(
        'SELECT COUNT(*) FROM (SELECT album_id FROM song GROUP BY album_id HAVING COUNT(*) = 12)',
      ),
    ).toBeGreaterThanOrEqual(1);
  });

  it('hat die Playlist «Lange Nächte» mit 25 Songs', () => {
    expect(
      zahl(
        "SELECT COUNT(*) FROM playlist_song ps JOIN playlist p ON p.id = ps.playlist_id WHERE p.name = 'Lange Nächte'",
      ),
    ).toBe(25);
  });

  it('hat mindestens drei Songtitel mit Nacht, Love oder Liebe (LIKE)', () => {
    expect(
      zahl(`SELECT COUNT(*) FROM song
            WHERE LOWER(titel) LIKE '%nacht%'
               OR LOWER(titel) LIKE '%love%'
               OR LOWER(titel) LIKE '%liebe%'`),
    ).toBeGreaterThanOrEqual(3);
  });

  it('hat mindestens einen Songtitel in zwei verschiedenen Alben (DISTINCT)', () => {
    expect(
      zahl(`SELECT COUNT(*) FROM (
              SELECT titel FROM song GROUP BY titel HAVING COUNT(DISTINCT album_id) >= 2
            )`),
    ).toBeGreaterThanOrEqual(1);
  });
});

describe('Abo (1:1 zu nutzer)', () => {
  it('ordnet jeder nutzer_id höchstens ein Abo zu', () => {
    const anzahl = zahl('SELECT COUNT(*) FROM abo');
    expect(zahl('SELECT COUNT(DISTINCT nutzer_id) FROM abo')).toBe(anzahl);
    expect(anzahl).toBeGreaterThanOrEqual(15);
    expect(anzahl).toBeLessThan(zahl('SELECT COUNT(*) FROM nutzer'));
  });

  it('lässt mindestens drei Nutzer:innen ohne Abo (LEFT JOIN, IS NULL)', () => {
    expect(
      zahl(
        'SELECT COUNT(*) FROM nutzer n LEFT JOIN abo a ON a.nutzer_id = n.id WHERE a.id IS NULL',
      ),
    ).toBeGreaterThanOrEqual(3);
  });

  it('hat nur positive Preise mit genau einem Preis pro Typ', () => {
    expect(zahl('SELECT COUNT(*) FROM abo WHERE preis <= 0')).toBe(0);
    expect(
      zahl(
        'SELECT COUNT(*) FROM (SELECT typ FROM abo GROUP BY typ HAVING COUNT(DISTINCT preis) > 1)',
      ),
    ).toBe(0);
    expect(spalte('SELECT DISTINCT typ FROM abo ORDER BY typ')).toEqual([
      'Basic',
      'Familie',
      'Premium',
      'Student',
    ]);
  });

  it('speichert gueltig_bis als ISO-Datum, ein paar davon abgelaufen', () => {
    for (const wert of spalte('SELECT gueltig_bis FROM abo')) {
      expect(String(wert)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(
      zahl("SELECT COUNT(*) FROM abo WHERE gueltig_bis < '2026-09-01'"),
    ).toBeGreaterThanOrEqual(1);
    expect(zahl("SELECT COUNT(*) FROM abo WHERE gueltig_bis >= '2026-10-01'")).toBeGreaterThan(0);
    expect(
      zahl(`SELECT COUNT(*) FROM abo a JOIN nutzer n ON n.id = a.nutzer_id
            WHERE a.gueltig_bis < n.registriert_am`),
    ).toBe(0);
  });
});

describe('Fachliche Zusicherungen', () => {
  it('gibt jedem Song mindestens ein Genre', () => {
    expect(
      zahl(
        'SELECT COUNT(*) FROM song s WHERE NOT EXISTS (SELECT 1 FROM song_genre g WHERE g.song_id = s.id)',
      ),
    ).toBe(0);
  });

  it('nummeriert jede Playlist lückenlos ab 1', () => {
    expect(
      zahl(`SELECT COUNT(*) FROM (
              SELECT playlist_id FROM playlist_song
              GROUP BY playlist_id
              HAVING MIN(position) <> 1 OR MAX(position) <> COUNT(*)
            )`),
    ).toBe(0);
    expect(zahl('SELECT COUNT(DISTINCT playlist_id) FROM playlist_song')).toBe(
      zahl('SELECT COUNT(*) FROM playlist'),
    );
  });

  it('hält dauer_sek zwischen 95 und 420', () => {
    expect(zahl('SELECT COUNT(*) FROM song WHERE dauer_sek NOT BETWEEN 95 AND 420')).toBe(0);
  });

  it('hält sterne zwischen 1 und 5', () => {
    expect(zahl('SELECT COUNT(*) FROM bewertung WHERE sterne NOT BETWEEN 1 AND 5')).toBe(0);
  });

  it('hält alle Jahreszahlen plausibel', () => {
    expect(
      zahl('SELECT COUNT(*) FROM kuenstler WHERE gruendungsjahr NOT BETWEEN 1965 AND 2022'),
    ).toBe(0);
    expect(
      zahl(`SELECT COUNT(*) FROM album a JOIN kuenstler k ON k.id = a.kuenstler_id
            WHERE a.erscheinungsjahr > 2025
               OR (k.gruendungsjahr IS NOT NULL AND a.erscheinungsjahr < k.gruendungsjahr)`),
    ).toBe(0);
  });

  it.each([
    ['nutzer', 'registriert_am'],
    ['playlist', 'erstellt_am'],
    ['playlist_song', 'hinzugefuegt_am'],
    ['bewertung', 'datum'],
  ])('speichert %s.%s als ISO-Datum', (tabelle, spaltenname) => {
    const werte = spalte(`SELECT ${spaltenname} FROM ${tabelle}`);
    expect(werte.length).toBeGreaterThan(0);
    for (const wert of werte) {
      expect(String(wert)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('hält die zeitliche Reihenfolge der Datumsangaben ein', () => {
    expect(
      zahl(`SELECT COUNT(*) FROM playlist p JOIN nutzer n ON n.id = p.nutzer_id
            WHERE p.erstellt_am < n.registriert_am`),
    ).toBe(0);
    expect(
      zahl(`SELECT COUNT(*) FROM playlist_song ps JOIN playlist p ON p.id = ps.playlist_id
            WHERE ps.hinzugefuegt_am < p.erstellt_am`),
    ).toBe(0);
    expect(
      zahl(`SELECT COUNT(*) FROM bewertung b JOIN nutzer n ON n.id = b.nutzer_id
            WHERE b.datum < n.registriert_am`),
    ).toBe(0);
  });

  it('setzt UNIQUE nur auf die Alternativschlüssel', () => {
    const unique = sql
      .split('\n')
      .filter((zeile) => zeile.includes('UNIQUE'))
      .map((zeile) => zeile.trim());
    expect(unique).toEqual([
      'benutzername   TEXT NOT NULL UNIQUE,',
      'email          TEXT NOT NULL UNIQUE,',
      'nutzer_id   INTEGER NOT NULL UNIQUE, -- 1:1, jede Person hat höchstens ein Abo',
    ]);
  });

  it('hält benutzername und email eindeutig', () => {
    const anzahl = zahl('SELECT COUNT(*) FROM nutzer');
    expect(zahl('SELECT COUNT(DISTINCT benutzername) FROM nutzer')).toBe(anzahl);
    expect(zahl('SELECT COUNT(DISTINCT email) FROM nutzer')).toBe(anzahl);
  });
});
