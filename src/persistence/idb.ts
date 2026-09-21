/**
 * Zugriff auf die IndexedDB-Datenbank `dmdb` (Version 1) über die Bibliothek `idb`.
 *
 * Store-Layout (siehe PLAN.md, «Persistenz: IndexedDB über die Bibliothek idb»):
 *
 * | Store         | Key | Inhalt                                             |
 * |---------------|-----|----------------------------------------------------|
 * | `dbMeta`      | id  | `DbMeta`                                            |
 * | `dbBlobs`     | id  | `Uint8Array` (SQLite-Datei), getrennt von der Meta   |
 * | `scratchbooks`| id  | `ScratchbookRecord`, Index `byUpdatedAt`            |
 * | `settings`    | key | einzelne Einstellungswerte                          |
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { DbMeta, ScratchbookRecord } from './types';

export const DB_NAME = 'dmdb';
export const DB_VERSION = 1;

export interface DmdbSchema extends DBSchema {
  dbMeta: { key: string; value: DbMeta };
  dbBlobs: { key: string; value: Uint8Array };
  scratchbooks: {
    key: string;
    value: ScratchbookRecord;
    indexes: { byUpdatedAt: string };
  };
  settings: { key: string; value: unknown };
}

let connection: Promise<IDBPDatabase<DmdbSchema>> | null = null;
let instance: IDBPDatabase<DmdbSchema> | null = null;

function connect(): Promise<IDBPDatabase<DmdbSchema>> {
  return openDB<DmdbSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('dbMeta')) {
        db.createObjectStore('dbMeta', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('dbBlobs')) {
        db.createObjectStore('dbBlobs');
      }
      if (!db.objectStoreNames.contains('scratchbooks')) {
        const scratchbooks = db.createObjectStore('scratchbooks', { keyPath: 'id' });
        scratchbooks.createIndex('byUpdatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
    },
    blocked() {
      // Ein anderer Tab hält eine ältere Version offen und blockiert die Migration.
      // Wir geben unsere (noch nicht bestehende) Verbindung frei und melden es.
      console.warn(
        `[${DB_NAME}] Ein anderer Tab blockiert das Öffnen der Datenbank. Bitte andere Tabs schliessen.`,
      );
      closeDmdb();
    },
    blocking() {
      // Ein anderer Tab migriert auf eine neuere Version: eigene Verbindung schliessen,
      // sonst bleibt der andere Tab hängen. Der nächste Zugriff öffnet neu.
      closeDmdb();
    },
    terminated() {
      connection = null;
      instance = null;
    },
  });
}

/** Öffnet die Datenbank `dmdb` (memoisiert, alle Aufrufer teilen sich eine Verbindung). */
export function openDmdb(): Promise<IDBPDatabase<DmdbSchema>> {
  if (!connection) {
    connection = connect().then(
      (db) => {
        instance = db;
        return db;
      },
      (error: unknown) => {
        connection = null;
        throw error;
      },
    );
  }
  return connection;
}

/** Schliesst die memoisierte Verbindung, falls eine offen ist. Der nächste Zugriff öffnet neu. */
export function closeDmdb(): void {
  instance?.close();
  instance = null;
  connection = null;
}

/**
 * Nur für Tests: schliesst die offene Verbindung und vergisst die Memoisierung,
 * damit `indexedDB.deleteDatabase('dmdb')` danach nicht blockiert wird.
 */
export function resetConnectionForTests(): void {
  closeDmdb();
}
