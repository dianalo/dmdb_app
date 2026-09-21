/**
 * Gemeinsame Typen der Datenbankschicht (`src/db`).
 * Diese Datei ist der stabile Vertrag zwischen Engine, Persistenz, Stores und UI.
 */

/** Ein Wert, wie ihn SQLite über sql.js liefert oder entgegennimmt. */
export type SqlValue = number | string | null | Uint8Array;

/** Eine ins Deutsche übersetzte SQLite-Fehlermeldung (siehe `src/db/errors/`). */
export interface TranslatedError {
  /** Kurzmeldung in Du-Form, z. B. «Die Tabelle «song» existiert nicht.» */
  title: string;
  /** Wahrscheinliche Ursache bzw. Tipp zur Behebung. */
  hint?: string;
  /** Konkreter Korrekturvorschlag, z. B. «Meintest du «song»?» */
  suggestion?: string;
  /** Die englische Originalmeldung von SQLite, wird immer mit angezeigt. */
  original: string;
}

/** Schema-Kontext der aktiven Datenbank, damit Fehlermeldungen Vorschläge machen können. */
export interface ErrorContext {
  /** Alle Tabellennamen der aktiven Datenbank. */
  tables: string[];
  /** Spaltennamen pro Tabelle. */
  columns: Record<string, string[]>;
}

/**
 * Resultat eines einzelnen Statements eines Laufs.
 * `range` ist der Zeichenbereich `[start, end]` im ausgeführten SQL-Text,
 * damit das fehlerhafte Statement im Editor markiert werden kann.
 */
export type StatementResult =
  | {
      kind: 'rows';
      sql: string;
      columns: string[];
      rows: SqlValue[][];
      truncated: boolean;
      ms: number;
      range: [number, number];
    }
  | { kind: 'changes'; sql: string; changes: number; ms: number; range: [number, number] }
  | {
      kind: 'ddl';
      sql: string;
      verb: 'CREATE' | 'DROP' | 'ALTER' | 'OTHER';
      ms: number;
      range: [number, number];
    }
  | { kind: 'ok'; sql: string; ms: number; range: [number, number] }
  | { kind: 'error'; sql: string; error: TranslatedError; range: [number, number] };

/** Ergebnis eines ganzen Laufs. `dirty` heisst: die Datenbank muss persistiert werden. */
export interface RunOutcome {
  results: StatementResult[];
  dirty: boolean;
}

/** Eine Spalte gemäss `PRAGMA table_info`. */
export interface ColumnInfo {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
  defaultValue: string | null;
}

/** Eine Tabelle der aktiven Datenbank inklusive ihres `CREATE TABLE`-Statements. */
export interface TableInfo {
  name: string;
  rowCount: number;
  columns: ColumnInfo[];
  /** Original-DDL aus `sqlite_master`, wird im DDL-Tab verbatim angezeigt. */
  ddl: string;
}

export type SortDirection = 'asc' | 'desc';

/** Anfrage für eine Seite der Tabellenansicht (`src/db/browse.ts`). */
export interface PageRequest {
  table: string;
  sort?: { column: string; dir: SortDirection };
  /** Freitextsuche über alle Spalten (`LIKE '%…%'`). */
  filter?: string;
  offset: number;
  limit: number;
}

/** Eine Seite der Tabellenansicht. `total` ist die Gesamtzahl passender Zeilen. */
export interface PageResult {
  columns: string[];
  rows: SqlValue[][];
  total: number;
}

/** Obergrenze angezeigter Zeilen pro Resultatmenge (Schutz vor kartesischen Produkten). */
export const ROW_CAP = 1000;
