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
 *
 * Texte mit Zahlen sind Funktionen, damit Einzahl und Mehrzahl stimmen.
 */

/** «1 Zeile» bzw. «N Zeilen». */
function zeilen(n: number): string {
  return n === 1 ? '1 Zeile' : `${n} Zeilen`;
}

export const de = {
  app: {
    title: 'DB-Client',
    loading: 'Datenbank wird geladen…',
    errorTitle: 'Die App konnte nicht starten.',
    errorHint:
      'Lade die Seite neu. Hilft das nicht, ist vielleicht der Speicher des Browsers voll oder gesperrt (privates Fenster?).',
    reload: 'Neu laden',
  },
  toolbar: {
    openSidebar: 'Seitenleiste öffnen',
    closeSidebar: 'Seitenleiste schliessen',
    database: 'Datenbank',
    reset: 'Zurücksetzen',
    resetTitle: 'Beispieldatenbank auf den Ausgangszustand zurücksetzen',
    help: 'Hilfe',
    comingSoon: 'Folgt in einer späteren Version',
  },
  sidebar: {
    label: 'Seitenleiste',
    tables: 'Tabellen',
    noTables: 'Diese Datenbank hat noch keine Tabellen.',
    scratchbooks: 'Scratch-Books',
    noScratchbooks: 'Noch keine Scratch-Books.',
    newScratchbook: 'Neu',
    newScratchbookLabel: 'Neues Scratch-Book erstellen',
    defaultScratchbookName: (n: number) => `Scratch-Book ${n}`,
  },
  tabs: {
    label: 'Offene Tabs',
    sql: 'SQL',
    close: (title: string) => `Tab «${title}» schliessen`,
    newScratchbook: 'Neues Scratch-Book',
  },
  editor: {
    run: 'Ausführen',
    running: 'Läuft…',
    runShortcut: 'Ctrl/Cmd + Enter',
    editorLabel: (title: string) => `SQL-Editor «${title}»`,
    loading: 'Wird geladen…',
  },
  splitPane: {
    handleLabel: 'Grösse von Editor und Ausgabe ändern',
    handleHint: 'Ziehen oder Pfeiltasten; doppelt tippen maximiert die Ausgabe.',
  },
  results: {
    label: 'Ausgabe',
    empty: 'Schreibe eine SQL-Abfrage und tippe auf «Ausführen».',
    noStatements: 'Es gab nichts auszuführen. Der Editor enthält keine Anweisung.',
    rows: zeilen,
    moreRows: (n: number) => `Mehr als ${zeilen(n)}`,
    truncated: (n: number) =>
      `Nur die ersten ${n} Zeilen werden angezeigt. Verwende WHERE oder LIMIT.`,
    changes: (n: number) => `${zeilen(n)} geändert`,
    ok: 'Ausgeführt',
    null: 'NULL',
    blob: (n: number) => `BLOB (${n} Bytes)`,
    duration: (ms: number) => `${ms < 1 ? '< 1' : Math.round(ms)} ms`,
    /** z. B. «Tabelle «notiz» erstellt» bzw. ohne Namen «Tabelle erstellt». */
    ddlDone: (object: string, name: string | null, verb: string) =>
      name ? `${object} «${name}» ${verb}` : `${object} ${verb}`,
    statementLabel: 'Ausgeführte Anweisung',
    ddl: {
      CREATE: 'erstellt',
      DROP: 'gelöscht',
      ALTER: 'geändert',
    },
    objects: {
      TABLE: 'Tabelle',
      INDEX: 'Index',
      VIEW: 'Sicht',
      TRIGGER: 'Trigger',
    },
    errorOriginal: 'Originalmeldung von SQLite',
    errorBefore: 'Die Anweisungen davor wurden ausgeführt.',
    errorShow: 'Stelle im Editor markieren',
    persistFailed: 'Die Änderungen konnten nicht gespeichert werden.',
  },
  tableView: {
    placeholder: 'Tabellenansicht folgt',
    placeholderHint: (name: string) =>
      `Bis dahin kannst du im Tab «SQL» zum Beispiel SELECT * FROM ${name}; ausführen.`,
  },
  dialogs: {},
  scratchbooks: {},
  help: {},
  errors: {
    dbNotFound: 'Diese Datenbank gibt es nicht mehr.',
    builtinNotDeletable: 'Die Beispieldatenbank kann nicht gelöscht werden.',
    importInvalid: 'Die Datei ist keine gültige SQLite-Datenbank.',
    noSeed: 'Für diese Datenbank gibt es keinen Ausgangszustand.',
  },
} as const;
