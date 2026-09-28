/**
 * Die Engine als Modul-Singleton ausserhalb von React.
 *
 * Komponenten importieren diese Datei nie; nur Store-Aktionen tun das (PLAN.md,
 * «State»). sql.js wird über einen austauschbaren Loader geladen, damit Tests
 * ein in Node initialisiertes Modul hineinreichen können.
 */
import type { SqlJsStatic } from 'sql.js';
import { createEngine, loadSqlJs, type Engine } from '@/db';
import type { SeedBuilder } from '@/persistence';

type SqlJsLoader = () => Promise<SqlJsStatic>;

let loader: SqlJsLoader = loadSqlJs;
let sqlPromise: Promise<SqlJsStatic> | null = null;
let engine: Engine | null = null;

/** Nur für Tests: sql.js aus einer anderen Quelle laden und die Engine vergessen. */
export function setSqlJsLoader(next: SqlJsLoader): void {
  loader = next;
  sqlPromise = null;
  engine = null;
}

/** Das initialisierte sql.js-Modul (einmal pro Sitzung). */
export function getSqlJs(): Promise<SqlJsStatic> {
  sqlPromise ??= loader().catch((error: unknown) => {
    sqlPromise = null;
    throw error;
  });
  return sqlPromise;
}

/** Die eine Engine der App, die die aktive Datenbank hält. */
export async function getEngine(): Promise<Engine> {
  if (engine === null) engine = createEngine(await getSqlJs());
  return engine;
}

/**
 * Eine frische, temporäre Engine, z. B. zum Aufbauen aus einem Seed oder zum Prüfen
 * eines Imports. Die aktive Datenbank bleibt dabei unberührt.
 */
export async function withScratchEngine<T>(fn: (scratch: Engine) => Promise<T>): Promise<T> {
  const scratch = createEngine(await getSqlJs());
  try {
    return await fn(scratch);
  } finally {
    await scratch.close();
  }
}

/** Baut Seeds in einer temporären Engine auf (für `reconcileSeeds` und `resetBuiltin`). */
export const seedBuilder: SeedBuilder = {
  buildFromSql: (sql) =>
    withScratchEngine(async (scratch) => {
      await scratch.openFromSql(sql);
      return scratch.snapshot();
    }),
};
