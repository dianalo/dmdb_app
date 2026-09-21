/**
 * Einstellungen und UI-Zustand.
 *
 * Jede Einstellung liegt als **eigener** Eintrag im Store `settings`, mit dem
 * Einstellungsnamen als Key. So kostet ein Teil-Update (z. B. nur `adhocSql`)
 * genau einen Schreibvorgang und zwei Tabs überschreiben sich nicht gegenseitig.
 */
import { openDmdb } from './idb';
import type { Settings } from './types';

type SettingKey = keyof Settings;

/** Alle gespeicherten Einstellungen als ein Objekt. */
export async function getSettings(): Promise<Settings> {
  const db = await openDmdb();
  const tx = db.transaction('settings', 'readonly');
  const store = tx.objectStore('settings');
  const [keys, values] = await Promise.all([store.getAllKeys(), store.getAll()]);
  await tx.done;

  const settings: Record<string, unknown> = {};
  keys.forEach((key, index) => {
    settings[String(key)] = values[index];
  });
  return settings as Settings;
}

/** Eine einzelne Einstellung; `undefined`, wenn sie nie gesetzt wurde. */
export async function getSetting<K extends SettingKey>(key: K): Promise<Settings[K]> {
  const db = await openDmdb();
  return (await db.get('settings', key)) as Settings[K];
}

/**
 * Schreibt die Felder des Patches (in einer Transaktion) und liefert den neuen
 * Gesamtstand. Ein Feld mit dem Wert `undefined` wird gelöscht.
 */
export async function patchSettings(patch: Partial<Settings>): Promise<Settings> {
  const db = await openDmdb();
  const tx = db.transaction('settings', 'readwrite');
  const store = tx.objectStore('settings');

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      await store.delete(key);
    } else {
      await store.put(value, key);
    }
  }
  await tx.done;
  return getSettings();
}

/** Setzt eine einzelne Einstellung. */
export function setSetting<K extends SettingKey>(key: K, value: Settings[K]): Promise<Settings> {
  return patchSettings({ [key]: value } as Partial<Settings>);
}

/** Löscht alle Einstellungen (z. B. für «Alles zurücksetzen»). */
export async function clearSettings(): Promise<void> {
  const db = await openDmdb();
  await db.clear('settings');
}
