/**
 * Schema-Abfragen für Tabellenliste, Tabellenansicht und DDL-Tab.
 */
import type { Database } from 'sql.js';
import type { ColumnInfo, ErrorContext, SqlValue, TableInfo } from './types';

/** Setzt einen Bezeichner in doppelte Anführungszeichen; enthaltene werden verdoppelt. */
export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** Alle Tabellen der Datenbank, alphabetisch, ohne die internen `sqlite_%`-Tabellen. */
export function listTables(db: Database): string[] {
  return queryColumn(
    db,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ).map(String);
}

/** Spalten, Zeilenzahl und Original-DDL einer Tabelle. */
export function tableInfo(db: Database, name: string): TableInfo {
  const columns = tableColumns(db, name);
  if (columns.length === 0) throw new Error(`no such table: ${name}`);
  return {
    name,
    rowCount: rowCount(db, name),
    columns,
    ddl: tableDdl(db, name),
  };
}

/** Spalten einer Tabelle gemäss `PRAGMA table_info`. */
export function tableColumns(db: Database, name: string): ColumnInfo[] {
  const stmt = db.prepare(`PRAGMA table_info(${quoteIdent(name)})`);
  const columns: ColumnInfo[] = [];
  try {
    while (stmt.step()) {
      const row = stmt.getAsObject();
      columns.push({
        name: String(row['name'] ?? ''),
        type: String(row['type'] ?? ''),
        notNull: Number(row['notnull'] ?? 0) !== 0,
        primaryKey: Number(row['pk'] ?? 0) !== 0,
        defaultValue: row['dflt_value'] === null ? null : String(row['dflt_value']),
      });
    }
  } finally {
    stmt.free();
  }
  return columns;
}

/** Nur die Spaltennamen, in der Reihenfolge der Tabelle. */
export function columnNames(db: Database, name: string): string[] {
  return tableColumns(db, name).map((column) => column.name);
}

/** Anzahl Zeilen einer Tabelle. */
export function rowCount(db: Database, name: string): number {
  const value = queryColumn(db, `SELECT COUNT(*) FROM ${quoteIdent(name)}`)[0];
  return typeof value === 'number' ? value : 0;
}

/** Das `CREATE TABLE`-Statement aus `sqlite_master`, verbatim für den DDL-Tab. */
export function tableDdl(db: Database, name: string): string {
  const stmt = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?", [
    name,
  ]);
  try {
    if (!stmt.step()) return '';
    const value = stmt.get()[0];
    return typeof value === 'string' ? value : '';
  } finally {
    stmt.free();
  }
}

/** Tabellen- und Spaltennamen für die Vorschläge der Fehlerübersetzung. */
export function errorContext(db: Database): ErrorContext {
  const tables = listTables(db);
  const columns: Record<string, string[]> = {};
  for (const table of tables) columns[table] = columnNames(db, table);
  return { tables, columns };
}

/** Erste Spalte aller Zeilen einer Abfrage ohne Parameter. */
function queryColumn(db: Database, sql: string): SqlValue[] {
  const stmt = db.prepare(sql);
  const values: SqlValue[] = [];
  try {
    while (stmt.step()) values.push(stmt.get()[0] ?? null);
  } finally {
    stmt.free();
  }
  return values;
}
