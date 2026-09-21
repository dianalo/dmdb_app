import { beforeEach, describe, expect, it } from 'vitest';
import {
  BuiltinNotDeletableError,
  createUserDatabase,
  deleteDatabase,
  getDatabaseMeta,
  listDatabases,
  loadDatabaseBytes,
  saveDatabase,
  updateDatabaseMeta,
} from './databases';
import { resetDmdbForTests } from './testSupport';
import type { DbMeta } from './types';

function builtinMeta(id: string, name: string): DbMeta {
  return {
    id,
    name,
    kind: 'builtin',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    seedId: 'musik-streaming',
    seedVersion: 1,
    modified: false,
    seedOutdated: false,
  };
}

describe('persistence/databases', () => {
  beforeEach(async () => {
    await resetDmdbForTests();
  });

  it('legt eine eigene Datenbank mit UUID und Zeitstempeln an', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const meta = await createUserDatabase('Meine DB', bytes);

    expect(meta.kind).toBe('user');
    expect(meta.modified).toBe(false);
    expect(meta.seedOutdated).toBe(false);
    expect(meta.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(Date.parse(meta.createdAt)).not.toBeNaN();
    await expect(getDatabaseMeta(meta.id)).resolves.toEqual(meta);
  });

  it('listet Builtins zuerst, danach nach Name', async () => {
    await saveDatabase(builtinMeta('builtin:zebra', 'Zebra'), new Uint8Array([0]));
    await saveDatabase(builtinMeta('builtin:musik', 'Musik-Streaming'), new Uint8Array([0]));
    await createUserDatabase('Bibliothek', new Uint8Array([0]));
    await createUserDatabase('Auto-Werkstatt', new Uint8Array([0]));

    const names = (await listDatabases()).map((meta) => meta.name);
    expect(names).toEqual(['Musik-Streaming', 'Zebra', 'Auto-Werkstatt', 'Bibliothek']);
  });

  it('speichert und lädt die Bytes unverändert', async () => {
    const bytes = new Uint8Array([0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x00, 0xff]);
    const meta = await createUserDatabase('Round-Trip', bytes);

    const loaded = await loadDatabaseBytes(meta.id);
    expect(loaded).toBeInstanceOf(Uint8Array);
    expect(Array.from(loaded ?? [])).toEqual(Array.from(bytes));
  });

  it('liefert undefined für unbekannte IDs', async () => {
    await expect(getDatabaseMeta('gibt-es-nicht')).resolves.toBeUndefined();
    await expect(loadDatabaseBytes('gibt-es-nicht')).resolves.toBeUndefined();
  });

  it('setzt beim Patchen updatedAt neu und lässt createdAt in Ruhe', async () => {
    const meta = await saveDatabase(builtinMeta('builtin:musik', 'Musik'), new Uint8Array([1]));

    const patched = await updateDatabaseMeta(meta.id, { name: 'Neuer Name', modified: true });
    expect(patched.name).toBe('Neuer Name');
    expect(patched.modified).toBe(true);
    expect(patched.createdAt).toBe(meta.createdAt);
    expect(Date.parse(patched.updatedAt)).toBeGreaterThanOrEqual(Date.parse(meta.updatedAt));
    expect(patched.updatedAt).not.toBe('2026-01-01T00:00:00.000Z');
  });

  it('wirft beim Patchen einer unbekannten Datenbank', async () => {
    await expect(updateDatabaseMeta('gibt-es-nicht', { name: 'x' })).rejects.toThrow(/gibt-es-nicht/);
  });

  it('löscht eigene Datenbanken samt Bytes', async () => {
    const meta = await createUserDatabase('Wegwerf', new Uint8Array([9]));
    await deleteDatabase(meta.id);

    await expect(getDatabaseMeta(meta.id)).resolves.toBeUndefined();
    await expect(loadDatabaseBytes(meta.id)).resolves.toBeUndefined();
    await expect(listDatabases()).resolves.toEqual([]);
  });

  it('weigert sich, eine Beispieldatenbank zu löschen', async () => {
    const meta = await saveDatabase(builtinMeta('builtin:musik', 'Musik'), new Uint8Array([1]));

    await expect(deleteDatabase(meta.id)).rejects.toBeInstanceOf(BuiltinNotDeletableError);
    await expect(getDatabaseMeta(meta.id)).resolves.toBeDefined();
    await expect(loadDatabaseBytes(meta.id)).resolves.toBeDefined();
  });
});
