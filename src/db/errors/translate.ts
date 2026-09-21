/**
 * `translateError` ist pur: Meldung plus Schema-Kontext hinein, deutsche Erklärung heraus.
 * Die englische Originalmeldung bleibt immer erhalten und wird in der UI klein darunter gezeigt.
 */
import type { ErrorContext, TranslatedError } from '../types';
import { RULES } from './rules';

const EMPTY_CONTEXT: ErrorContext = { tables: [], columns: {} };

/** Übersetzt eine SQLite-Meldung; greift auf einen neutralen Text zurück, wenn keine Regel passt. */
export function translateError(
  message: string,
  ctx: ErrorContext = EMPTY_CONTEXT,
): TranslatedError {
  const original = cleanMessage(message);
  for (const rule of RULES) {
    const match = original.match(rule.pattern);
    if (match === null) continue;
    const result = rule.build(match, ctx);
    if (result === null) continue;
    return { ...result, original };
  }
  return {
    title: 'SQLite meldet einen Fehler.',
    hint: 'Die Originalmeldung unten nennt die Stelle. Prüfe Schreibweise, Klammern und Anführungszeichen.',
    original,
  };
}

/** Fehler in einen `TranslatedError` verwandeln, egal was geworfen wurde. */
export function translateThrown(error: unknown, ctx?: ErrorContext): TranslatedError {
  const message = error instanceof Error ? error.message : String(error);
  return translateError(message, ctx);
}

/** Ein Fehler, der seine übersetzte Fassung mitträgt. */
export class SqlError extends Error {
  readonly translated: TranslatedError;

  constructor(translated: TranslatedError) {
    super(translated.title);
    this.name = 'SqlError';
    this.translated = translated;
  }
}

/** sql.js stellt Meldungen manchmal ein «Error: » voran. */
function cleanMessage(message: string): string {
  return message.replace(/^Error:\s*/i, '').trim();
}
