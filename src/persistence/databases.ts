/**
 * CRUD für Datenbanken: Metadaten im Store `dbMeta`, SQLite-Bytes im Store `dbBlobs`.
 * Beide werden immer in **einer** `readwrite`-Transaktion geschrieben (PLAN.md).
 */
import { openDmdb } from './idb';
import { newId, nowIso } from './ids';
import type { DbMeta } from './types';

/** Wird geworfen, wenn eine mitgelieferte Beispieldatenbank gelöscht werden soll. */
export class BuiltinNotDeletableError extends Error {
  readonly id: string;

  constructor(id: string) {
    super(`Die Beispieldatenbank «${id}» kann nicht gelöscht werden.`);
    this.name = 'BuiltinNotDeletableError';
    this.id = id;
  }
}

/** Felder, die von aussen an einer Meta geändert werden dürfen. */
export type DbMetaPatch = Partial<Omit<DbMeta, 'id' | 'createdAt'>>;

/** Builtins zuerst, danach alphabetisch nach Name (Schweizer Sortierung). */
function compareDbMeta(a: DbMeta, b: DbMeta): number {
  if (a.kind !== b.kind) return a.kind === 'builtin' ? -1 : 1;
  const byName = a.name.localeCompare(b.name, 'de-CH');
  return byName !== 0 ? byName : a.id.localeCompare(b.id);
}

/** Alle Datenbanken ohne ihre Bytes: Builtins zuerst, dann nach Name. */
export async function listDatabases(): Promise<DbMeta[]> {
  const db = await openDmdb();
  const all = await db.getAll('dbMeta');
  return all.sort(compareDbMeta);
}

/** Metadaten einer Datenbank, `undefined` wenn es sie nicht gibt. */
export async function getDatabaseMeta(id: string): Promise<DbMeta | undefined> {
  const db = await openDmdb();
  return db.get('dbMeta', id);
}

/** Die SQLite-Bytes einer Datenbank, `undefined` wenn es sie nicht gibt. */
export async function loadDatabaseBytes(id: string): Promise<Uint8Array | undefined> {
  const db = await openDmdb();
  return db.get('dbBlobs', id);
}

/**
 * Schreibt Meta und Bytes in einer Transaktion und setzt dabei `updatedAt`.
 * Liefert die tatsächlich gespeicherte Meta zurück.
 */
export async function saveDatabase(meta: DbMeta, bytes: Uint8Array): Promise<DbMeta> {
  const db = await openDmdb();
  const stored: DbMeta = { ...meta, updatedAt: nowIso() };

  const tx = db.transaction(['dbMeta', 'dbBlobs'], 'readwrite');
  await Promise.all([
    tx.objectStore('dbMeta').put(stored),
    tx.objectStore('dbBlobs').put(bytes, stored.id),
    tx.done,
  ]);
  return stored;
}

/**
 * Ändert einzelne Meta-Felder und setzt `updatedAt` neu
 * (ausser der Patch gibt selbst ein `updatedAt` vor).
 */
export async function updateDatabaseMeta(id: string, patch: DbMetaPatch): Promise<DbMeta> {
  const db = await openDmdb();
  const tx = db.transaction('dbMeta', 'readwrite');
  const store = tx.objectStore('dbMeta');
  const current = await store.get(id);
  if (!current) {
    await tx.done;
    throw new Error(`Es gibt keine Datenbank mit der ID «${id}».`);
  }
  const next: DbMeta = { ...current, ...patch, id: current.id, createdAt: current.createdAt };
  if (patch.updatedAt === undefined) {
    next.updatedAt = nowIso();
  }
  await store.put(next);
  await tx.done;
  return next;
}

/** Löscht Meta und Bytes einer eigenen Datenbank. Builtins sind geschützt. */
export async function deleteDatabase(id: string): Promise<void> {
  const db = await openDmdb();
  const meta = await db.get('dbMeta', id);
  if (meta?.kind === 'builtin') {
    throw new BuiltinNotDeletableError(id);
  }

  const tx = db.transaction(['dbMeta', 'dbBlobs'], 'readwrite');
  await Promise.all([
    tx.objectStore('dbMeta').delete(id),
    tx.objectStore('dbBlobs').delete(id),
    tx.done,
  ]);
}

/** Legt eine eigene Datenbank aus fertigen SQLite-Bytes an (neue DB oder Import). */
export async function createUserDatabase(name: string, bytes: Uint8Array): Promise<DbMeta> {
  const createdAt = nowIso();
  const meta: DbMeta = {
    id: newId(),
    name,
    kind: 'user',
    createdAt,
    updatedAt: createdAt,
    modified: false,
    seedOutdated: false,
  };
  return saveDatabase(meta, bytes);
}
