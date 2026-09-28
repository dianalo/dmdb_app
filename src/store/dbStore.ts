/**
 * Zustand der Datenbanken: Liste, aktive Datenbank, deren Schema.
 *
 * Alle Aktionen, die die Engine oder die gespeicherten Bytes anfassen, laufen
 * nacheinander (`exclusive`), damit z. B. ein Datenbankwechsel nie mitten in das
 * Speichern eines Laufs fällt.
 */
import { create } from 'zustand';
import {
  SqlError,
  translateThrown,
  type ErrorContext,
  type RunOutcome,
  type TranslatedError,
} from '@/db';
import { downloadBytes } from '@/files/download';
import { de } from '@/i18n/de';
import {
  BuiltinNotDeletableError,
  createUserDatabase,
  deleteDatabase as deleteStoredDatabase,
  getDatabaseMeta,
  getSetting,
  listDatabases,
  loadDatabaseBytes,
  openDmdb,
  reconcileSeeds,
  resetBuiltin as resetStoredBuiltin,
  saveDatabase,
  setSetting,
  type DbMeta,
} from '@/persistence';
import { builtinDbId, builtinSeeds } from '@/seeds';
import { getEngine, seedBuilder, withScratchEngine } from './engine';
import { nameFromFilename, uniqueName } from './names';

export type DbStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Ergebnis von `persistIfDirty`: `error` ist gesetzt, wenn das Speichern scheiterte. */
export interface PersistResult {
  saved: boolean;
  error?: TranslatedError;
}

export interface DbState {
  status: DbStatus;
  /** Meldung für den Fehlerbildschirm, wenn `status === 'error'`. */
  error?: string;
  databases: DbMeta[];
  activeDbId: string | null;
  /** Tabellennamen der aktiven Datenbank, alphabetisch. */
  tables: string[];
  /** Tabellen und ihre Spalten, für Autocomplete und Fehlervorschläge. */
  errorContext: ErrorContext;

  init(): Promise<void>;
  switchDatabase(id: string): Promise<void>;
  refreshSchema(): Promise<void>;
  /** Führt ein Script aus, speichert bei Bedarf und aktualisiert nach DDL das Schema. */
  execute(sql: string, offset?: number): Promise<RunOutcome & { persist: PersistResult }>;
  persistIfDirty(dirty: boolean): Promise<PersistResult>;
  /** Setzt die aktive Beispieldatenbank auf den aktuellen Seed zurück. */
  resetBuiltin(): Promise<void>;
  /** Neue eigene Datenbank aus einem DDL-Script; wirft `SqlError`, dann wird nichts gespeichert. */
  createFromDdl(name: string, ddl: string): Promise<DbMeta>;
  /** Löscht eine eigene Datenbank; ist sie aktiv, wird zur Beispieldatenbank gewechselt. */
  deleteDatabase(id: string): Promise<void>;
  /** Importiert eine `.sqlite`-Datei als eigene Datenbank und aktiviert sie. */
  importSqlite(name: string, bytes: Uint8Array): Promise<DbMeta>;
  /** Wie `importSqlite`, der Name kommt aus dem Dateinamen (ohne Endung, eindeutig gemacht). */
  importSqliteFile(filename: string, bytes: Uint8Array): Promise<DbMeta>;
  /** Lädt die aktive Datenbank als `.sqlite` herunter (nur im Browser). */
  downloadActive(): Promise<void>;
}

const EMPTY_CONTEXT: ErrorContext = { tables: [], columns: {} };

const defaultBuiltinId = (): string => {
  const first = builtinSeeds[0];
  if (!first) throw new Error('Es ist keine Beispieldatenbank registriert.');
  return builtinDbId(first);
};

/** Serialisiert alle Engine-Aktionen. */
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
}

let initPromise: Promise<void> | null = null;

export const useDbStore = create<DbState>()((set, get) => {
  /** Tabellen und Spalten neu aus der Engine lesen (ohne Queue, nur intern). */
  async function loadSchema(): Promise<void> {
    const engine = await getEngine();
    const errorContext = await engine.errorContext();
    set({ tables: errorContext.tables, errorContext });
  }

  /** Öffnet die Datenbank `id` in der Engine und macht sie aktiv (ohne Queue). */
  async function activate(id: string): Promise<void> {
    const bytes = await loadDatabaseBytes(id);
    if (!bytes) throw new Error(de.errors.dbNotFound);
    const engine = await getEngine();
    await engine.open(bytes);
    const errorContext = await engine.errorContext();
    // In einem Schritt setzen, damit Abonnenten nie eine neue ID mit altem Schema sehen.
    set({ activeDbId: id, tables: errorContext.tables, errorContext });
    await setSetting('activeDbId', id);
  }

  async function refreshList(): Promise<void> {
    set({ databases: await listDatabases() });
  }

  function activeMeta(): DbMeta | undefined {
    const { databases, activeDbId } = get();
    return databases.find((db) => db.id === activeDbId);
  }

  async function persist(dirty: boolean): Promise<PersistResult> {
    const id = get().activeDbId;
    if (!dirty || id === null) return { saved: false };
    try {
      const engine = await getEngine();
      const bytes = await engine.snapshot();
      const meta = (await getDatabaseMeta(id)) ?? activeMeta();
      if (!meta) throw new Error(de.errors.dbNotFound);
      // `modified: true` entspricht `markModified()`, aber in derselben Transaktion wie die Bytes.
      const stored = await saveDatabase({ ...meta, modified: true }, bytes);
      set((state) => ({
        databases: state.databases.map((db) => (db.id === stored.id ? stored : db)),
      }));
      return { saved: true };
    } catch (error) {
      return {
        saved: false,
        error: error instanceof SqlError ? error.translated : translateThrown(error),
      };
    }
  }

  return {
    status: 'idle',
    databases: [],
    activeDbId: null,
    tables: [],
    errorContext: EMPTY_CONTEXT,

    init() {
      initPromise ??= exclusive(async () => {
        set({ status: 'loading', error: undefined });
        try {
          await openDmdb();
          await reconcileSeeds(builtinSeeds, seedBuilder, builtinDbId);
          await refreshList();
          const stored = await getSetting('activeDbId');
          const known = get().databases.some((db) => db.id === stored);
          const id = stored !== undefined && known ? stored : defaultBuiltinId();
          try {
            await activate(id);
          } catch (error) {
            // Eigene DB kaputt oder verschwunden: auf die Beispieldatenbank ausweichen.
            if (id === defaultBuiltinId()) throw error;
            await activate(defaultBuiltinId());
          }
          set({ status: 'ready' });
        } catch (error) {
          initPromise = null;
          set({
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
      return initPromise;
    },

    switchDatabase(id) {
      return exclusive(async () => {
        if (id === get().activeDbId) return;
        await activate(id);
      });
    },

    refreshSchema() {
      return exclusive(loadSchema);
    },

    execute(sql, offset = 0) {
      return exclusive(async () => {
        const engine = await getEngine();
        const outcome = await engine.run(sql, offset);
        const persistResult = await persist(outcome.dirty);
        if (outcome.results.some((result) => result.kind === 'ddl')) await loadSchema();
        return { ...outcome, persist: persistResult };
      });
    },

    persistIfDirty(dirty) {
      return exclusive(() => persist(dirty));
    },

    resetBuiltin() {
      return exclusive(async () => {
        const meta = activeMeta();
        if (!meta || meta.kind !== 'builtin') return;
        const seed = builtinSeeds.find((candidate) => candidate.id === meta.seedId);
        if (!seed) throw new Error(de.errors.noSeed);
        await resetStoredBuiltin(seed, seedBuilder, meta.id);
        await refreshList();
        // `activate` würde bei gleicher ID nicht neu laden, darum direkt öffnen.
        const bytes = await loadDatabaseBytes(meta.id);
        if (!bytes) throw new Error(de.errors.dbNotFound);
        await (await getEngine()).open(bytes);
        await loadSchema();
      });
    },

    createFromDdl(name, ddl) {
      return exclusive(async () => {
        const bytes = await withScratchEngine(async (scratch) => {
          await scratch.openFromSql(ddl); // wirft SqlError mit übersetzter Meldung
          return scratch.snapshot();
        });
        const meta = await createUserDatabase(name, bytes);
        await refreshList();
        await activate(meta.id);
        return meta;
      });
    },

    deleteDatabase(id) {
      return exclusive(async () => {
        const meta = get().databases.find((db) => db.id === id);
        if (meta?.kind === 'builtin') throw new BuiltinNotDeletableError(id);
        if (get().activeDbId === id) await activate(defaultBuiltinId());
        await deleteStoredDatabase(id);
        await refreshList();
      });
    },

    importSqlite(name, bytes) {
      return exclusive(async () => {
        const checked = await withScratchEngine(async (scratch) => {
          try {
            await scratch.open(bytes);
            if (!(await scratch.integrityCheck())) throw new Error('integrity_check failed');
            return await scratch.snapshot();
          } catch {
            throw new Error(de.errors.importInvalid);
          }
        });
        const meta = await createUserDatabase(name, checked);
        await refreshList();
        await activate(meta.id);
        return meta;
      });
    },

    importSqliteFile(filename, bytes) {
      const existing = get().databases.map((db) => db.name);
      const name = uniqueName(nameFromFilename(filename, de.dialogs.importFallbackName), existing);
      return get().importSqlite(name, bytes);
    },

    downloadActive() {
      return exclusive(async () => {
        const meta = activeMeta();
        if (!meta) return;
        const bytes = await (await getEngine()).snapshot();
        downloadBytes(`${meta.name}.sqlite`, bytes);
      });
    },
  };
});

/** Nur für Tests: Store und Init-Memo zurücksetzen. */
export function resetDbStoreForTests(): void {
  initPromise = null;
  queue = Promise.resolve();
  useDbStore.setState({
    status: 'idle',
    error: undefined,
    databases: [],
    activeDbId: null,
    tables: [],
    errorContext: EMPTY_CONTEXT,
  });
}
