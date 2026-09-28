/**
 * Vertrag der Seed-Registry (`src/seeds/index.ts`).
 *
 * `id`, `name` und `version` sind statisch, damit der Versionsabgleich beim Start
 * ohne das SQL auskommt. Das SQL selbst (einige hundert KB) wird erst geladen, wenn
 * eine Beispieldatenbank tatsächlich (neu) aufgebaut werden muss.
 */
export interface Seed {
  /** Stabiler Slug, z. B. `musik-streaming`. */
  id: string;
  /** Anzeigename, z. B. «Musik-Streaming». */
  name: string;
  /** Wird bei inhaltlichen Änderungen erhöht; steuert den Seed-Versionsabgleich. */
  version: number;
  /** Lädt das vollständige SQL-Script (DDL + INSERTs), z. B. per dynamischem `?raw`-Import. */
  loadSql(): Promise<string>;
}
