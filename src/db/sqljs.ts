/**
 * Laden des sql.js-WebAssembly-Moduls im Browser.
 *
 * Der `?url`-Import lässt Vite die wasm-Datei als Asset ausliefern; damit stimmt
 * der Base-Pfad auch auf GitHub Pages («/dmdb_app/assets/…»). Diese Datei läuft
 * nur im Browser, die Tests initialisieren sql.js direkt (siehe `testUtils.ts`).
 */
import initSqlJs from 'sql.js';
import type { SqlJsStatic } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

let pending: Promise<SqlJsStatic> | null = null;

/** Initialisiert sql.js einmal pro Sitzung und liefert danach immer dasselbe Modul. */
export function loadSqlJs(): Promise<SqlJsStatic> {
  pending ??= initSqlJs({ locateFile: () => wasmUrl });
  return pending;
}
