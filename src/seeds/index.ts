import type { Seed } from './types';

/** Präfix der IDs vordefinierter Datenbanken in IndexedDB. */
export const BUILTIN_DB_ID_PREFIX = 'builtin:';

/** ID der vordefinierten Datenbank zu einem Seed, z. B. `builtin:musik-streaming`. */
export function builtinDbId(seed: Seed): string {
  return BUILTIN_DB_ID_PREFIX + seed.id;
}

/**
 * Beispieldatenbank der LPU, generiert von `scripts/generate-seed.ts`.
 *
 * Inhaltlich: Beispieldatenbank des Streaming-Dienstes «kanti♪tunes».
 * Der Anzeigename bleibt «Musik-Streaming»; der Seed-Vertrag (`Seed`) kennt
 * bewusst kein `description`-Feld, darum steht die Beschreibung hier.
 */
export const musikStreaming: Seed = {
  id: 'musik-streaming',
  name: 'Musik-Streaming',
  version: 1,
  // Eigener Chunk: wird nur geladen, wenn die Datenbank (neu) aufgebaut wird.
  loadSql: () => import('./musik_streaming.sql?raw').then((module) => module.default),
};

/** Alle mitgelieferten Seeds. */
export const builtinSeeds: Seed[] = [musikStreaming];
