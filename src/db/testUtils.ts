/**
 * Hilfen für die Tests der Datenschicht.
 *
 * In Node gibt es keinen Vite-Asset-Pfad; die wasm-Datei wird direkt aus dem
 * Paketverzeichnis geladen. Darum initialisieren Tests sql.js hier statt über `sqljs.ts`.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import initSqlJs from 'sql.js';
import type { Database, SqlJsStatic } from 'sql.js';

const require = createRequire(import.meta.url);
const distDir = path.dirname(require.resolve('sql.js'));

let pending: Promise<SqlJsStatic> | null = null;

/** sql.js für Tests, einmal pro Prozess initialisiert. */
export function loadTestSqlJs(): Promise<SqlJsStatic> {
  pending ??= initSqlJs({ locateFile: (file: string) => path.join(distDir, file) });
  return pending;
}

/** Kleines Schema im Stil der Beispieldatenbank, für Engine- und Fehlertests. */
export const TEST_SCHEMA = `
CREATE TABLE kuenstler (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  land TEXT
);
CREATE TABLE album (
  id INTEGER PRIMARY KEY,
  titel TEXT NOT NULL,
  kuenstler_id INTEGER NOT NULL,
  jahr INTEGER,
  FOREIGN KEY (kuenstler_id) REFERENCES kuenstler(id)
);
CREATE TABLE song (
  id INTEGER PRIMARY KEY,
  titel TEXT NOT NULL,
  album_id INTEGER NOT NULL,
  dauer_sek INTEGER,
  FOREIGN KEY (album_id) REFERENCES album(id)
);
CREATE TABLE bewertung (
  nutzer_id INTEGER NOT NULL,
  song_id INTEGER NOT NULL,
  sterne INTEGER CHECK (sterne BETWEEN 1 AND 5),
  PRIMARY KEY (nutzer_id, song_id)
);
INSERT INTO kuenstler (id, name, land) VALUES (1, 'Nordlicht', 'Schweiz'), (2, 'Blaue Stunde', 'Deutschland');
INSERT INTO album (id, titel, kuenstler_id, jahr) VALUES (1, 'Polarnacht', 1, 2019), (2, 'Morgenrot', 2, 2021);
INSERT INTO song (id, titel, album_id, dauer_sek) VALUES
  (1, 'Nordwind', 1, 212),
  (2, 'Liebe im Schnee', 1, 184),
  (3, 'Nacht ohne Ende', 2, 301),
  (4, '100% Gefuehl', 2, 150);
INSERT INTO bewertung (nutzer_id, song_id, sterne) VALUES (1, 1, 5), (1, 2, 3);
`;

/** Frische In-Memory-Datenbank mit `TEST_SCHEMA` und aktiven Fremdschlüsseln. */
export async function createTestDb(): Promise<Database> {
  const SQL = await loadTestSqlJs();
  const db = new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
  db.exec(TEST_SCHEMA);
  return db;
}
