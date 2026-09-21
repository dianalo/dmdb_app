/**
 * Das Herzstück der Ausführung: ein SQL-Script Statement für Statement laufen lassen
 * und pro Statement ein anzeigbares Resultat erzeugen.
 *
 * Bewusst kein `db.exec()`: das liefert bei einem Fehler mitten im Script keine
 * Teilresultate. Mit `db.iterateStatements()` werden `;` in Strings und Kommentaren
 * korrekt behandelt, und jedes Statement bekommt seinen Zeichenbereich im Quelltext.
 */
import type { Database, Statement } from 'sql.js';
import {
  DML_KEYWORDS,
  READ_ONLY_KEYWORDS,
  ddlVerb,
  effectiveKeyword,
  firstKeyword,
  schemaVersion,
  skipTrivia,
  statementEnd,
} from './classify';
import { translateError } from './errors/translate';
import type { ErrorContext, RunOutcome, SqlValue, StatementResult } from './types';
import { ROW_CAP } from './types';

/**
 * Führt `sql` aus und stoppt beim ersten Fehler; bereits ausgeführte Statements
 * bleiben wirksam (kein Rollback, bewusst einfach).
 *
 * @param offset Startposition des Scripts im Editorinhalt, damit die Bereiche
 *   auch beim Ausführen einer Selektion auf den ganzen Text zeigen.
 */
export function runScript(db: Database, sql: string, ctx: ErrorContext, offset = 0): RunOutcome {
  const results: StatementResult[] = [];
  let dirty = false;

  // Könnte von den Schüler:innen abgeschaltet worden sein, darum vor jedem Lauf.
  db.run('PRAGMA foreign_keys = ON');

  if (skipTrivia(sql) >= sql.length) return { results, dirty };

  const iterator = db.iterateStatements(sql);
  let version = schemaVersion(db);

  for (;;) {
    const remainingBefore = iterator.getRemainingSQL();
    const start = sql.length - remainingBefore.length;

    let stmt: Statement;
    try {
      const next = iterator.next();
      if (next.done) break;
      stmt = next.value;
    } catch (error) {
      // Fehler beim Vorbereiten: `getRemainingSQL()` beginnt beim fehlerhaften Statement.
      const rest = safeRemaining(iterator, remainingBefore);
      const failed = failedRange(sql, sql.length - rest.length);
      results.push({
        kind: 'error',
        sql: failed.sql || rest.trim(),
        error: translateError(messageOf(error), ctx),
        range: [offset + failed.start, offset + failed.end],
      });
      return { results, dirty };
    }

    const started = performance.now();
    try {
      const columns = stmt.getColumnNames();
      const text = statementText(sql, start, iterator);
      const range: [number, number] = [offset + text.start, offset + text.end];

      if (columns.length > 0) {
        // 1. Resultatmenge: SELECT, WITH … SELECT, VALUES, PRAGMA-Abfragen, INSERT … RETURNING.
        const rows: SqlValue[][] = [];
        let truncated = false;
        while (stmt.step()) {
          if (rows.length >= ROW_CAP) {
            // Nicht weiterzählen: genau das wäre bei kartesischen Produkten der Freeze.
            truncated = true;
            break;
          }
          rows.push(stmt.get() as SqlValue[]);
        }
        const nextVersion = schemaVersion(db);
        if (nextVersion !== version || DML_KEYWORDS.has(effectiveKeyword(text.sql))) dirty = true;
        version = nextVersion;
        results.push({
          kind: 'rows',
          sql: text.sql,
          columns,
          rows,
          truncated,
          ms: performance.now() - started,
          range,
        });
        continue;
      }

      while (stmt.step()) {
        // Statements ohne Resultatmenge liefern beim ersten Schritt bereits false.
      }

      const keyword = effectiveKeyword(text.sql);
      if (DML_KEYWORDS.has(keyword)) {
        // 2. DML: `getRowsModified()` jetzt lesen, bevor eine andere Abfrage läuft.
        const changes = db.getRowsModified();
        version = schemaVersion(db);
        if (changes > 0) dirty = true;
        results.push({
          kind: 'changes',
          sql: text.sql,
          changes,
          ms: performance.now() - started,
          range,
        });
        continue;
      }

      const nextVersion = schemaVersion(db);
      if (nextVersion !== version) {
        // 3. DDL: erkannt am geänderten Schema, nicht an `getRowsModified()`.
        version = nextVersion;
        dirty = true;
        results.push({
          kind: 'ddl',
          sql: text.sql,
          verb: ddlVerb(firstKeyword(text.sql)),
          ms: performance.now() - started,
          range,
        });
        continue;
      }

      // 4. Sonst «OK». Unbekannte, nicht lesende Schlüsselwörter (VACUUM, ATTACH …)
      //    sicherheitshalber als schreibend werten.
      if (keyword !== '' && !READ_ONLY_KEYWORDS.has(keyword) && !DML_KEYWORDS.has(keyword)) {
        dirty = true;
      }
      results.push({ kind: 'ok', sql: text.sql, ms: performance.now() - started, range });
    } catch (error) {
      const failed = failedRange(sql, start);
      const nextVersion = schemaVersion(db);
      if (nextVersion !== version) dirty = true;
      results.push({
        kind: 'error',
        sql: failed.sql,
        error: translateError(messageOf(error), ctx),
        range: [offset + failed.start, offset + failed.end],
      });
      return { results, dirty };
    } finally {
      stmt.free();
    }
  }

  return { results, dirty };
}

/** Text und Zeichenbereich des zuletzt vorbereiteten Statements, ohne führenden Leerraum. */
function statementText(
  sql: string,
  rawStart: number,
  iterator: { getRemainingSQL(): string },
): { sql: string; start: number; end: number } {
  const rawEnd = sql.length - iterator.getRemainingSQL().length;
  const slice = sql.slice(rawStart, Math.max(rawStart, rawEnd));
  const leading = slice.length - slice.trimStart().length;
  const trailing = slice.length - slice.trimEnd().length;
  return {
    sql: slice.trim(),
    start: rawStart + leading,
    end: Math.max(rawStart + leading, rawEnd - trailing),
  };
}

/**
 * Text und Zeichenbereich des fehlerhaften Statements: ab dem ersten inhaltlichen
 * Zeichen bis zum nächsten Semikolon ausserhalb von Strings und Kommentaren.
 */
function failedRange(sql: string, rawStart: number): { sql: string; start: number; end: number } {
  const start = Math.min(skipTrivia(sql, rawStart), sql.length);
  const rawEnd = statementEnd(sql, start);
  const slice = sql.slice(start, rawEnd);
  const trailing = slice.length - slice.trimEnd().length;
  return { sql: slice.trim(), start, end: Math.max(start, rawEnd - trailing) };
}

/** `getRemainingSQL()` kann nach einem Fehler nicht mehr verfügbar sein. */
function safeRemaining(iterator: { getRemainingSQL(): string }, fallback: string): string {
  try {
    const rest = iterator.getRemainingSQL();
    return rest === '' ? fallback : rest;
  } catch {
    return fallback;
  }
}

/** Die englische Originalmeldung aus einem geworfenen Wert. */
function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
