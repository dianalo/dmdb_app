# DB-Client

Eine schlanke Web-Umgebung, in der Schüler:innen SQL direkt im Browser schreiben und ausführen –
quasi ein «WebTigerPython für Datenbanken». Die App begleitet Teil 2 (Kapitel 3 bis 7) der
Lehrpersonen-Unterlage «Datenmodellierung und Datenbanken» (LPU): Queries absetzen, Resultate mit
Zeilenzahl sehen, DML-Statements ausprobieren, die DDL einer Tabelle anschauen und die
Beispieldatenbank jederzeit zurücksetzen. Alles läuft lokal im Browser (SQLite via WebAssembly,
Speicherung in IndexedDB) – es gibt keinen Server, kein Login und keine Daten, die das Gerät
verlassen.

Der vollständige Plan steht in [docs/PLAN.md](docs/PLAN.md).

## Voraussetzungen

- Node.js ≥ 22 (entwickelt mit Node 25, npm 11)
- Ein aktueller Browser (siehe Browser-Matrix)

```bash
npm install
npm run dev
```

## Scripts

| Script               | Zweck                                                             |
| -------------------- | ----------------------------------------------------------------- |
| `npm run dev`        | Entwicklungsserver mit Hot Reload                                 |
| `npm run build`      | Typprüfung (`tsc -b`) und Produktions-Build nach `dist/`          |
| `npm run preview`    | Gebauten Stand lokal servieren (unter dem Base-Pfad `/dmdb_app/`) |
| `npm test`           | Unit-Tests einmalig (Vitest)                                      |
| `npm run test:watch` | Unit-Tests im Watch-Modus                                         |
| `npm run lint`       | ESLint über das ganze Projekt                                     |
| `npm run format`     | Prettier schreibt Formatierung                                    |
| `npm run seed`       | Seed-Script neu generieren (siehe unten)                          |

## Seed neu generieren

Die Beispieldatenbank «Musik-Streaming» liegt als eingecheckte Datei
`src/seeds/musik_streaming.sql` im Repo. Sie wird einmalig aus
`scripts/generate-seed.ts` mit einem seeded Zufallsgenerator erzeugt, damit
«Zurücksetzen» auf jedem Gerät exakt dieselben Daten liefert und die Musterlösungen der LPU
stimmen.

```bash
npm run seed
```

Danach die erzeugte `.sql`-Datei einchecken und im Seed-Eintrag die `version` erhöhen, damit
bestehende Installationen die neue Version übernehmen. Die Datei nicht von Hand editieren.

## Deployment

Das Deployment läuft über GitHub Pages
([.github/workflows/deploy.yml](.github/workflows/deploy.yml)): jeder Push auf `main` baut das
Projekt, führt die Tests aus und veröffentlicht `dist/`. Die App liegt unter dem Base-Pfad
`/dmdb_app/` – deshalb steht in `vite.config.ts` `base: '/dmdb_app/'`. Wer das Repo umbenennt,
muss diesen Wert anpassen. Lokal prüfen:

```bash
npm run build && npm run preview
# öffnet http://localhost:4173/dmdb_app/
```

## Browser-Matrix

Unterstützt sind die aktuellen Versionen von **Chrome, Safari, Firefox und Edge**, auf **Desktop
und Tablet** (iPad ab iPadOS 16, Android-Tablets). Die Bedienung ist auf Touch ausgelegt:
Trefferflächen ab 44 px, kein Hover als einzige Affordance, kein Doppel- oder Rechtsklick.
`browserslist` ist auf `defaults, not dead, safari >= 16, ios_saf >= 16` gesetzt.

## Projektstruktur

```
src/
  db/            SQLite-Engine: sql.js laden, Statements ausführen, Schema lesen, Fehler übersetzen
  persistence/   IndexedDB: Datenbanken, Scratch-Books, Einstellungen, Seed-Versionsabgleich
  seeds/         Seed-Registry und generiertes musik_streaming.sql
  store/         zustand-Stores (dbStore, resultStore, scratchbookStore, uiStore)
  components/    Toolbar, Editor, Resultate, Seitenleiste, Tabellenansicht, Tabs, Dialoge
  editor/        CodeMirror-Setup und Smart-Punctuation-Filter fürs iPad
  files/         Download und Öffnen von .sql- und .sqlite-Dateien
  hooks/         useMediaQuery, useBreakpoint
  i18n/de.ts     alle UI-Texte an einem Ort
  styles/        tokens.css (Design-Tokens), global.css
scripts/generate-seed.ts        Generator für die Beispieldatenbank
e2e/smoke.spec.ts               Playwright-Smoke-Test (chromium / firefox / webkit / iPad)
.github/workflows/deploy.yml    Build, Tests, Deployment auf GitHub Pages
docs/PLAN.md                    ausführlicher Plan und Entscheide
```

`assets/dmdb_lpu` ist ein Symlink auf das LPU-Repo. Er bleibt untracked und ist nicht Teil des
Builds.
