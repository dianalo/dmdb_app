/**
 * Gemeinsame Typen der Persistenzschicht (IndexedDB `dmdb`, Version 1).
 */

/** `builtin` = mitgelieferte Beispieldatenbank (nicht löschbar), `user` = selbst erstellt oder importiert. */
export type DbKind = 'builtin' | 'user';

/** Metadaten einer Datenbank; die Bytes liegen getrennt im Store `dbBlobs`. */
export interface DbMeta {
  id: string;
  name: string;
  kind: DbKind;
  /** ISO-Zeitstempel. */
  createdAt: string;
  /** ISO-Zeitstempel. */
  updatedAt: string;
  /** Nur bei `kind: 'builtin'`: aus welchem Seed die Datenbank stammt. */
  seedId?: string;
  /** Nur bei `kind: 'builtin'`: mit welcher Seed-Version sie aufgebaut wurde. */
  seedVersion?: number;
  /** true, sobald die Datenbank durch DML/DDL verändert wurde. */
  modified: boolean;
  /** true, wenn ein neuerer Seed vorliegt, der Stand aber wegen `modified` behalten wurde. */
  seedOutdated: boolean;
}

/** Ein gespeichertes Scratch-Book (SQL-Datei). */
export interface ScratchbookRecord {
  id: string;
  name: string;
  content: string;
  /** ISO-Zeitstempel. */
  createdAt: string;
  /** ISO-Zeitstempel. */
  updatedAt: string;
}

/** Benutzereinstellungen und UI-Zustand, Key-Value im Store `settings`. */
export interface Settings {
  activeDbId?: string;
  /** Inhalt des Ad-hoc-Tabs «SQL». */
  adhocSql?: string;
  /** IDs der offenen Tabs in ihrer Reihenfolge. */
  openTabs?: string[];
  activeTabId?: string;
  /** Breite der Seitenleiste in px. */
  sidebarWidth?: number;
  /** Anteil des Editors an der Höhe (0 bis 1). */
  splitRatio?: number;
  /** true, sobald der einmalige Hinweis zur lokalen Speicherung gesehen wurde. */
  storageNoticeSeen?: boolean;
}

/**
 * Minimaler Vertrag der Engine, den die Persistenzschicht braucht.
 *
 * Bewusst als Interface statt als direkter Import von `src/db/engine.ts`:
 * die Persistenz bleibt so frei von sql.js und in Tests durch eine Attrappe ersetzbar.
 */
export interface SeedBuilder {
  /** Baut eine frische Datenbank aus dem Seed-SQL auf und liefert die SQLite-Datei als Bytes. */
  buildFromSql(sql: string): Promise<Uint8Array>;
}

/** Ergebnis von `reconcileSeeds()`: welche Builtins angelegt, neu gebaut oder als veraltet markiert wurden. */
export interface SeedReconcileResult {
  /** IDs der Datenbanken, die es noch gar nicht gab. */
  created: string[];
  /** IDs der Datenbanken, die stillschweigend aus dem neuen Seed neu aufgebaut wurden. */
  rebuilt: string[];
  /** IDs der veränderten Datenbanken, deren Stand behalten und die als veraltet markiert wurden. */
  outdated: string[];
}
