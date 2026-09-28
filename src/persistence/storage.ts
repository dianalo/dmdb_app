/**
 * Storage-Persistenz (PLAN.md, «Browser-Kompatibilität»):
 * Safari löscht script-writable Storage nach sieben Nutzungstagen ohne Besuch der Site.
 * `navigator.storage.persist()` ist best effort und wird einmal beim Start angefragt.
 */

interface StorageManagerLike {
  persist?: () => Promise<boolean>;
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
