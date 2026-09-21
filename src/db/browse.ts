/**
 * Seitenweises Lesen einer Tabelle für die Tabellenansicht:
 * Sortieren, Freitextsuche über alle Spalten, «Mehr laden».
 *
 * Werte werden immer gebunden; nur Tabellen- und Spaltennamen gehen in den SQL-Text,
 * und die kommen ausschliesslich aus dem Schema der Datenbank.
 */
import type { Database } from 'sql.js';
import { quoteIdent, tableColumns } from './schema';
import type { PageRequest, PageResult, SqlValue } from './types';

/** Zeichen, mit dem `%` und `_` in der Suche entwertet werden. */
const LIKE_ESCAPE = '\\';

/** Eine Seite der Tabellenansicht inklusive Gesamtzahl passender Zeilen. */
export function pageTable(db: Database, req: PageRequest): PageResult {
  const columns = tableColumns(db, req.table).map((column) => column.name);
  if (columns.length === 0) throw new Error(`no such table: ${req.table}`);

  const table = quoteIdent(req.table);
  const filter = req.filter?.trim() ?? '';
  const params: SqlValue[] = [];
  let where = '';
  if (filter !== '') {
    const pattern = `%${escapeLike(filter)}%`;
    const terms = columns.map((column) => {
      params.push(pattern);
      return `CAST(${quoteIdent(column)} AS TEXT) LIKE ? ESCAPE '${LIKE_ESCAPE}'`;
    });
    where = ` WHERE (${terms.join(' OR ')})`;
  }

  // Eine unbekannte Sortierspalte wird ignoriert statt abgelehnt: die Ansicht soll nie leer bleiben.
  const sort = req.sort && columns.includes(req.sort.column) ? req.sort : undefined;
  const order = sort
    ? ` ORDER BY ${quoteIdent(sort.column)} ${sort.dir === 'desc' ? 'DESC' : 'ASC'}`
    : '';

  const total = count(db, `SELECT COUNT(*) FROM ${table}${where}`, params);
  const rows = selectRows(db, `SELECT * FROM ${table}${where}${order} LIMIT ? OFFSET ?`, [
    ...params,
    req.limit,
    req.offset,
  ]);

  return { columns, rows, total };
}

/** Entwertet die Platzhalter `%` und `_` in der Eingabe der Schüler:innen. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => LIKE_ESCAPE + char);
}

function count(db: Database, sql: string, params: SqlValue[]): number {
  const stmt = db.prepare(sql, params);
  try {
    if (!stmt.step()) return 0;
    const value = stmt.get()[0];
    return typeof value === 'number' ? value : 0;
  } finally {
    stmt.free();
  }
}

function selectRows(db: Database, sql: string, params: SqlValue[]): SqlValue[][] {
  const stmt = db.prepare(sql, params);
  const rows: SqlValue[][] = [];
  try {
    while (stmt.step()) rows.push(stmt.get() as SqlValue[]);
  } finally {
    stmt.free();
  }
  return rows;
}
