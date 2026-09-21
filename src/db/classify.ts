/**
 * Klassifikation von SQL-Statements ohne vollständigen Parser.
 *
 * Wir brauchen nur so viel Analyse, wie die Ausgabe unterscheiden muss:
 * Resultatmenge, «N Zeilen geändert», DDL oder schlicht «OK».
 * Alles Weitere entscheidet SQLite selbst.
 */
import type { Database } from 'sql.js';

/** Schlüsselwörter, die die Datenbank garantiert nicht verändern. */
export const READ_ONLY_KEYWORDS: ReadonlySet<string> = new Set([
  'SELECT',
  'VALUES',
  'EXPLAIN',
  'PRAGMA',
  'BEGIN',
  'COMMIT',
  'END',
  'ROLLBACK',
  'SAVEPOINT',
  'RELEASE',
]);

/** Schlüsselwörter, nach denen `getRowsModified()` eine sinnvolle Zahl liefert. */
export const DML_KEYWORDS: ReadonlySet<string> = new Set(['INSERT', 'UPDATE', 'DELETE', 'REPLACE']);

/** Schlüsselwörter, die nach einer CTE (`WITH …`) die eigentliche Aktion benennen. */
const ACTION_KEYWORDS: ReadonlySet<string> = new Set([
  'SELECT',
  'VALUES',
  'INSERT',
  'UPDATE',
  'DELETE',
  'REPLACE',
]);

const WORD_START = /[A-Za-z_]/;
const WORD_PART = /[A-Za-z0-9_$]/;

/**
 * Überspringt Leerraum sowie Zeilenkommentare und Blockkommentare ab `from`
 * und liefert den Index des nächsten inhaltlichen Zeichens.
 */
export function skipTrivia(sql: string, from = 0): number {
  let i = from;
  for (;;) {
    while (i < sql.length && /\s/.test(sql[i] as string)) i += 1;
    if (sql.startsWith('--', i)) {
      const nl = sql.indexOf('\n', i);
      i = nl === -1 ? sql.length : nl + 1;
      continue;
    }
    if (sql.startsWith('/*', i)) {
      const close = sql.indexOf('*/', i + 2);
      i = close === -1 ? sql.length : close + 2;
      continue;
    }
    return i;
  }
}

/**
 * Erstes Schlüsselwort eines Statements in Grossbuchstaben,
 * Leerraum und Kommentare werden übersprungen. Leerer String, wenn keines da ist.
 */
export function firstKeyword(sql: string): string {
  const start = skipTrivia(sql);
  if (start >= sql.length || !WORD_START.test(sql[start] as string)) return '';
  let end = start + 1;
  while (end < sql.length && WORD_PART.test(sql[end] as string)) end += 1;
  return sql.slice(start, end).toUpperCase();
}

/**
 * Das Schlüsselwort, das die Wirkung des Statements bestimmt.
 * Bei `WITH … INSERT/UPDATE/DELETE` ist das nicht `WITH`, sondern die Aktion
 * auf oberster Klammerebene; so wird `WITH … SELECT` nicht als schreibend gewertet.
 */
export function effectiveKeyword(sql: string): string {
  const kw = firstKeyword(sql);
  if (kw !== 'WITH') return kw;
  for (const word of topLevelWords(sql)) {
    if (word === 'WITH' || word === 'RECURSIVE') continue;
    if (ACTION_KEYWORDS.has(word)) return word;
  }
  return kw;
}

/**
 * Index direkt nach dem nächsten Semikolon, das nicht in einem String,
 * einem Bezeichner oder einem Kommentar steht; sonst das Ende von `sql`.
 * Best effort für die Markierung eines fehlerhaften Statements.
 */
export function statementEnd(sql: string, from = 0): number {
  for (const token of scan(sql, from)) {
    if (token.kind === 'char' && token.text === ';') return token.end;
  }
  return sql.length;
}

/** Wörter auf Klammerebene 0, in Grossbuchstaben. */
function* topLevelWords(sql: string): Generator<string> {
  let depth = 0;
  for (const token of scan(sql, 0)) {
    if (token.kind === 'char') {
      if (token.text === '(') depth += 1;
      else if (token.text === ')') depth = Math.max(0, depth - 1);
      else if (token.text === ';') return;
    } else if (token.kind === 'word' && depth === 0) {
      yield token.text.toUpperCase();
    }
  }
}

interface Token {
  kind: 'word' | 'char';
  text: string;
  start: number;
  end: number;
}

/** Sehr einfacher Scanner: liefert Wörter und Einzelzeichen, überspringt Strings und Kommentare. */
function* scan(sql: string, from: number): Generator<Token> {
  let i = from;
  while (i < sql.length) {
    const next = skipTrivia(sql, i);
    if (next !== i) {
      i = next;
      continue;
    }
    const ch = sql[i] as string;
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipQuoted(sql, i, ch);
      continue;
    }
    if (ch === '[') {
      const close = sql.indexOf(']', i + 1);
      i = close === -1 ? sql.length : close + 1;
      continue;
    }
    if (WORD_START.test(ch)) {
      let end = i + 1;
      while (end < sql.length && WORD_PART.test(sql[end] as string)) end += 1;
      yield { kind: 'word', text: sql.slice(i, end), start: i, end };
      i = end;
      continue;
    }
    yield { kind: 'char', text: ch, start: i, end: i + 1 };
    i += 1;
  }
}

/** Index nach dem schliessenden Anführungszeichen; doppelte Zeichen sind Escapes. */
function skipQuoted(sql: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < sql.length) {
    if (sql[i] === quote) {
      if (sql[i + 1] === quote) {
        i += 2;
        continue;
      }
      return i + 1;
    }
    i += 1;
  }
  return sql.length;
}

/** Aktuelle `PRAGMA schema_version`; ändert sich bei jedem DDL-Statement. */
export function schemaVersion(db: Database): number {
  const stmt = db.prepare('PRAGMA schema_version');
  try {
    if (!stmt.step()) return -1;
    const value = stmt.get()[0];
    return typeof value === 'number' ? value : -1;
  } finally {
    stmt.free();
  }
}

/** Ordnet ein DDL-Schlüsselwort dem Verb im Resultat zu. */
export function ddlVerb(keyword: string): 'CREATE' | 'DROP' | 'ALTER' | 'OTHER' {
  switch (keyword.toUpperCase()) {
    case 'CREATE':
      return 'CREATE';
    case 'DROP':
      return 'DROP';
    case 'ALTER':
      return 'ALTER';
    default:
      return 'OTHER';
  }
}
