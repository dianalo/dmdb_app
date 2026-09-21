/**
 * Hilfen für die Persistenz-Tests: frische IndexedDB pro Test.
 * (Wird nur aus `*.test.ts` importiert.)
 */
import { resetConnectionForTests, DB_NAME } from './idb';

/** Schliesst die memoisierte Verbindung und löscht die Datenbank `dmdb`. */
export async function resetDmdbForTests(): Promise<void> {
  resetConnectionForTests();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onblocked = () => reject(new Error('deleteDatabase blockiert: Verbindung noch offen'));
    request.onerror = () => reject(request.error ?? new Error('deleteDatabase fehlgeschlagen'));
  });
}
