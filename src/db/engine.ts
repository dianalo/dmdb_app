/**
 * Die Engine hält genau eine sql.js-Datenbank und kapselt alles, was die Stores brauchen.
 *
 * Die Schnittstelle ist async, obwohl die Umsetzung synchron im Main-Thread läuft:
 * so liesse sich später ein Worker einsetzen, ohne eine einzige aufrufende Stelle zu ändern.
 */
import type { Database, SqlJsStatic } from 'sql.js';
import { pageTable as pageTableOf } from './browse';
import { SqlError, translateThrown } from './errors/translate';
import { runScript } from './runScript';
import {
  errorContext as errorContextOf,
  listTables as listTablesOf,
  tableInfo as tableInfoOf,
} from './schema';
import type { ErrorContext, PageRequest, PageResult, RunOutcome, TableInfo } from './types';

/** Die öffentliche Schnittstelle der Datenschicht. */
export interface Engine {
  /** Öffnet eine Datenbank aus Bytes oder eine leere, neue. */
  open(bytes?: Uint8Array): Promise<void>;
  /** Öffnet eine frische Datenbank und baut sie mit einem DDL-Script auf. */
  openFromSql(sql: string): Promise<void>;
  /** Führt ein Script aus; `offset` ist die Startposition einer Selektion im Editor. */
  run(sql: string, offset?: number): Promise<RunOutcome>;
  /** Bytes der aktuellen Datenbank für die Persistenz oder den Download. */
  snapshot(): Promise<Uint8Array>;
  listTables(): Promise<string[]>;
  tableInfo(name: string): Promise<TableInfo>;
  pageTable(req: PageRequest): Promise<PageResult>;
  errorContext(): Promise<ErrorContext>;
  /** `PRAGMA integrity_check`, für den Import fremder `.sqlite`-Dateien. */
  integrityCheck(): Promise<boolean>;
  /** Schliesst alles Offene und öffnet neu aus Bytes (nach einem wasm-Abbruch). */
  recover(bytes?: Uint8Array): Promise<void>;
  close(): Promise<void>;
  isOpen(): boolean;
}

/**
 * Erzeugt eine Engine über einem bereits initialisierten sql.js-Modul.
 * Das Modul wird injiziert, damit Tests `initSqlJs()` ohne `?url` verwenden können.
 */
export function createEngine(SQL: SqlJsStatic): Engine {
  let db: Database | null = null;

  const active = (): Database => {
    if (db === null) {
      throw new SqlError({
        title: 'Es ist keine Datenbank geöffnet.',
        hint: 'Wähle links eine Datenbank aus oder lade die Seite neu.',
        original: 'no database is open',
      });
    }
    return db;
  };

  const closeQuietly = (): void => {
    if (db === null) return;
    try {
      db.close();
    } finally {
      db = null;
    }
  };

  /** `PRAGMA foreign_keys` ist pro Verbindung und geht bei jedem `export()` verloren. */
  const enforceForeignKeys = (target: Database): void => {
    target.run('PRAGMA foreign_keys = ON');
  };

  return {
    async open(bytes?: Uint8Array): Promise<void> {
      closeQuietly();
      db = new SQL.Database(bytes ?? null);
      enforceForeignKeys(db);
    },

    async openFromSql(sql: string): Promise<void> {
      closeQuietly();
      const fresh = new SQL.Database();
      try {
        enforceForeignKeys(fresh);
        fresh.exec(sql);
      } catch (error) {
        fresh.close();
        throw new SqlError(translateThrown(error));
      }
      db = fresh;
    },

    async run(sql: string, offset = 0): Promise<RunOutcome> {
      const target = active();
      return runScript(target, sql, errorContextOf(target), offset);
    },

    async snapshot(): Promise<Uint8Array> {
      const target = active();
      // `export()` schliesst die Verbindung und öffnet sie neu. Eine offene Transaktion
      // ginge dabei verloren, darum vorher prüfen statt hinterher staunen.
      try {
        target.run('BEGIN');
        target.run('ROLLBACK');
      } catch (error) {
        throw new SqlError(translateThrown(error));
      }
      const bytes = target.export();
      enforceForeignKeys(target); // export() hat alle PRAGMAs zurückgesetzt.
      return bytes;
    },

    async listTables(): Promise<string[]> {
      return listTablesOf(active());
    },

    async tableInfo(name: string): Promise<TableInfo> {
      return tableInfoOf(active(), name);
    },

    async pageTable(req: PageRequest): Promise<PageResult> {
      return pageTableOf(active(), req);
    },

    async errorContext(): Promise<ErrorContext> {
      return errorContextOf(active());
    },

    async integrityCheck(): Promise<boolean> {
      const target = active();
      const stmt = target.prepare('PRAGMA integrity_check');
      try {
        return stmt.step() && stmt.get()[0] === 'ok';
      } finally {
        stmt.free();
      }
    },

    async recover(bytes?: Uint8Array): Promise<void> {
      closeQuietly();
      db = new SQL.Database(bytes ?? null);
      enforceForeignKeys(db);
    },

    async close(): Promise<void> {
      closeQuietly();
    },

    isOpen(): boolean {
      return db !== null;
    },
  };
}
