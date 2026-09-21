/**
 * Download von Dateien über Blob-URL und `<a download>`.
 *
 * Bewusst **kein** `showSaveFilePicker()`: das gibt es nur in Chromium.
 * Der Blob-Weg funktioniert in Chrome, Firefox, Safari und Edge und auf iPadOS
 * (dort landet die Datei in «Downloads» der Dateien-App).
 */

/** MIME-Typ für SQLite-Dateien. */
export const SQLITE_MIME = 'application/vnd.sqlite3';
/** MIME-Typ für Scratch-Books (`.sql`). */
export const SQL_TEXT_MIME = 'text/plain;charset=utf-8';

/** Steuerzeichen (C0 und C1) und die auf den Zielsystemen verbotenen Zeichen. */
// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[\u0000-\u001f\u007f-\u009f/\\:*?"<>|]/g;

/**
 * Macht aus einem beliebigen Namen einen brauchbaren Dateinamen:
 * Pfadtrenner und Steuerzeichen raus, Umlaute bleiben.
 * Leerer oder unbrauchbarer Name ergibt `unbenannt`.
 */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(FORBIDDEN, '')
    .replace(/\s+/g, ' ')
    .trim()
    // Führende Punkte erzeugen versteckte Dateien, «.» und «..» sind reserviert.
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 120)
    .trim();

  return cleaned.length > 0 ? cleaned : 'unbenannt';
}

/** Kopiert die Bytes in einen eigenen `ArrayBuffer` (auch als Schutz vor SharedArrayBuffer-Typen). */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = sanitizeFilename(filename);
  anchor.rel = 'noopener';
  // Safari (auch auf iPadOS) lädt nur zuverlässig herunter, wenn der Anker im Dokument hängt.
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Erst nach dem Start des Downloads freigeben, sonst bricht Safari ihn ab.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Lädt Binärdaten herunter, standardmässig als SQLite-Datei. */
export function downloadBytes(filename: string, bytes: Uint8Array, mime = SQLITE_MIME): void {
  triggerDownload(filename, new Blob([toArrayBuffer(bytes)], { type: mime }));
}

/** Lädt Text herunter, standardmässig als `.sql`-Datei in UTF-8. */
export function downloadText(filename: string, text: string, mime = SQL_TEXT_MIME): void {
  triggerDownload(filename, new Blob([text], { type: mime }));
}
