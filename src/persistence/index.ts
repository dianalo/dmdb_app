/** Öffentliche Schnittstelle der Persistenzschicht. */
export * from './types';
export { DB_NAME, DB_VERSION, openDmdb, closeDmdb, resetConnectionForTests } from './idb';
export type { DmdbSchema } from './idb';
export { newId, nowIso } from './ids';
export {
  BuiltinNotDeletableError,
  createUserDatabase,
  deleteDatabase,
  getDatabaseMeta,
  listDatabases,
  loadDatabaseBytes,
  saveDatabase,
  updateDatabaseMeta,
} from './databases';
export type { DbMetaPatch } from './databases';
export {
  createAutosaver,
  createScratchbook,
  deleteScratchbook,
  getScratchbook,
  listScratchbooks,
  renameScratchbook,
  saveScratchbookContent,
  updateScratchbook,
} from './scratchbooks';
export type { Autosaver, SaveFn, ScratchbookPatch } from './scratchbooks';
export { clearSettings, getSetting, getSettings, patchSettings, setSetting } from './settings';
export { markModified, reconcileSeeds, resetBuiltin } from './migrate';
export type { BuiltinDbId } from './migrate';
export { requestPersistentStorage } from './storage';
