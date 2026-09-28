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
    resetOnlyBuiltin: 'Nur Beispieldatenbanken lassen sich zurücksetzen.',
    seedOutdated: 'Neue Version verfügbar',
    seedOutdatedTitle: 'Neue Version der Beispieldatenbank. Zurücksetzen lädt sie.',
    dbActions: 'Datenbank-Aktionen',
    newDatabase: 'Neue Datenbank…',
    importDatabase: 'Datenbank importieren (.sqlite)…',
    downloadDatabase: 'Herunterladen (.sqlite)',
    deleteDatabase: 'Löschen',
    resetDone: 'Datenbank zurückgesetzt.',
    dbCreated: (name: string) => `Datenbank «${name}» erstellt.`,
    dbImported: (name: string) => `Datenbank «${name}» importiert.`,
    dbDeleted: (name: string) => `Datenbank «${name}» gelöscht.`,
    storageNotice:
      'Deine Datenbanken und Scratch-Books werden nur in diesem Browser gespeichert. Lade wichtige Arbeiten über «⋯» herunter.',
    storageNoticeOk: 'Verstanden',
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
    openScratchbook: 'Öffnen…',
    openScratchbookLabel: 'Scratch-Book aus einer .sql-Datei öffnen',
    itemActions: (name: string) => `Aktionen für «${name}»`,
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
    rowCount: zeilen,
    counter: (shown: number, total: number) => `${shown} von ${zeilen(total)}`,
    search: 'Suchen…',
    searchLabel: (name: string) => `In der Tabelle «${name}» suchen`,
    modeLabel: 'Ansicht',
    data: 'Daten',
    ddl: 'DDL',
    primaryKey: 'Primärschlüssel',
    tableLabel: (name: string) => `Daten der Tabelle «${name}»`,
    loadMore: 'Mehr laden',
    loading: 'Wird geladen…',
    noMatches: 'Keine Zeilen gefunden.',
    empty: 'Die Tabelle ist leer.',
    missing: (name: string) => `Die Tabelle «${name}» existiert nicht mehr.`,
    loadFailed: 'Die Tabelle konnte nicht geladen werden.',
    ddlNote: 'So ist die Tabelle in der Datenbank definiert (DDL).',
    ddlLabel: (name: string) => `DDL der Tabelle «${name}»`,
  },
  dialogs: {
    close: 'Schliessen',
    cancel: 'Abbrechen',
    ok: 'OK',
    save: 'Speichern',
    working: 'Bitte warten…',
    nameLabel: 'Name',
    nameRequired: 'Gib einen Namen ein.',
    dbNameTaken: (name: string) => `Es gibt schon eine Datenbank mit dem Namen «${name}».`,
    scratchbookNameTaken: (name: string) =>
      `Es gibt schon ein Scratch-Book mit dem Namen «${name}».`,
    actionFailed: 'Das hat leider nicht geklappt.',
    importFailedTitle: 'Import fehlgeschlagen',
    importFallbackName: 'Importierte Datenbank',
    newDb: {
      title: 'Neue Datenbank',
      namePlaceholder: 'z. B. Schule',
      sqlLabel: 'SQL-Script mit CREATE TABLE und INSERT INTO',
      sqlHint:
        'Das Script läuft in einer leeren Datenbank. Bei einem Fehler wird nichts gespeichert. Ctrl/Cmd + Enter erstellt die Datenbank.',
      editorLabel: 'SQL-Script für die neue Datenbank',
      create: 'Erstellen',
      example: [
        '-- Schreibe hier die Tabellen und Daten deiner Datenbank.',
        '-- Beispiel (entferne die zwei Bindestriche am Zeilenanfang):',
        '--',
        '-- CREATE TABLE klasse (',
        '--   id   INTEGER PRIMARY KEY,',
        '--   name TEXT NOT NULL',
        '-- );',
        "-- INSERT INTO klasse (name) VALUES ('4a'), ('4b');",
        '',
        '',
      ].join('\n'),
    },
    deleteDb: {
      title: 'Datenbank löschen',
      text: (name: string) =>
        `Datenbank «${name}» löschen? Das kann nicht rückgängig gemacht werden.`,
      confirm: 'Löschen',
    },
    resetDb: {
      title: 'Datenbank zurücksetzen',
      text: 'Die Beispieldatenbank wird auf den Originalzustand zurückgesetzt. Alle Änderungen gehen verloren.',
      outdated: 'Es gibt eine neue Version der Beispieldatenbank. Zurücksetzen lädt sie.',
      confirm: 'Zurücksetzen',
    },
  },
  scratchbooks: {
    rename: 'Umbenennen',
    download: 'Herunterladen (.sql)',
    delete: 'Löschen',
    renameTitle: 'Scratch-Book umbenennen',
    deleteTitle: 'Scratch-Book löschen',
    deleteText: (name: string) =>
      `Scratch-Book «${name}» löschen? Das kann nicht rückgängig gemacht werden.`,
    openFailed: 'Die Datei konnte nicht gelesen werden.',
    openFailedTitle: 'Öffnen fehlgeschlagen',
  },
  help: {
    title: 'SQL-Spickzettel',
    intro: 'Die wichtigsten Befehle mit je einem Beispiel zur Datenbank Musik-Streaming.',
    insert: 'In Editor einfügen',
    insertLabel: (title: string) => `Beispiel «${title}» in den Editor einfügen`,
    additum: 'Additum',
    sections: [
      {
        heading: 'Abfragen',
        items: [
          {
            title: 'SELECT … FROM',
            text: 'Wählt Spalten aus einer Tabelle; * steht für alle Spalten.',
            example: 'SELECT titel, dauer_sek FROM song;',
          },
          {
            title: 'ORDER BY',
            text: 'Sortiert das Resultat: ASC aufsteigend (Standard), DESC absteigend.',
            example: 'SELECT titel, dauer_sek FROM song ORDER BY dauer_sek DESC;',
          },
        ],
      },
      {
        heading: 'Filtern',
        items: [
          {
            title: 'WHERE',
            text: 'Behält nur Zeilen, die die Bedingung erfüllen. Vergleiche: = != < <= > >=. Text steht in einfachen Anführungszeichen.',
            example: "SELECT name FROM kuenstler WHERE land = 'Schweiz';",
          },
          {
            title: 'AND, OR, NOT',
            text: 'Verknüpft Bedingungen: AND (beide), OR (mindestens eine), NOT (Gegenteil).',
            example: 'SELECT titel FROM song WHERE dauer_sek < 180 OR dauer_sek > 300;',
          },
          {
            title: 'LIKE',
            text: 'Sucht Textmuster: % steht für beliebig viele Zeichen, _ für genau ein Zeichen.',
            example: "SELECT titel FROM song WHERE titel LIKE '%Nacht%';",
          },
          {
            title: 'IN (…)',
            text: 'Prüft, ob ein Wert in einer Liste vorkommt.',
            example: "SELECT name FROM kuenstler WHERE land IN ('Schweiz', 'Italien');",
          },
        ],
      },
      {
        heading: 'Tabellen verbinden',
        items: [
          {
            title: 'JOIN … ON',
            text: 'Verbindet zwei Tabellen über Fremdschlüssel und Primärschlüssel.',
            example:
              'SELECT song.titel, album.titel\nFROM song\nJOIN album ON song.album_id = album.id;',
          },
        ],
      },
      {
        heading: 'Zählen und Gruppieren',
        items: [
          {
            title: 'COUNT(*)',
            text: 'Zählt die Zeilen des Resultats.',
            example: 'SELECT COUNT(*) FROM song;',
          },
          {
            title: 'GROUP BY',
            text: 'Bildet Gruppen mit gleichem Wert und rechnet pro Gruppe, z. B. COUNT(*).',
            example: 'SELECT album_id, COUNT(*) FROM song GROUP BY album_id;',
          },
          {
            title: 'SUM, AVG, MIN, MAX',
            text: 'Summe, Durchschnitt, kleinster und grösster Wert einer Spalte.',
            example: 'SELECT MIN(dauer_sek), MAX(dauer_sek), AVG(dauer_sek) FROM song;',
            additum: true,
          },
          {
            title: 'HAVING',
            text: 'Filtert Gruppen nach GROUP BY; WHERE filtert dagegen einzelne Zeilen davor.',
            example:
              'SELECT album_id, COUNT(*) FROM song\nGROUP BY album_id\nHAVING COUNT(*) >= 10;',
            additum: true,
          },
        ],
      },
      {
        heading: 'Daten ändern',
        items: [
          {
            title: 'INSERT INTO … VALUES',
            text: 'Fügt eine neue Zeile ein.',
            example: "INSERT INTO genre (name) VALUES ('Polka');",
          },
          {
            title: 'UPDATE … SET … WHERE',
            text: 'Ändert Werte. Achtung: Ohne WHERE werden alle Zeilen geändert.',
            example: "UPDATE genre SET name = 'Volksmusik' WHERE name = 'Polka';",
          },
          {
            title: 'DELETE FROM … WHERE',
            text: 'Löscht Zeilen. Achtung: Ohne WHERE wird die ganze Tabelle geleert.',
            example: "DELETE FROM genre WHERE name = 'Volksmusik';",
          },
        ],
      },
      {
        heading: 'Tabellen erstellen',
        items: [
          {
            title: 'CREATE TABLE',
            text: 'Erstellt eine neue Tabelle mit Spalten, Datentypen und Primärschlüssel.',
            example: 'CREATE TABLE notiz (\n  id   INTEGER PRIMARY KEY,\n  text TEXT NOT NULL\n);',
          },
        ],
      },
    ],
    usageHeading: 'Bedienung',
    usage: [
      'Ausführen: Button «Ausführen» oder Ctrl/Cmd + Enter.',
      'Markierst du einen Teil des SQL, wird nur die Markierung ausgeführt.',
      'Tippe links auf eine Tabelle, um ihre Daten und ihre Definition zu sehen.',
      '«Zurücksetzen» stellt die Beispieldatenbank wieder her, z. B. nach einem DELETE ohne WHERE.',
      'Deine Daten liegen nur in diesem Browser. Lade wichtige Arbeiten zur Sicherung über «⋯» herunter.',
    ],
  },
  errors: {
    dbNotFound: 'Diese Datenbank gibt es nicht mehr.',
    builtinNotDeletable: 'Die Beispieldatenbank kann nicht gelöscht werden.',
    importInvalid: 'Die Datei ist keine gültige SQLite-Datenbank.',
    noSeed: 'Für diese Datenbank gibt es keinen Ausgangszustand.',
  },
} as const;
