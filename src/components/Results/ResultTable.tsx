import { memo } from 'react';
import type { SqlValue } from '@/db';
import { de } from '@/i18n/de';
import { ValueCell } from './cells';
import styles from './Results.module.css';

interface ResultTableProps {
  columns: string[];
  rows: SqlValue[][];
}

/** Spalten, deren Werte (ohne NULL) alle Zahlen sind, werden rechtsbündig gesetzt. */
function numericColumns(columns: string[], rows: SqlValue[][]): boolean[] {
  return columns.map((_, index) => {
    let sawNumber = false;
    for (const row of rows) {
      const value = row[index];
      if (value === null || value === undefined) continue;
      if (typeof value !== 'number') return false;
      sawNumber = true;
    }
    return sawNumber;
  });
}

/** Resultattabelle mit stickem Kopf; scrollt in ihrem eigenen Container. */
export const ResultTable = memo(function ResultTable({ columns, rows }: ResultTableProps) {
  const numeric = numericColumns(columns, rows);
  return (
    // Fokussierbar, damit sich breite Tabellen auch per Tastatur scrollen lassen.
    <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={de.results.table}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((name, index) => (
              <th key={index} scope="col" data-numeric={numeric[index] || undefined}>
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((value, index) => (
                <ValueCell key={index} value={value} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
