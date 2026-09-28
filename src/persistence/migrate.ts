/**
 * Seed-Versionsabgleich beim Start (PLAN.md, «Persistenz»):
 *
 * | Zustand                                | Aktion                                       |
 * |----------------------------------------|----------------------------------------------|
 * | kein Eintrag                           | aus Seed aufbauen und speichern              |
 * | gleiche (oder neuere) Version          | nichts                                       |
 * | ältere Version, `modified === false`   | stillschweigend neu aufbauen                 |
 * | ältere Version, `modified === true`    | Stand behalten, `seedOutdated = true`        |
 *
 * Die Engine wird als `SeedBuilder` hereingereicht, damit diese Datei sql.js
 * weder importiert noch kennt.
 */
import { getDatabaseMeta, loadDatabaseBytes, saveDatabase, updateDatabaseMeta } from './databases';
import { nowIso } from './ids';
import type { DbMeta, SeedBuilder, SeedReconcileResult } from './types';
import type { Seed } from '../seeds/types';

/** Bildet einen Seed auf die ID seiner Builtin-Datenbank ab, z. B. `builtin:musik-streaming`. */
export type BuiltinDbId = (seed: Seed) => string;

function freshBuiltinMeta(seed: Seed, id: string, createdAt: string): DbMeta {
  return {
    id,
    name: seed.name,
    kind: 'builtin',
    createdAt,
    updatedAt: createdAt,
    seedId: seed.id,
    seedVersion: seed.version,
    modified: false,
    seedOutdated: false,
  };
}

/**
 * Gleicht alle Builtins mit den mitgelieferten Seeds ab.
 * Liefert, welche Datenbanken neu angelegt, neu gebaut oder als veraltet markiert wurden.
 */
export async function reconcileSeeds(
  seeds: Seed[],
  builder: SeedBuilder,
  builtinDbId: BuiltinDbId,
): Promise<SeedReconcileResult> {
  const result: SeedReconcileResult = { created: [], rebuilt: [], outdated: [] };

  for (const seed of seeds) {
    const id = builtinDbId(seed);
    const meta = await getDatabaseMeta(id);

    // Kein Eintrag: aus dem Seed aufbauen.
    if (!meta) {
      const bytes = await builder.buildFromSql(await seed.loadSql());
      await saveDatabase(freshBuiltinMeta(seed, id, nowIso()), bytes);
      result.created.push(id);
      continue;
    }

    const storedVersion = meta.seedVersion ?? 0;

    // Gleiche (oder neuere) Version: nichts tun. Fehlen die Bytes trotzdem
    // (abgebrochene Transaktion, von Safari geräumter Storage), bauen wir neu auf.
    if (storedVersion >= seed.version) {
      const bytes = await loadDatabaseBytes(id);
      if (!bytes) {
        await saveDatabase(
          freshBuiltinMeta(seed, id, meta.createdAt),
          await builder.buildFromSql(await seed.loadSql()),
        );
        result.rebuilt.push(id);
      }
      continue;
    }

    // Ältere Version und unverändert: stillschweigend neu aufbauen.
    if (!meta.modified) {
      const bytes = await builder.buildFromSql(await seed.loadSql());
      await saveDatabase(freshBuiltinMeta(seed, id, meta.createdAt), bytes);
      result.rebuilt.push(id);
      continue;
    }

    // Ältere Version, aber verändert: Stand behalten und nur markieren.
    if (!meta.seedOutdated) {
      await updateDatabaseMeta(id, { seedOutdated: true, updatedAt: meta.updatedAt });
    }
    result.outdated.push(id);
  }

  return result;
}

/**
 * «Zurücksetzen»: Datenbank frisch aus dem aktuellen Seed aufbauen,
 * `modified` und `seedOutdated` löschen und die Seed-Version nachziehen.
 */
export async function resetBuiltin(seed: Seed, builder: SeedBuilder, id: string): Promise<DbMeta> {
  const existing = await getDatabaseMeta(id);
  const bytes = await builder.buildFromSql(await seed.loadSql());
  return saveDatabase(freshBuiltinMeta(seed, id, existing?.createdAt ?? nowIso()), bytes);
}

/** Markiert eine Datenbank als verändert (nach einem Lauf mit `dirty === true`). */
export async function markModified(id: string): Promise<DbMeta> {
  return updateDatabaseMeta(id, { modified: true });
}
