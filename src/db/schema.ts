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

/**
 * Das `CREATE TABLE`-Statement aus `sqlite_master` für den DDL-Tab, verbatim bis auf
 * {@link formatDdl}.
 */
export function tableDdl(db: Database, name: string): string {
  const stmt = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?", [
    name,
  ]);
  try {
    if (!stmt.step()) return '';
    const value = stmt.get()[0];
    return typeof value === 'string' ? formatDdl(value) : '';
  } finally {
    stmt.free();
  }
}

/**
 * Bricht bei mehrzeiliger DDL nach jedem Komma zwischen zwei Spalten-/Constraint-Definitionen
 * um, auf das noch etwas auf derselben Zeile folgt. `ALTER TABLE … ADD COLUMN` hängt neue
 * Spalten nämlich als `, <spalte>` an die Zeile der bisher letzten Spalte an. Einzeilige DDL
 * bleibt unverändert, ebenso Kommas in Strings, Kommentaren und Klammern (z. B. `CHECK (…)`).
 */
export function formatDdl(ddl: string): string {
  const open = ddl.indexOf('(');
  if (open < 0 || !ddl.includes('\n', open)) return ddl;

  let out = '';
  let depth = 0;
  let i = 0;
  while (i < ddl.length) {
    const ch = ddl[i]!;
    const end = skipLiteral(ddl, i);
    if (end > i) {
      out += ddl.slice(i, end);
      i = end;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    out += ch;
    i++;
    if (ch !== ',' || depth !== 1) continue;

    // Folgt nach dem Komma nur noch Leerraum oder ein Zeilenkommentar, ist nichts zu tun.
    let next = i;
    while (ddl[next] === ' ' || ddl[next] === '\t') next++;
    if (next >= ddl.length || /[\r\n]/.test(ddl[next]!) || ddl.startsWith('--', next)) continue;

    const lineStart = out.lastIndexOf('\n') + 1;
    const indent = lineStart === 0 ? '  ' : /^[ \t]*/.exec(out.slice(lineStart))![0];
    out += '\n' + indent;
    i = next;
  }
  return out;
}

/** Ende eines Strings, quotierten Bezeichners oder Kommentars ab `start`, sonst `start`. */
function skipLiteral(sql: string, start: number): number {
  const ch = sql[start];
  if (sql.startsWith('--', start)) {
    const end = sql.indexOf('\n', start);
    return end < 0 ? sql.length : end;
  }
  if (sql.startsWith('/*', start)) {
    const end = sql.indexOf('*/', start + 2);
    return end < 0 ? sql.length : end + 2;
  }
  const close = ch === "'" || ch === '"' || ch === '`' ? ch : ch === '[' ? ']' : null;
  if (close === null) return start;
  let i = start + 1;
  while (i < sql.length) {
    if (sql[i] === close) {
      if (close !== ']' && sql[i + 1] === close)
        i += 2; // verdoppeltes Anführungszeichen
      else return i + 1;
    } else i++;
  }
  return sql.length;
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
