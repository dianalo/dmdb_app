/**
 * Reine Hilfsfunktionen für die Texte der Ausgabeblöcke (ohne React, testbar).
 */
import type { SqlValue, StatementResult } from '@/db';
import { de } from '@/i18n/de';

type DdlObject = keyof typeof de.results.objects;

const DDL_RE =
  /^(CREATE|DROP|ALTER)\s+(?:(?:TEMP|TEMPORARY|UNIQUE|VIRTUAL)\s+)*(TABLE|INDEX|VIEW|TRIGGER)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?("(?:[^"]|"")+"|`[^`]+`|\[[^\]]+\]|[\p{L}\p{N}_.$]+)/iu;

/** Entfernt führenden Leerraum und Kommentare. */
function stripLeadingTrivia(sql: string): string {
  let rest = sql;
  for (;;) {
    const trimmed = rest.replace(/^\s+/, '');
    if (trimmed.startsWith('--')) {
      const nl = trimmed.indexOf('\n');
      rest = nl === -1 ? '' : trimmed.slice(nl + 1);
    } else if (trimmed.startsWith('/*')) {
      const close = trimmed.indexOf('*/');
      rest = close === -1 ? '' : trimmed.slice(close + 2);
    } else {
      return trimmed;
    }
  }
}

/** Bezeichner ohne Quoting: `"a b"` → `a b`. */
function unquote(name: string): string {
  const first = name[0];
  if (first === '"') return name.slice(1, -1).replace(/""/g, '"');
  if (first === '`' || first === '[') return name.slice(1, -1);
  return name;
}

/**
 * Meldung für ein DDL-Statement, z. B. «Tabelle «notiz» erstellt».
 * Erkennt die Art des Objekts aus dem SQL; sonst «Ausgeführt».
 */
export function ddlMessage(sql: string, verb: 'CREATE' | 'DROP' | 'ALTER' | 'OTHER'): string {
  if (verb === 'OTHER') return de.results.ok;
  const match = DDL_RE.exec(stripLeadingTrivia(sql));
  const verbText = de.results.ddl[verb];
  if (!match) return de.results.ddlDone(de.results.objects.TABLE, null, verbText);
  const object = (match[2] as string).toUpperCase() as DdlObject;
  return de.results.ddlDone(de.results.objects[object], unquote(match[3] as string), verbText);
}

/** Überschrift eines Ausgabeblocks ohne Fehler. */
export function summaryText(result: Exclude<StatementResult, { kind: 'error' }>): string {
  switch (result.kind) {
    case 'rows':
      return result.truncated
        ? de.results.moreRows(result.rows.length)
        : de.results.rows(result.rows.length);
    case 'changes':
      return de.results.changes(result.changes);
    case 'ddl':
      return ddlMessage(result.sql, result.verb);
    case 'ok':
      return de.results.ok;
  }
}

/** Darstellung eines Zellwerts als Text (NULL und BLOB gesondert). */
export function cellText(value: SqlValue): string {
  if (value === null) return de.results.null;
  if (value instanceof Uint8Array) return de.results.blob(value.byteLength);
  return String(value);
}
