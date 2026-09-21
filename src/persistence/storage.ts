/**
 * Storage-Persistenz (PLAN.md, «Browser-Kompatibilität»):
 * Safari löscht script-writable Storage nach sieben Nutzungstagen ohne Besuch der Site.
 * `navigator.storage.persist()` ist best effort und wird einmal beim Start angefragt.
 */

interface StorageManagerLike {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
  estimate?: () => Promise<StorageEstimate>;
}

function storageManager(): StorageManagerLike | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { storage?: StorageManagerLike }).storage;
}

/**
 * Fragt dauerhaften Speicher an. Liefert `true`, wenn der Speicher (jetzt oder schon
 * vorher) als persistent gilt, sonst `false` — auch wenn die API fehlt oder wirft.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  const storage = storageManager();
  if (!storage?.persist) return false;
  try {
    return await storage.persist();
  } catch {
    return false;
  }
}

/** Ist der Speicher bereits als persistent markiert? */
export async function isStoragePersisted(): Promise<boolean> {
  const storage = storageManager();
  if (!storage?.persisted) return false;
  try {
    return await storage.persisted();
  } catch {
    return false;
  }
}

/** Grober Verbrauch und Kontingent in Bytes, `undefined` wenn der Browser es nicht sagt. */
export async function estimateUsage(): Promise<{ usage?: number; quota?: number } | undefined> {
  const storage = storageManager();
  if (!storage?.estimate) return undefined;
  try {
    const { usage, quota } = await storage.estimate();
    return { usage, quota };
  } catch {
    return undefined;
  }
}
