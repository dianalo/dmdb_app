/**
 * Reine Hilfsfunktionen der Tabellenansicht (ohne React, testbar).
 */
import type { SortDirection, SqlValue } from '@/db';
import { de } from '@/i18n/de';

/** So viele Zeilen lädt die Ansicht auf einmal («Mehr laden» holt die nächsten). */
export const PAGE_SIZE = 200;

/** Verzögerung der Suche nach dem letzten Tastendruck. */
export const SEARCH_DEBOUNCE_MS = 250;

export interface SortState {
  column: string;
  dir: SortDirection;
}

/** Tipp auf einen Spaltenkopf: aufsteigend → absteigend → unsortiert; neue Spalte beginnt aufsteigend. */
export function nextSort(current: SortState | null, column: string): SortState | null {
  if (current === null || current.column !== column) return { column, dir: 'asc' };
  if (current.dir === 'asc') return { column, dir: 'desc' };
  return null;
}

/** Wert für `aria-sort` eines Spaltenkopfs; `undefined` bei unsortierten Spalten. */
export function ariaSort(
  sort: SortState | null,
  column: string,
): 'ascending' | 'descending' | undefined {
  if (sort === null || sort.column !== column) return undefined;
  return sort.dir === 'asc' ? 'ascending' : 'descending';
}

/** Hängt eine nachgeladene Seite an oder ersetzt die bisherigen Zeilen. */
export function mergeRows(
  previous: SqlValue[][],
  page: SqlValue[][],
  append: boolean,
): SqlValue[][] {
  return append ? [...previous, ...page] : page;
}

/** Zähler unter der Tabelle: «200 von 300 Zeilen» bzw. «300 Zeilen», wenn alles da ist. */
export function counterText(shown: number, total: number): string {
  return shown < total ? de.tableView.counter(shown, total) : de.tableView.rowCount(total);
}

/** Deklarierter Typ mit numerischer Affinität (SQLite-Regeln, vereinfacht)? */
export function isNumericType(declared: string): boolean {
  const type = declared.toUpperCase();
  if (type.includes('CHAR') || type.includes('CLOB') || type.includes('TEXT')) return false;
  return /INT|REAL|FLOA|DOUB|NUM|DEC|BOOL/.test(type);
}
