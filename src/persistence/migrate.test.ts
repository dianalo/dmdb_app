import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDatabaseMeta, loadDatabaseBytes, saveDatabase } from './databases';
import { markModified, reconcileSeeds, resetBuiltin } from './migrate';
import { resetDmdbForTests } from './testSupport';
import type { DbMeta, SeedBuilder } from './types';
import type { Seed } from '../seeds/types';

const SQL_V1 = 'CREATE TABLE song(id INTEGER PRIMARY KEY); -- v1';
const SQL_V2 = 'CREATE TABLE song(id INTEGER PRIMARY KEY); -- v2';

const seedV1: Seed = {
  id: 'musik-streaming',
  name: 'Musik-Streaming',
  version: 1,
  loadSql: () => Promise.resolve(SQL_V1),
};

const seedV2: Seed = { ...seedV1, version: 2, loadSql: () => Promise.resolve(SQL_V2) };

/** Attrappe der Engine: das «SQLite-File» ist schlicht das SQL als UTF-8. */
function fakeBuilder(): SeedBuilder & { buildFromSql: ReturnType<typeof vi.fn> } {
  return {
    buildFromSql: vi.fn((sql: string) => Promise.resolve(new TextEncoder().encode(sql))),
  };
}

const idFor = (seed: Seed): string => `builtin:${seed.id}`;
const ID = idFor(seedV1);

function decode(bytes: Uint8Array | undefined): string {
  return bytes ? new TextDecoder().decode(bytes) : '';
}

async function storeBuiltin(overrides: Partial<DbMeta>, sql: string): Promise<DbMeta> {
  const meta: DbMeta = {
    id: ID,
    name: seedV1.name,
    kind: 'builtin',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    seedId: seedV1.id,
    seedVersion: 1,
    modified: false,
    seedOutdated: false,
    ...overrides,
  };
  return saveDatabase(meta, new TextEncoder().encode(sql));
}

describe('persistence/migrate: reconcileSeeds', () => {
  beforeEach(async () => {
    await resetDmdbForTests();
  });

  it('übernimmt einen neuen Anzeigenamen, auch bei einer veränderten Kopie', async () => {
    await storeBuiltin({ modified: true }, 'CREATE TABLE eigene(x); -- verändert');
    const renamed: Seed = { ...seedV2, name: 'k♪t Musik-Streaming' };
    await reconcileSeeds([renamed], fakeBuilder(), idFor);

    const meta = await getDatabaseMeta(ID);
    expect(meta?.name).toBe('k♪t Musik-Streaming');
    expect(meta?.seedOutdated).toBe(true);
    expect(decode(await loadDatabaseBytes(ID))).toContain('verändert');
  });

  it('kein Eintrag: baut die Datenbank aus dem Seed auf', async () => {
    const builder = fakeBuilder();
    const result = await reconcileSeeds([seedV1], builder, idFor);

    expect(result).toEqual({ created: [ID], rebuilt: [], outdated: [] });
    expect(builder.buildFromSql).toHaveBeenCalledWith(SQL_V1);

    const meta = await getDatabaseMeta(ID);
    expect(meta).toMatchObject({
      id: ID,
      name: 'Musik-Streaming',
      kind: 'builtin',
      seedId: 'musik-streaming',
      seedVersion: 1,
      modified: false,
      seedOutdated: false,
    });
    expect(decode(await loadDatabaseBytes(ID))).toBe(SQL_V1);
  });

  it('gleiche Version: tut nichts', async () => {
    await storeBuiltin({}, 'STAND DER SUS');
    const builder = fakeBuilder();

    const loadSql = vi.fn(seedV1.loadSql);

    const result = await reconcileSeeds([{ ...seedV1, loadSql }], builder, idFor);

    expect(result).toEqual({ created: [], rebuilt: [], outdated: [] });
    expect(builder.buildFromSql).not.toHaveBeenCalled();
    // Der Versionsabgleich kommt ohne das (grosse) Seed-SQL aus.
    expect(loadSql).not.toHaveBeenCalled();
    expect(decode(await loadDatabaseBytes(ID))).toBe('STAND DER SUS');
  });

  it('ältere Version und unverändert: baut stillschweigend neu auf', async () => {
    await storeBuiltin({ seedVersion: 1, modified: false }, 'ALTER STAND');
    const builder = fakeBuilder();

    const result = await reconcileSeeds([seedV2], builder, idFor);

    expect(result).toEqual({ created: [], rebuilt: [ID], outdated: [] });
    expect(decode(await loadDatabaseBytes(ID))).toBe(SQL_V2);

    const meta = await getDatabaseMeta(ID);
    expect(meta?.seedVersion).toBe(2);
    expect(meta?.seedOutdated).toBe(false);
    expect(meta?.modified).toBe(false);
    expect(meta?.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('ältere Version und verändert: behält die Bytes und markiert sie als veraltet', async () => {
    const stored = await storeBuiltin({ seedVersion: 1, modified: true }, 'STAND DER SUS');
    const builder = fakeBuilder();

    const result = await reconcileSeeds([seedV2], builder, idFor);

    expect(result).toEqual({ created: [], rebuilt: [], outdated: [ID] });
    expect(builder.buildFromSql).not.toHaveBeenCalled();
    expect(decode(await loadDatabaseBytes(ID))).toBe('STAND DER SUS');

    const meta = await getDatabaseMeta(ID);
    expect(meta?.seedOutdated).toBe(true);
    expect(meta?.modified).toBe(true);
    expect(meta?.seedVersion).toBe(1);
    // Nur ein Hinweis, kein inhaltliches Update: updatedAt bleibt stehen.
    expect(meta?.updatedAt).toBe(stored.updatedAt);
  });

  it('baut neu auf, wenn die Meta da ist, die Bytes aber fehlen', async () => {
    await storeBuiltin({}, 'egal');
    const db = await (await import('./idb')).openDmdb();
    await db.delete('dbBlobs', ID);

    const builder = fakeBuilder();
    const result = await reconcileSeeds([seedV1], builder, idFor);

    expect(result.rebuilt).toEqual([ID]);
    expect(decode(await loadDatabaseBytes(ID))).toBe(SQL_V1);
  });

  it('verarbeitet mehrere Seeds in einem Durchgang', async () => {
    const other: Seed = {
      id: 'bibliothek',
      name: 'Bibliothek',
      version: 1,
      loadSql: () => Promise.resolve('-- bibliothek'),
    };
    const result = await reconcileSeeds([seedV1, other], fakeBuilder(), idFor);

    expect(result.created).toEqual([ID, 'builtin:bibliothek']);
  });
});

describe('persistence/migrate: resetBuiltin und markModified', () => {
  beforeEach(async () => {
    await resetDmdbForTests();
  });

  it('resetBuiltin baut aus dem aktuellen Seed neu auf und löscht die Flags', async () => {
    await storeBuiltin({ seedVersion: 1, modified: true, seedOutdated: true }, 'KAPUTT');

    const meta = await resetBuiltin(seedV2, fakeBuilder(), ID);

    expect(meta.modified).toBe(false);
    expect(meta.seedOutdated).toBe(false);
    expect(meta.seedVersion).toBe(2);
    expect(meta.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(decode(await loadDatabaseBytes(ID))).toBe(SQL_V2);
  });

  it('resetBuiltin funktioniert auch, wenn es die Datenbank noch nicht gibt', async () => {
    const meta = await resetBuiltin(seedV1, fakeBuilder(), ID);

    expect(meta.kind).toBe('builtin');
    expect(decode(await loadDatabaseBytes(ID))).toBe(SQL_V1);
  });

  it('markModified setzt das Flag', async () => {
    await storeBuiltin({}, 'egal');
    expect((await getDatabaseMeta(ID))?.modified).toBe(false);

    const meta = await markModified(ID);
    expect(meta.modified).toBe(true);
    expect((await getDatabaseMeta(ID))?.modified).toBe(true);
  });
});
