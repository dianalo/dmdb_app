import type { SqlValue } from '@/db';
import { cellText } from './resultText';

/**
 * Eine Datenzelle, gemeinsam für Resultattabelle und Tabellenansicht.
 * Zahlen rechtsbündig in Monospace, NULL und BLOB kursiv und gedämpft
 * (die Styles hängen an `.table` in `Results.module.css`).
 */
export function ValueCell({ value }: { value: SqlValue }) {
  return (
    <td
      data-numeric={typeof value === 'number' || undefined}
      data-null={value === null || undefined}
      data-blob={value instanceof Uint8Array || undefined}
    >
      {cellText(value)}
    </td>
  );
}
