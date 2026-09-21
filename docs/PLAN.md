# Plan: Web-Umgebung «DB-Client» für die LPU Datenmodellierung und Datenbanken

## Context

Die LPU (assets/dmdb_lpu) braucht ab Teil 2 (Kapitel 3 bis 7) eine «simple, interaktive Web-Umgebung, quasi ein WebTigerPython für Datenbanken» (Disposition). Die Kapitel-Texte sind noch Gerüste; die Anforderungen stehen in `lektionenplan.md`, `datenmodell.md` und der Disposition:

- SuS verwenden einen SQL-Client für: SQL-Queries absetzen, DML-Statements absetzen, DDL einer Tabelle anschauen (Disposition, Lernziele).
- Kapitel 3: Einführung Web-Umgebung, `SELECT * FROM`, Spaltenauswahl, `ORDER BY`.
- Kapitel 4 bis 6: WHERE, JOIN, COUNT/GROUP BY. Aufgaben fragen z.B. «Wie viele Zeilen erhältst du?» -> Zeilenzahl muss im Resultat sichtbar sein.
- Kapitel 7: INSERT/UPDATE/DELETE, «Gefahr eines vergessenen WHERE praktisch erleben (Datenbank zurücksetzen)» -> **Reset-Knopf ist die einzige mehrfach genannte harte Anforderung**. Danach DDL einer Tabelle im Client anschauen.
- Additum: eigenes Datenmodell entwerfen und mit DDL/DML anlegen -> eigene Datenbanken aus DDL erstellen.
- Datenmodell: Musik-Streaming, Spaltennamen ohne Umlaute, Daten fiktiv, ISO-Datumsstrings. Es existiert noch kein DDL/Seed-Script, das muss neu geschrieben werden.
- Stilvorgaben (CLAUDE.md der LPU): Schweizer Rechtschreibung (ss statt ß), Guillemets «…», Du-Form, Gendern mit Doppelpunkt, visuell minimal, jede Farbe hat genau eine Bedeutung.

Entscheidungen des Users (Rückfragen beantwortet):

| Frage | Entscheidung |
|---|---|
| Framework | React 19 + TypeScript + Vite |
| Scratch-Books | global, laufen gegen die aktive DB |
| Beispiel-DB | Kernmodell gemäss `datenmodell.md` (Stand 2026-09-21: 8 Kerntabellen inkl. `abo`, `nutzer` mit `email`) + `bewertung`. Ursprünglich war «ohne abo» entschieden; die LPU hat `abo` am 2026-09-21 ins Kernmodell aufgenommen, der Seed folgt dem Modell. |
| Deployment | GitHub Pages (Base-Pfad `/dmdb_app/`) |
| Zielgeräte | Chrome, Safari, Firefox, Edge (aktuelle Versionen) auf Desktop **und Tablet** (iPad, Android) |

Repo ist leer (nur `assets/dmdb_lpu` Symlink, darin nichts verändern). Node 25 / npm 11 sind installiert.

## Design-Referenz WebTigerPython (analysiert aus dem Live-Bundle)

Stack dort: Vue 3 + Vuetify, Material Design Icons, CodeMirror 6, splitpanes, Roboto. Wir übernehmen **Layout und Farbwelt**, nicht den Stack:

- Weisse, flache Oberfläche, kaum Schatten, hellgraue Toolbar (`primary #d4d4d4`, Text schwarz), Editor-Gutter amber (`#FFDDAA`), Splitter 6 px in Toolbar-Grau.
- Helles Theme: background `#FFFFFF`, surface `#FDFFFF`, Titel `#333333`, error `#B00020`, info `#2196F3`, success `#4CAF50`, warning `#FB8C00`.
- Code-Farben: keyword `#0033AA`, string `#CC6600`, number `#CC3300`, comment `#008000`.
- Dunkles Theme existiert dort (background `#222`, surface `#333`, primary `#444`). Für uns: **v1 nur helles Theme**, CSS-Variablen so anlegen, dass Dark später nur ein Variablen-Block ist.
- Layout: schmale Toolbar oben, darunter horizontal geteilte Panes (Editor / Ausgabe), Icon-Buttons mit Tooltip.
- Einzige Abweichung: als Akzentfarbe (aktiver Tab, Run-Button, Links) das LPU-Teal `#1F7A8C` statt Vuetify-Blau, damit App und Skript zusammenpassen. Schrift: Systemschrift-Stack mit Fira Sans/Fira Mono als Optionalfonts (Skript nutzt Fira), monospace für SQL und Tabellenzahlen.

## Tech-Stack

| Zweck | Wahl |
|---|---|
| Build | Vite 8, `base: '/dmdb_app/'` |
| UI | React 19, TypeScript strict, **keine** UI-Komponentenbibliothek, eigenes CSS mit Variablen (CSS Modules) |
| Editor | CodeMirror 6 (`@codemirror/lang-sql` mit SQLite-Dialekt, Schema-Autocomplete aus den Tabellen der aktiven DB) |
| SQLite | sql.js (Details siehe Datenschicht) |
| Persistenz | IndexedDB (siehe Datenschicht) |
| State | React Context + Hooks, kleine Stores; kein Redux |
| Icons | Material Design Icons als inline SVG (`@mdi/js`), wie WebTigerPython |
| Tests | Vitest (Node, sql.js läuft in Node), `fake-indexeddb`; Playwright-Smoke-Test in Chromium, Firefox und WebKit |
| Browser-Ziel | `browserslist`: `defaults, not dead, safari >= 16, ios_saf >= 16`; Vite-Target `baseline-widely-available`; kein Polyfill nötig |
| Deploy | GitHub Action `actions/deploy-pages` |

## Browser-Kompatibilität und Tablet

Die App muss in Chrome, Safari, Firefox und Edge laufen und auf Tablets gut bedienbar sein. Konsequenzen:

**Plattform-APIs (alle in den Zielbrowsern verfügbar)**
- WebAssembly, IndexedDB, `crypto.randomUUID()` (braucht HTTPS oder localhost, beides gegeben), `structuredClone`, `Uint8Array` in IndexedDB. Keine Chrome-only-APIs (kein `showOpenFilePicker`, kein OPFS, kein File System Access), keine COOP/COEP-Abhängigkeit.
- Datei-Import über `<input type="file">`, Export über Blob-URL und `<a download>`; funktioniert in allen vier Browsern und auf iPadOS.
- Safari löscht script-writable Storage (IndexedDB) nach **7 Safari-Nutzungstagen ohne Interaktion mit der Site**. Bei zwei Lektionen pro Woche und Schulferien ist das ein reales Risiko für Scratch-Books und veränderte DBs. Mitigation: `navigator.storage.persist()` anfragen (best effort) **und** eine einfache Sicherung in v1: Scratch-Book als `.sql` herunterladen und wieder öffnen, Datenbank als `.sqlite` herunterladen und importieren. Die vordefinierte DB ist ohnehin jederzeit per Reset wiederherstellbar.
- iPadOS-Safari: **Smart Punctuation** ersetzt beim Tippen `'` durch `’`, `"` durch `“ ”` und `--` durch `—`. Das zerstört SQL-Strings und Kommentare. Gegenmassnahme: CodeMirror-Transaktionsfilter, der typografische Anführungszeichen und Gedankenstriche beim Einfügen in `'`, `"` und `--` zurückwandelt; zusätzlich Editor-Attribute `autocorrect="off"`, `autocapitalize="off"`, `spellcheck="false"`. Fehlerregel für `unrecognized token: "’"` mit Hinweis auf gerade Anführungszeichen, falls doch etwas durchkommt (z. B. aus der Zwischenablage).
- Fokus/Tastatur: Virtuelle Tastatur deckt auf dem iPad die halbe Höhe ab. Layout mit `100dvh` statt `100vh`, Editor-Pane bleibt beim Tippen sichtbar, Ausgabe scrollt in ihrem eigenen Container.

**Touch-Bedienung**
- Alle interaktiven Elemente mindestens 44 × 44 px Trefferfläche, auch Tabellenköpfe zum Sortieren und Tab-Schliessen-Icons.
- Kein Hover als einzige Affordance: Icon-Buttons haben sichtbaren Text oder ein `aria-label`; Hover-Effekte nur unter `@media (hover: hover)`. Tooltips sind Ergänzung, nicht Erklärung.
- Kein Doppelklick, kein Rechtsklick, kein Drag-and-Drop als einziger Weg: Umbenennen und Löschen von Scratch-Books über ein «⋯»-Menü pro Eintrag.
- Splitter mit Pointer Events (funktioniert mit Maus, Finger und Stift), Griff mindestens 12 px breit, plus Doppelfunktion «Ausgabe maximieren/normal» per Tap, weil präzises Ziehen auf Touch mühsam ist.
- Der Button «Ausführen» ist immer sichtbar und gross, weil Ctrl/Cmd+Enter auf der Tablet-Tastatur nicht zur Verfügung steht. Tastenkürzel sind sekundär.
- Ergebnistabellen und Tabellenansicht: Kopfzeile sticky, horizontales Scrollen innerhalb des Containers, nie die ganze Seite.

**Responsives Layout (Breakpoints)**
- ≥ 1024 px (Desktop, iPad quer): Layout wie in der Skizze, Seitenleiste 240 px fix sichtbar.
- 768 bis 1023 px (iPad hoch, kleine Android-Tablets): Seitenleiste als einklappbarer Drawer (Toggle in der Toolbar, standardmässig zu), Editor und Ausgabe untereinander mit Splitter.
- < 768 px (Smartphone, nicht primäres Ziel): gleiche Struktur, Toolbar umbricht auf zwei Zeilen, Tabs horizontal scrollbar. Muss funktionieren, muss nicht schön sein.

**Test-Matrix**
- Automatisiert: Playwright-Smoke-Test (App lädt, Beispiel-DB sichtbar, Query ausführen, Reload behält Stand) in den Projekten `chromium`, `firefox`, `webkit`, zusätzlich mit iPad-Viewport (`iPad (gen 7)` und quer) und Touch-Emulation.
- Manuell vor jedem Release: Chrome und Edge (Desktop), Firefox (Desktop), Safari (macOS) und **Safari auf einem echten iPad** (Smart Punctuation, virtuelle Tastatur, Splitter), idealerweise ein Android-Tablet mit Chrome.

## UI-Konzept (v1, minimal)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ▣ DB-Client   [Datenbank: Musik-Streaming ▾]  ↻ Zurücksetzen        ? │  Toolbar
├──────────────┬───────────────────────────────────────────────────────┤
│ TABELLEN     │ [SQL]  [Scratch-Book 1 ×] [+]                 ▶ Ausführen │  Tabs
│  kuenstler   │ ┌───────────────────────────────────────────────────┐ │
│  album       │ │ 1  SELECT titel, dauer_sek                        │ │  Editor
│  song      ▸ │ │ 2  FROM song                                      │ │
│  genre       │ │ 3  ORDER BY dauer_sek DESC;                       │ │
│  …           │ └───────────────────────────────────────────────────┘ │
│              ├════════════════════════ Splitter ═══════════════════┤
│ SCRATCH-BOOKS│ ✓ 312 Zeilen                                          │  Ausgabe
│  Übung K4    │ ┌──────────────┬───────────┐                          │
│  + neu       │ │ titel        │ dauer_sek │                          │
│              │ │ Nordlicht    │       251 │                          │
│              │ …                                                     │
└──────────────┴───────────────────────────────────────────────────────┘
```

**Toolbar**: Toggle für die Seitenleiste (nur unter 1024 px sichtbar), App-Name, DB-Auswahl (Dropdown mit vordefinierten und eigenen DBs, Einträge «Neue Datenbank…», «Datenbank importieren…» und bei eigenen DBs «Löschen» sowie «Herunterladen»), Button «Zurücksetzen» (nur bei vordefinierten DBs, mit Bestätigung), Hilfe-Icon (öffnet SQL-Spickzettel als Dialog, kurz). Alle Buttons mit Text oder `aria-label`, Trefferfläche 44 px.

**Seitenleiste links**:
- Abschnitt «Tabellen»: Liste der Tabellen der aktiven DB. Klick öffnet die Tabelle in einem **Tabellen-Tab** im Hauptbereich.
- Abschnitt «Scratch-Books»: Liste der gespeicherten SQL-Dateien plus «Neu» und «Öffnen…» (`.sql`-Datei vom Gerät). Klick öffnet den Editor-Tab. Pro Eintrag ein «⋯»-Menü mit «Umbenennen», «Herunterladen (.sql)», «Löschen» (mit Bestätigung). Kein Doppelklick, damit es auf Touch funktioniert.
- Unter 1024 px ist die Seitenleiste ein Drawer, der sich nach einer Auswahl automatisch schliesst.

**Hauptbereich, Tabs**:
- Tab «SQL» (immer vorhanden, Ad-hoc-Editor, Inhalt wird ebenfalls persistiert, damit nichts verloren geht).
- Ein Tab pro geöffnetes Scratch-Book (Autosave, debounced).
- Ein Tab pro geöffnete Tabelle (Tabellenansicht).

**Editor-Tab** (oben Editor, unten Ausgabe, Splitter dazwischen):
- CodeMirror mit SQL-Highlighting, Zeilennummern, Autocomplete für Keywords und Tabellen-/Spaltennamen der aktiven DB. Autokorrektur, Autokapitalisierung und Rechtschreibprüfung abgeschaltet, Smart-Punctuation-Filter (siehe Browser-Abschnitt).
- «Ausführen» als grosser, immer sichtbarer Button (Tastenkürzel Ctrl/Cmd+Enter zusätzlich): führt die Selektion aus, sonst den ganzen Inhalt. Mehrere Statements mit `;` erlaubt; pro Statement ein Ausgabeblock.
- Ausgabe pro Statement:
  - SELECT: Resultattabelle (Spaltenköpfe, Zahlen rechtsbündig, NULL kursiv als `NULL`), darüber «312 Zeilen». Anzeige auf 1000 Zeilen begrenzt, mit Hinweis «Nur die ersten 1000 von N Zeilen angezeigt».
  - INSERT/UPDATE/DELETE: «3 Zeilen geändert».
  - CREATE/DROP/ALTER: «Tabelle X erstellt» bzw. generisch «Ausgeführt». Tabellenliste aktualisiert sich.
  - Fehler: roter Block mit deutscher Kurzmeldung, wahrscheinlicher Ursache und darunter, einklappbar, die Original-SQLite-Meldung. Ausführung stoppt beim ersten Fehler; vorherige Statements bleiben wirksam (kein Rollback, bewusst einfach, mit Hinweis im Fehlerblock «Die Statements davor wurden ausgeführt»).

**Tabellen-Tab** (bewusst minimal):
- Kopfzeile: Tabellenname, Zeilenzahl, Suchfeld (filtert über alle Spalten mit `LIKE '%…%'`), Umschalter «Daten | DDL».
- Daten: Tabelle, Tipp/Klick auf Spaltenkopf sortiert (↑/↓, dritter Tipp hebt auf). Spalten mit PK-Marker (Schlüssel-Icon). Anzeige der ersten 200 Zeilen, Button «Mehr laden». Kopfzeile sticky, horizontales Scrollen im Container. Keine Inline-Bearbeitung, kein Spalten-Ausblenden, keine Filter pro Spalte.
- DDL: `CREATE TABLE`-Statement aus `sqlite_master` mit Syntax-Highlighting, schreibgeschützt. Deckt Lernziel «DDL einer Tabelle anschauen» (Kapitel 7).
- Tabellen-Tabs laden ihre Daten bei jeder Aktivierung neu, damit nach DML-Statements die Änderungen sichtbar sind.

**Dialog «Neue Datenbank»**: Name, grosser Editor für das DDL-Script (mit Beispiel-Platzhalter `CREATE TABLE …`), Button «Erstellen». Script wird in einer frischen DB ausgeführt; bei Fehler bleibt der Dialog offen und zeigt die übersetzte Fehlermeldung.

**Sicherung (in v1 wegen Safari-Storage-Löschung, siehe Browser-Abschnitt)**: Scratch-Book herunterladen/öffnen als `.sql`, Datenbank herunterladen/importieren als `.sqlite` (die Bytes aus `db.export()` bzw. `new SQL.Database(bytes)`). Kein eigener Dialog, nur Menüeinträge.

**Bewusst weggelassen in v1** (mögliche spätere Ausbaustufen): Dark Theme, Schema-Diagramm, Join-Visualisierung, GROUP-BY-Warnung (SQLite ist hier permissiv), CSV-Export von Resultaten, Query-Historie, Mehrsprachigkeit, Login, PWA/Offline-Installation.

## Datenschicht

### SQLite: sql.js 1.14 (nicht @sqlite.org/sqlite-wasm, nicht wa-sqlite)

Begründung: DBs sind wenige hundert KB und liegen komplett im Speicher; ein Snapshot per `db.export()` nach jedem schreibenden Lauf ist billig. Der einzige Vorteil von sqlite-wasm (OPFS-VFS) ist auf GitHub Pages ohne COOP/COEP-Header ohnehin nicht nutzbar. sql.js läuft unverändert in Node (Vitest).

- Laden des wasm in Vite: `import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'` und `initSqlJs({ locateFile: () => wasmUrl })`. Damit stimmt der Base-Pfad auf GitHub Pages automatisch. Die Engine bekommt `SqlJsStatic` injiziert (`createEngine(SQL)`), damit Tests `initSqlJs()` ohne `?url` aufrufen können.
- **Ausführung im Main-Thread**, aber hinter einer async Schnittstelle (`engine.run(sql): Promise<…>`), damit ein Worker später ein Drop-in wäre. Schutz gegen Endlos-Resultate über Row-Cap (siehe unten), nicht über Worker-Termination.
- `PRAGMA foreign_keys = ON` immer aktiv, damit `DELETE FROM album` mit referenzierten Songs scheitert (Kapitel 7). **Achtung sql.js-Falle**: `db.export()` schliesst und öffnet die Verbindung neu und verliert dabei alle PRAGMAs. Deshalb `snapshot()` = `export()` + PRAGMA neu setzen; Unit-Test dafür. Zusätzlich wird das PRAGMA zu Beginn jedes Laufs gesetzt (SuS könnten es abgeschaltet haben).
- `engine.recover()`: bei wasm-Abort (Speicher) sql.js neu initialisieren und letzten Stand aus IndexedDB laden.

### Statement-Ausführung (`src/db/runScript.ts`, das Herzstück)

- Kein `db.exec()` (liefert bei Fehler mitten im Script keine Teilresultate). Stattdessen `db.iterateStatements(sql)` plus `prepare/step`, damit `;` in Strings und Kommentaren korrekt behandelt wird und pro Statement ein Resultat entsteht. Start-Offset jedes Statements aus `getRemainingSQL()` ableiten, um das fehlerhafte Statement im Editor markieren zu können.
- Klassifikation pro Statement, in dieser Reihenfolge:
  1. `stmt.getColumnNames().length > 0` -> Resultatmenge (SELECT, WITH…SELECT, VALUES, PRAGMA-Abfragen, `INSERT … RETURNING`). Zeilen bis `ROW_CAP = 1000` einlesen, dann abbrechen und `truncated` melden. Nicht weiterzählen (das wäre bei kartesischen Produkten genau der Freeze, den wir vermeiden wollen).
  2. Erstes Schlüsselwort (Kommentare überspringen) in {INSERT, UPDATE, DELETE, REPLACE} -> DML, `db.getRowsModified()` **jetzt** lesen -> «N Zeilen geändert». «0 Zeilen geändert» wird bewusst angezeigt.
  3. `PRAGMA schema_version` vorher/nachher verschieden -> DDL -> «Tabelle erstellt / gelöscht / geändert» nach Schlüsselwort.
  4. Sonst «OK».
  `getRowsModified()` nie zur Klassifikation nutzen (wird durch DDL nicht zurückgesetzt).
- `dirty`-Erkennung für Persistenz: DDL (schema_version) oder DML mit changes > 0 oder unbekanntes, nicht read-only Schlüsselwort. Einmal pro Lauf persistieren, wenn dirty.
- Abbruch beim ersten Fehler; bereits ausgeführte Statements bleiben wirksam (Hinweis in der Fehlerbox).
- Typen: `StatementResult = rows | changes | ddl | ok | error`, Werte `number | string | null | Uint8Array`.

### Persistenz: IndexedDB über die Bibliothek `idb`

DB `dmdb`, Version 1, Stores:

| Store | Key | Inhalt |
|---|---|---|
| `dbMeta` | id | `{ id, name, kind: 'builtin'|'user', createdAt, updatedAt, seedId?, seedVersion?, modified, seedOutdated }` |
| `dbBlobs` | id | `Uint8Array` (SQLite-Datei), getrennt von Meta, damit die DB-Liste keine Blobs lädt |
| `scratchbooks` | id | `{ id, name, content, createdAt, updatedAt }` |
| `settings` | key | `activeDbId`, `activeTabs`, `adhocSql`, Panelgrössen |

- IDs: `crypto.randomUUID()` für eigene DBs und Scratch-Books, fester Slug `builtin:musik-streaming` für die Beispiel-DB.
- Meta + Blob in einer `readwrite`-Transaktion schreiben.
- Seed-Versionierung (`src/seeds/index.ts`: `{ id, name, version, sql }`, `sql` per `?raw`-Import): beim Start pro Builtin
  - kein Eintrag -> aus Seed aufbauen;
  - gleiche Version -> nichts;
  - ältere Version und `modified === false` -> stillschweigend neu aufbauen;
  - ältere Version und `modified === true` -> Stand behalten, `seedOutdated = true`, Badge «Neue Version der Beispieldatenbank. Zurücksetzen lädt sie.»
- Reset = neue In-Memory-DB aus dem aktuellen Seed, `modified=false`, persistieren. Builtins sind nicht löschbar (UI und Guard im Store).
- Neue DB aus DDL: Script in frischer `SQL.Database` ausführen; bei Fehler nichts persistieren, übersetzten Fehler im Dialog zeigen.
- `navigator.storage.persist()` einmal anfragen, best effort. Safari kann Storage nach 7 Nutzungstagen ohne Interaktion löschen; deshalb Download/Import von DBs und Scratch-Books in v1 (siehe Browser-Abschnitt) und beim ersten Start ein kurzer, einmaliger Hinweis «Deine Daten liegen nur in diesem Browser».
- Import einer `.sqlite`-Datei: Bytes mit `new SQL.Database(bytes)` öffnen, `PRAGMA integrity_check` ausführen; bei Fehler ablehnen. Als `kind: 'user'` speichern.

## Fehlerübersetzung (`src/db/errors/`)

Regelbasiert: geordnete Liste `{ pattern: RegExp, message(m, ctx), hint(m, ctx) }`, `translateError(msg, ctx)` pur und testbar. `ctx` enthält Tabellen- und Spaltennamen der aktiven DB (ohnehin für den Tabellenbrowser geladen), damit Vorschläge via Levenshtein (eigene 15 Zeilen, keine Dependency) möglich sind: «Meintest du «song»?». Die englische Originalmeldung wird immer klein darunter angezeigt. Fallback: «SQLite meldet einen Fehler.» plus Original.

Regeln (Schweizer Rechtschreibung, Du-Form):

| SQLite-Muster | Meldung | Hinweis |
|---|---|---|
| `no such table: X` | Die Tabelle «X» existiert nicht. | Prüfe die Schreibweise. Alle Tabellen findest du links. (+ Vorschlag) |
| `no such column: X` | Die Spalte «X» existiert nicht. | Klicke links auf die Tabelle, um ihre Spalten zu sehen. Bei JOINs Tabellenname davor (`song.titel`). Falls X wie ein Wort aussieht: Textwerte gehören in einfache Anführungszeichen: 'Rock'. |
| `near "X": syntax error` | Syntaxfehler bei «X». | SQLite ist bei oder kurz vor «X» ins Stolpern geraten. Bei X in {FROM, WHERE, ORDER, GROUP, `)`}: Komma zu viel davor? Tippfehler-Vorschlag für Schlüsselwörter (`FORM` -> «Meintest du FROM?»). |
| `ambiguous column name: X` | Die Spalte «X» kommt in mehreren Tabellen vor. | Schreibe den Tabellennamen davor, z. B. `album.titel`. |
| `incomplete input` | Die Anweisung ist unvollständig. | Fehlt eine Klammer `)` oder ein Anführungszeichen? |
| `unrecognized token: "X"` | Unbekanntes Zeichen bei «X». | Meist ein nicht geschlossenes Anführungszeichen. Falls X ein typografisches Zeichen (’ “ ” —) ist: SQL braucht gerade Anführungszeichen `'` und zwei Bindestriche `--`; das passiert oft beim Tippen auf dem Tablet. |
| `UNIQUE constraint failed: T.C` (auch PRIMARY KEY, zusammengesetzt) | Der Wert in «T.C» ist schon vorhanden. | Diese Spalte muss eindeutig sein. Anderen Wert wählen oder id weglassen, SQLite vergibt sie automatisch. |
| `NOT NULL constraint failed: T.C` | Die Spalte «T.C» darf nicht leer (NULL) sein. | Wert angeben; Reihenfolge der Werte prüfen. |
| `FOREIGN KEY constraint failed` | Die Verweise zwischen den Tabellen würden ungültig. | Beim DELETE: Es gibt noch Zeilen, die auf diese Zeile verweisen (z. B. Songs auf ein Album). Beim INSERT/UPDATE: Die angegebene id existiert in der verwiesenen Tabelle nicht. |
| `table X has N columns but M values were supplied` | Die Tabelle «X» hat N Spalten, du hast M Werte angegeben. | Werte zählen oder Spaltenliste angeben: `INSERT INTO t (a, b) VALUES (…)`. |
| `N values for M columns` | Du hast N Werte für M Spalten angegeben. | Anzahl muss zur Spaltenliste passen. |
| `no such function: X` | Die Funktion «X» gibt es nicht. | Verfügbar z. B. COUNT, SUM, AVG, MIN, MAX, LENGTH, UPPER, LOWER, ROUND. (+ Vorschlag) |
| `misuse of aggregate: X()` | Die Aggregatfunktion «X()» steht am falschen Ort. | Aggregate dürfen nicht in WHERE stehen; gruppierte Resultate filterst du mit HAVING. |
| `datatype mismatch` | Der Datentyp passt nicht. | Meist Text in einer INTEGER PRIMARY KEY-Spalte. |
| `table X already exists` | Die Tabelle «X» existiert bereits. | Anderen Namen wählen oder zuerst `DROP TABLE X`. |
| `a GROUP BY clause is required before HAVING` | HAVING braucht ein GROUP BY davor. | Ohne Gruppierung filterst du mit WHERE. |
| `CHECK constraint failed: X` | Der Wert verletzt die Regel «X». | Diese Spalte erlaubt nur bestimmte Werte (z. B. Sterne 1 bis 5). |
| Transaktionsfehler (`cannot commit`, `within a transaction`) | Transaktionsbefehl passt nicht zum Zustand. | In diesem Kurs brauchst du BEGIN/COMMIT nicht. |

Tests erzeugen die Originalmeldungen, indem sie das fehlerhafte SQL wirklich gegen eine In-Memory-DB ausführen, damit die Muster nie von der Realität abdriften.

## Seed-Daten Musik-Streaming

**Eingecheckte `.sql`, einmalig generiert** durch `scripts/generate-seed.ts` (`tsx`, `npm run seed`, seeded PRNG mulberry32). Laufzeit-Generierung wäre nicht reproduzierbar; «Zurücksetzen» muss auf jedem Gerät dieselben Daten liefern, sonst stimmen die Musterlösungen der LPU nicht.

- Ausgabe `src/seeds/musik_streaming.sql` mit Kopfkommentar («generiert von scripts/generate-seed.ts, nicht von Hand editieren»), `BEGIN; … COMMIT;`, Multi-Row-INSERTs in 50er-Blöcken.
- Umfang gemäss `datenmodell.md`: 18 kuenstler (2 mit `gruendungsjahr` NULL, 1 ohne Album für LEFT JOIN im Additum), 36 album, ca. 300 song (`dauer_sek` 95 bis 420), 9 genre, song_genre 1 bis 2 pro Song, 25 nutzer (`benutzername` und `email` eindeutig, Alternativschlüssel), ca. 20 abo (1:1 zu nutzer, `typ`, `preis` REAL, `gueltig_bis`; einige Nutzer:innen ohne Abo), 50 playlist (5 bis 25 Songs, `position` lückenlos ab 1, `hinzugefuegt_am >= erstellt_am`), ca. 600 bewertung (sterne 1 bis 5, Schwerpunkt 3 bis 5). Daten ISO `YYYY-MM-DD` als TEXT, Jahre INTEGER. Der Dienst heisst im Skript «kanti♪tunes».
- Fiktive Namen aus Wortpools (deutsch/englisch/schweizerisch gemischt), einige Titel mit «Love»/«Liebe»/«Nacht» für LIKE-Aufgaben, wenige doppelte Songtitel über Alben hinweg für DISTINCT. Länder: Schweiz, Deutschland, Österreich, USA, UK, Frankreich, Italien.
- DDL lesbar formatiert (wird verbatim im DDL-Tab angezeigt): `INTEGER PRIMARY KEY`, `TEXT`, `INTEGER`, `NOT NULL`, tabellenweite `FOREIGN KEY (…) REFERENCES …(…)` ohne `ON DELETE`, zusammengesetzte PKs für `song_genre`, `playlist_song`, `bewertung`; einzig `bewertung.sterne` mit `CHECK (sterne BETWEEN 1 AND 5)`. UNIQUE nur, wo das Modell Alternativschlüssel bzw. 1:1 vorgibt: `nutzer.benutzername`, `nutzer.email`, `abo.nutzer_id`. Keine STRICT-Tabellen.
- Generator prüft referenzielle Integrität; der Seed-Test führt zusätzlich `PRAGMA foreign_key_check` aus.

## Projektstruktur

```
src/
  db/
    sqljs.ts            loadSqlJs() mit ?url-wasm
    engine.ts           createEngine(SQL): open, runScript, snapshot (+PRAGMA), schema, recover
    runScript.ts        Statement-Schleife, Row-Cap, Klassifikation, dirty
    classify.ts         firstKeyword, READ_ONLY, DML_KEYWORDS, schemaVersion
    schema.ts           listTables, tableInfo (PRAGMA table_info), tableDdl, quoteIdent
    browse.ts           pageTable({table, sort, dir, filter, offset, limit}) mit gebundenen Parametern
    errors/             types.ts, rules.ts, translate.ts, levenshtein.ts
  persistence/
    idb.ts              openDb(): Schema v1
    databases.ts        save/load/list/delete
    scratchbooks.ts     CRUD + Autosave (debounced 500 ms)
    settings.ts
    migrate.ts          Seed-Versionsabgleich
  seeds/
    index.ts            Registry {id, name, version, sql}
    musik_streaming.sql generiert (?raw)
  store/                zustand: dbStore, resultStore, scratchbookStore, uiStore
  components/           Toolbar, Editor (CodeMirror), Results (ResultTable, MessageLine, ErrorBox),
                        SidePanel (TableList, ScratchbookList, Drawer), TableView, DdlView, Tabs,
                        SplitPane (Pointer Events), dialogs (NewDatabaseDialog, ConfirmDialog, HelpDialog)
  editor/               cmSetup.ts (SQLite-Dialekt, Autocomplete), smartPunctuation.ts (Transaktionsfilter)
  files/                download.ts (Blob + <a download>), openFile.ts (<input type=file>)
  hooks/                useMediaQuery, useBreakpoint
  i18n/de.ts            alle UI-Texte an einem Ort
  styles/               tokens.css (Farbvariablen), global.css
scripts/generate-seed.ts
e2e/smoke.spec.ts        Playwright, Projekte chromium / firefox / webkit / iPad
.github/workflows/deploy.yml   Build, Vitest, Playwright-Smoke, Deploy
```

State: **zustand** (klein, erlaubt Updates aus Nicht-React-Code wie Autosave und `recover()`; Selektoren verhindern Re-Renders des CodeMirror-Wrappers). Regel: Komponenten importieren nie sql.js, sondern rufen Store-Aktionen; Aktionen rufen `engine`/`persistence`.

Startsequenz (`dbStore.init()`): `openDb()` -> `reconcileSeeds()` -> `settings.activeDbId` (Fallback Builtin) -> `loadDatabase` -> `engine.open(bytes)` -> `listTables()`. Bis `status === 'ready'` ein Skeleton anzeigen.

## Umsetzungsschritte

1. **Projekt aufsetzen**: `npm create vite@latest` (react-ts), ESLint/Prettier, Vitest mit `fake-indexeddb/auto`, `browserslist`, `base: '/dmdb_app/'`, GitHub-Action für Pages, README (Entwicklung, Seed neu generieren, Deployment, Browser-Matrix). `.gitignore` inkl. `node_modules`, `dist`; `assets/` bleibt untracked-Symlink (nicht ins Build einbeziehen).
2. **Seed**: `scripts/generate-seed.ts` schreiben, `musik_streaming.sql` erzeugen, Seed-Test.
3. **Engine**: `sqljs.ts`, `engine.ts`, `classify.ts`, `runScript.ts`, `schema.ts`, `browse.ts` mit Tests (Multi-Statement, `;` in Strings, Row-Cap, Klassifikation, foreign_keys überlebt snapshot).
4. **Fehlerübersetzung**: `errors/` mit tabellengetriebenen Tests gegen echte SQLite-Meldungen.
5. **Persistenz**: `idb.ts`, `databases.ts`, `scratchbooks.ts`, `settings.ts`, `migrate.ts`, Round-Trip- und Versionsabgleich-Tests.
6. **Stores**: dbStore (init, switch, reset, create, delete), resultStore, scratchbookStore, uiStore.
7. **UI Grundgerüst**: Design-Tokens (WebTigerPython-Farben, LPU-Teal als Akzent, 44-px-Trefferflächen, `100dvh`), Toolbar, Seitenleiste mit Drawer-Modus unter 1024 px, Tabs, SplitPane mit Pointer Events und Tap-Maximieren.
8. **Editor + Ausgabe**: CodeMirror-Wrapper (SQLite-Dialekt, Schema-Autocomplete, Autokorrektur aus, Smart-Punctuation-Filter, Ctrl/Cmd+Enter), grosser «Ausführen»-Button, Selektion ausführen, ResultTable (Zeilenzahl, Truncation-Hinweis, NULL-Darstellung, sticky Kopf, Scroll im Container), MessageLine, ErrorBox (deutsch, Ursache, Original einklappbar, fehlerhaftes Statement im Editor markieren).
9. **Tabellenansicht**: Daten (Sortieren per Kopf, Suchfeld, «Mehr laden», PK-Marker), DDL-Ansicht, Refresh bei Tab-Aktivierung.
10. **Scratch-Books**: Liste, «⋯»-Menü (umbenennen, herunterladen, löschen), neu, `.sql` öffnen, Autosave, Tab-Integration; Ad-hoc-SQL-Tab ebenfalls persistieren.
11. **Datenbanken verwalten**: DB-Auswahl, Dialog «Neue Datenbank» aus DDL, `.sqlite` importieren/herunterladen, Löschen eigener DBs, Zurücksetzen mit Bestätigung, Badge bei veraltetem Seed, einmaliger Hinweis zur lokalen Speicherung.
12. **Hilfe**: kurzer SQL-Spickzettel (Klauseln und Operatoren der Lernziele mit je einem Minimalbeispiel) als Dialog; deckt zugleich das TODO in `anhang/sql-uebersicht.tex` der LPU inhaltlich ab.
13. **E2E und Browser-Matrix**: Playwright-Smoke-Test für chromium, firefox, webkit und iPad-Viewport in der CI; manueller Durchgang auf echtem iPad.
14. **Feinschliff**: Tastaturbedienung, Fokus, Ladezustände, leere Zustände, Texte auf Schweizer Rechtschreibung prüfen, Lighthouse-Check (auch Accessibility), Deployment testen.

## Verifikation

- `npm test`: Seed-Test (FK-Check leer, Mengen im Zielbereich, Positionen lückenlos, ISO-Daten), Engine-Tests, Fehlerübersetzungs-Tests, Persistenz-Round-Trip mit fake-indexeddb, Seed-Versionsmatrix.
- `npm run build && npm run preview` mit Base-Pfad: wasm lädt unter `/dmdb_app/assets/…`.
- `npx playwright test`: Smoke-Test in Chromium, Firefox, WebKit und mit iPad-Viewport (Touch): App lädt, Tabelle öffnen, Query ausführen, Reload behält DB-Stand und Scratch-Book, Drawer öffnet/schliesst.
- Manuell auf echtem iPad (Safari): `'Rock'` tippen ergibt gerade Anführungszeichen im Editor, `--` bleibt ein Kommentar, virtuelle Tastatur verdeckt den «Ausführen»-Button nicht, Splitter lässt sich mit dem Finger ziehen, Sortieren per Tipp auf Spaltenkopf, Download und Import einer `.sqlite`-Datei funktionieren über die Dateien-App.
- Manuell in Firefox und Edge auf dem Desktop: Fokusreihenfolge, Autocomplete, Download/Import.
- Manueller Durchlauf entlang der LPU-Kapitel im Browser:
  - K3: Tabelle `song` per Klick öffnen, sortieren, suchen; `SELECT titel FROM song ORDER BY dauer_sek DESC;` liefert Tabelle mit Zeilenzahl.
  - K4: `WHERE … LIKE '%Nacht%'`, `IN (…)`, Datumsvergleich auf `registriert_am`.
  - K5: JOIN über drei Tabellen via `playlist_song`; `ambiguous column name` liefert deutsche Meldung.
  - K6: `COUNT(*)`, `GROUP BY`.
  - K7: `DELETE FROM song;` ohne WHERE -> «312 Zeilen geändert», Tabellen-Tab zeigt leere Tabelle, «Zurücksetzen» stellt alles wieder her; `DELETE FROM album WHERE id = 1;` scheitert mit FK-Meldung; DDL-Tab zeigt `CREATE TABLE`.
  - Additum: neue DB aus eigenem DDL erstellen, INSERT, wieder löschen.
  - Reload: DB-Stand, Scratch-Books, offene Tabs und Ad-hoc-SQL sind noch da.
  - Fehlerfälle: `SELET`, `FORM`, `WHERE name = "Rock"` (0 Zeilen, kein Fehler; ggf. später Lint), Endlosresultat `SELECT * FROM song, album, kuenstler` bleibt bei 1000 Zeilen reaktionsfähig.
