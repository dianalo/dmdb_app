/**
 * Geordnete Regeln, die eine englische SQLite-Meldung in eine deutsche Erklärung übersetzen.
 *
 * Reihenfolge ist Bedeutung: die erste passende Regel gewinnt. Spezielle Regeln
 * (typografische Zeichen) stehen darum vor den allgemeinen.
 *
 * Stil: Schweizer Rechtschreibung (immer «ss»), Du-Form, Guillemets «…».
 * Die Texte stehen bewusst hier und nicht in `src/i18n/de.ts`: sie gehören zur Regel.
 */
import type { ErrorContext } from '../types';
import { SQL_FUNCTIONS, SQL_KEYWORDS } from './keywords';
import { closestMatch } from './levenshtein';

/** Was eine Regel beisteuert; `original` ergänzt `translateError`. */
export interface RuleResult {
  title: string;
  hint?: string;
  suggestion?: string;
}

/** Eine Übersetzungsregel. `build` darf `null` liefern, dann ist die nächste Regel dran. */
export interface Rule {
  /** Technischer Name, nur für Tests und Debugging. */
  name: string;
  pattern: RegExp;
  build(match: RegExpMatchArray, ctx: ErrorContext): RuleResult | null;
}

/** Typografische Zeichen, die iPadOS beim Tippen einsetzt, und ihr SQL-Gegenstück. */
const TYPOGRAPHIC: Record<string, string> = {
  '‘': "'",
  '’': "'",
  '‚': "'",
  '“': '"',
  '”': '"',
  '„': '"',
  '«': '"',
  '»': '"',
  '–': '--',
  '—': '--',
  '−': '-',
};

const TYPOGRAPHIC_RE = new RegExp(`[${Object.keys(TYPOGRAPHIC).join('')}]`, 'g');

/** Tokens, vor denen ein überzähliges Komma der häufigste Grund für einen Syntaxfehler ist. */
const COMMA_TOKENS = new Set(['FROM', 'WHERE', 'ORDER', 'GROUP', 'HAVING', 'LIMIT', ')']);

const q = (value: string): string => `«${value}»`;

/** «1 Spalte» bzw. «3 Spalten», «1 Wert» bzw. «2 Werte». */
const spalten = (n: string): string => `${n} ${n === '1' ? 'Spalte' : 'Spalten'}`;
const werte = (n: string): string => `${n} ${n === '1' ? 'Wert' : 'Werte'}`;

function hasTypographic(text: string): boolean {
  TYPOGRAPHIC_RE.lastIndex = 0;
  return TYPOGRAPHIC_RE.test(text);
}

function straighten(text: string): string {
  return text.replace(TYPOGRAPHIC_RE, (char) => TYPOGRAPHIC[char] ?? char);
}

/** Gemeinsamer Text für alle Stellen, an denen ein typografisches Zeichen auftaucht. */
function typographicResult(token: string): RuleResult {
  return {
    title: `Unbekanntes Zeichen bei ${q(token)}.`,
    hint:
      'SQL braucht gerade Anführungszeichen (\' und ") und zwei Bindestriche (--) für Kommentare. ' +
      'Auf dem Tablet ersetzt die Autokorrektur sie beim Tippen durch typografische Zeichen.',
    suggestion: `Schreibe ${q(straighten(token))} statt ${q(token)}.`,
  };
}

/** Alle Spaltennamen der Datenbank, ohne Duplikate. */
function allColumns(ctx: ErrorContext): string[] {
  const seen = new Set<string>();
  for (const columns of Object.values(ctx.columns)) for (const column of columns) seen.add(column);
  return [...seen];
}

function suggestion(candidate: string | undefined): string | undefined {
  return candidate === undefined ? undefined : `Meintest du ${q(candidate)}?`;
}

/** Spaltenvorschlag; bei `tabelle.spalte` werden nur die Spalten dieser Tabelle verglichen. */
function suggestColumn(name: string, ctx: ErrorContext): string | undefined {
  const dot = name.lastIndexOf('.');
  if (dot > 0) {
    const table = name.slice(0, dot);
    const column = name.slice(dot + 1);
    const candidates = ctx.columns[table];
    const match = closestMatch(column, candidates ?? allColumns(ctx));
    return match === undefined ? undefined : `${table}.${match}`;
  }
  return closestMatch(name, allColumns(ctx));
}

/** Die Regeln in ihrer Prüfreihenfolge. */
export const RULES: readonly Rule[] = [
  {
    name: 'typographic-token',
    pattern: /unrecognized token:\s*"([^"]*)"/i,
    build: (m) => (hasTypographic(m[1] ?? '') ? typographicResult(m[1] as string) : null),
  },
  {
    name: 'typographic-column',
    pattern: /no such column:\s*(.+)$/i,
    build: (m) => (hasTypographic(m[1] ?? '') ? typographicResult((m[1] as string).trim()) : null),
  },
  {
    name: 'typographic-near',
    pattern: /near\s+"([^"]*)":\s*syntax error/i,
    build: (m) => (hasTypographic(m[1] ?? '') ? typographicResult(m[1] as string) : null),
  },
  {
    name: 'no-such-table',
    pattern: /no such table:\s*(\S+)/i,
    build: (m, ctx) => {
      const name = (m[1] as string).replace(/^main\./i, '');
      return {
        title: `Die Tabelle ${q(name)} existiert nicht.`,
        hint: 'Prüfe die Schreibweise. Alle Tabellen der Datenbank findest du links in der Seitenleiste.',
        suggestion: suggestion(closestMatch(name, ctx.tables)),
      };
    },
  },
  {
    name: 'table-already-exists',
    pattern: /table\s+(\S+)\s+already exists/i,
    build: (m) => ({
      title: `Die Tabelle ${q(m[1] as string)} existiert bereits.`,
      hint: `Wähle einen anderen Namen oder lösche die Tabelle zuerst mit DROP TABLE ${m[1] as string};`,
    }),
  },
  {
    name: 'no-such-column',
    pattern: /no such column:\s*(.+)$/i,
    build: (m, ctx) => {
      const name = (m[1] as string).trim();
      const looksLikeText = !name.includes('.');
      return {
        title: `Die Spalte ${q(name)} existiert nicht.`,
        hint:
          'Klicke links auf die Tabelle, um ihre Spalten zu sehen. Bei JOINs schreibst du den ' +
          `Tabellennamen davor, zum Beispiel ${q('song.titel')}.` +
          (looksLikeText
            ? ` Ist ${q(name)} ein Textwert? Textwerte gehören in einfache Anführungszeichen: 'Rock'. ` +
              'Doppelte Anführungszeichen versteht SQLite als Spaltennamen.'
            : ''),
        suggestion: suggestion(suggestColumn(name, ctx)),
      };
    },
  },
  {
    name: 'ambiguous-column',
    pattern: /ambiguous column name:\s*(\S+)/i,
    build: (m) => ({
      title: `Die Spalte ${q(m[1] as string)} kommt in mehreren Tabellen vor.`,
      hint: `Schreibe den Tabellennamen davor, zum Beispiel ${q('album.titel')}.`,
    }),
  },
  {
    name: 'near-syntax-error',
    pattern: /near\s+"([^"]*)":\s*syntax error/i,
    build: (m, ctx) => {
      const token = m[1] as string;
      const upper = token.toUpperCase();
      const parts = [`SQLite ist bei oder kurz vor ${q(token)} ins Stolpern geraten.`];
      if (COMMA_TOKENS.has(upper)) parts.push('Steht davor vielleicht ein Komma zu viel?');
      if (ctx.tables.includes(token)) {
        parts.push('Prüfe das Wort direkt davor auf einen Tippfehler.');
      }
      const keyword = /^[A-Za-z_]+$/.test(token) ? closestMatch(upper, SQL_KEYWORDS) : undefined;
      return {
        title: `Syntaxfehler bei ${q(token)}.`,
        hint: parts.join(' '),
        suggestion: suggestion(keyword),
      };
    },
  },
  {
    name: 'unrecognized-token',
    pattern: /unrecognized token:\s*"([^"]*)"/i,
    build: (m) => ({
      title: `Unbekanntes Zeichen bei ${q(m[1] as string)}.`,
      hint: "Meist ist ein Anführungszeichen nicht geschlossen. Textwerte stehen zwischen zwei '.",
    }),
  },
  {
    name: 'incomplete-input',
    pattern: /incomplete input/i,
    build: () => ({
      title: 'Die Anweisung ist unvollständig.',
      hint: `Fehlt eine Klammer ${q(')')} oder ein Anführungszeichen? Prüfe auch, ob das Statement zu Ende geschrieben ist.`,
    }),
  },
  {
    name: 'unique-constraint',
    pattern: /(?:UNIQUE|PRIMARY KEY) constraint failed:\s*(.+)$/i,
    build: (m) => {
      const columns = (m[1] as string)
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part !== '');
      const composite = columns.length > 1;
      return {
        title: composite
          ? `Die Kombination aus ${columns.map(q).join(' und ')} gibt es schon.`
          : `Der Wert in ${q(columns[0] ?? '')} ist schon vorhanden.`,
        hint: composite
          ? 'Diese Spalten müssen zusammen eindeutig sein. Ändere einen der Werte.'
          : 'Diese Spalte muss eindeutig sein. Wähle einen anderen Wert oder lass die id weg, SQLite vergibt sie automatisch.',
      };
    },
  },
  {
    name: 'not-null-constraint',
    pattern: /NOT NULL constraint failed:\s*(.+)$/i,
    build: (m) => ({
      title: `Die Spalte ${q((m[1] as string).trim())} darf nicht leer (NULL) sein.`,
      hint: 'Gib einen Wert an und prüfe die Reihenfolge der Werte.',
    }),
  },
  {
    name: 'foreign-key-constraint',
    pattern: /FOREIGN KEY constraint failed/i,
    build: () => ({
      title: 'Die Verweise zwischen den Tabellen würden ungültig.',
      hint:
        'Beim DELETE: Es gibt noch Zeilen, die auf diese Zeile verweisen, zum Beispiel Songs auf ein Album. ' +
        'Beim INSERT oder UPDATE: Die angegebene id existiert in der verwiesenen Tabelle nicht.',
    }),
  },
  {
    name: 'check-constraint',
    pattern: /CHECK constraint failed:\s*(.+)$/i,
    build: (m) => ({
      title: `Der Wert verletzt die Regel ${q((m[1] as string).trim())}.`,
      hint: 'Diese Spalte erlaubt nur bestimmte Werte, zum Beispiel Sterne von 1 bis 5.',
    }),
  },
  {
    name: 'column-count-mismatch',
    pattern: /table\s+(\S+)\s+has\s+(\d+)\s+columns but\s+(\d+)\s+values were supplied/i,
    build: (m) => ({
      title: `Die Tabelle ${q(m[1] as string)} hat ${spalten(m[2] as string)}, du hast ${werte(m[3] as string)} angegeben.`,
      hint: 'Zähle die Werte nach oder gib die Spalten an: INSERT INTO t (a, b) VALUES (…);',
    }),
  },
  {
    name: 'values-for-columns',
    pattern: /(\d+)\s+values for\s+(\d+)\s+columns/i,
    build: (m) => ({
      title: `Du hast ${werte(m[1] as string)} für ${spalten(m[2] as string)} angegeben.`,
      hint: 'Die Anzahl der Werte muss zur Spaltenliste passen.',
    }),
  },
  {
    name: 'no-such-function',
    pattern: /no such function:\s*(\S+)/i,
    build: (m) => ({
      title: `Die Funktion ${q(m[1] as string)} gibt es nicht.`,
      hint: 'Verfügbar sind zum Beispiel COUNT, SUM, AVG, MIN, MAX, LENGTH, UPPER, LOWER und ROUND.',
      suggestion: suggestion(closestMatch(m[1] as string, SQL_FUNCTIONS)),
    }),
  },
  {
    name: 'misuse-of-aggregate',
    pattern: /misuse of aggregate(?:\s+function)?:?\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(\)/i,
    build: (m) => ({
      title: `Die Aggregatfunktion ${q(`${m[1] as string}()`)} steht am falschen Ort.`,
      hint: 'Aggregate dürfen nicht in WHERE stehen. Gruppierte Resultate filterst du mit HAVING.',
    }),
  },
  {
    name: 'having-without-group-by',
    pattern: /a GROUP BY clause is required before HAVING|HAVING clause on a non-aggregate query/i,
    build: () => ({
      title: 'HAVING braucht eine Gruppierung davor.',
      hint: 'Ohne GROUP BY filterst du mit WHERE. Mit GROUP BY filterst du die Gruppen mit HAVING.',
    }),
  },
  {
    name: 'datatype-mismatch',
    pattern: /datatype mismatch/i,
    build: () => ({
      title: 'Der Datentyp passt nicht.',
      hint: 'Meist steht Text in einer Spalte mit INTEGER PRIMARY KEY. Zahlen schreibst du ohne Anführungszeichen.',
    }),
  },
  {
    name: 'transaction-state',
    pattern: /cannot commit|cannot rollback|within a transaction|no transaction is active/i,
    build: () => ({
      title: 'Der Transaktionsbefehl passt nicht zum Zustand.',
      hint: 'In diesem Kurs brauchst du BEGIN, COMMIT und ROLLBACK nicht.',
    }),
  },
];
