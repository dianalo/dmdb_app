/**
 * Vertrag der Seed-Registry (`src/seeds/index.ts`).
 * Das SQL wird per `?raw`-Import aus der eingecheckten `.sql`-Datei geladen.
 */
export interface Seed {
  /** Stabiler Slug, z. B. `musik-streaming`. */
  id: string;
  /** Anzeigename, z. B. «Musik-Streaming». */
  name: string;
  /** Wird bei inhaltlichen Änderungen erhöht; steuert den Seed-Versionsabgleich. */
  version: number;
  /** Vollständiges SQL-Script (DDL + INSERTs). */
  sql: string;
}
