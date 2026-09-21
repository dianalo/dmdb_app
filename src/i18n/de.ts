/**
 * Alle UI-Texte an einem Ort.
 *
 * Stilregeln (aus der LPU übernommen, bitte einhalten):
 * - Schweizer Rechtschreibung: immer «ss», nie «ß».
 * - Anführungszeichen als Guillemets «…», nicht "…" oder „…“.
 * - Du-Form, direkte Ansprache der Schüler:innen.
 * - Gendern mit Doppelpunkt (Nutzer:innen, Schüler:innen).
 * - Technische Bezeichner (Tabellen-, Spalten-, Schlüsselwörter) bleiben ungegendert
 *   und unübersetzt: `song`, `titel`, `SELECT`.
 */
export const de = {
  app: { title: 'DB-Client', loading: 'Datenbank wird geladen…' },
  toolbar: {},
  sidebar: {},
  editor: {},
  results: {},
  tableView: {},
  dialogs: {},
  scratchbooks: {},
  help: {},
  errors: {},
} as const;
