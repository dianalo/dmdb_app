/**
 * Öffnen lokaler Dateien über ein verstecktes `<input type="file">`.
 *
 * Bewusst **kein** `showOpenFilePicker()` (nur Chromium). Das Input-Element muss
 * im Dokument hängen und darf nicht `display: none` sein, sonst öffnet iPadOS-Safari
 * den Dateidialog nicht.
 */

/** Wartezeit nach Rückkehr des Fensterfokus, bis ein Abbruch angenommen wird. */
const CANCEL_GRACE_MS = 500;

/**
 * Lässt eine Datei auswählen. Liefert `null`, wenn abgebrochen wurde.
 *
 * @param accept Wert für das `accept`-Attribut, z. B. `.sqlite,.db` oder `.sql,text/plain`.
 */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise<File | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = false;
    // Unsichtbar, aber im Layout: `display: none` bricht den Dialog auf iPadOS.
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.opacity = '0';
    input.setAttribute('aria-hidden', 'true');
    input.tabIndex = -1;

    let settled = false;
    let cancelTimer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = (): void => {
      if (cancelTimer !== undefined) clearTimeout(cancelTimer);
      input.removeEventListener('change', onChange);
      input.removeEventListener('cancel', onCancel);
      window.removeEventListener('focus', onFocus);
      input.remove();
    };

    const settle = (file: File | null): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(file);
    };

    function onChange(): void {
      settle(input.files?.[0] ?? null);
    }

    function onCancel(): void {
      settle(null);
    }

    // Fallback für Browser ohne `cancel`-Event: kommt der Fokus zurück und ist
    // kurz darauf immer noch keine Datei da, war es ein Abbruch.
    function onFocus(): void {
      if (cancelTimer !== undefined) clearTimeout(cancelTimer);
      cancelTimer = setTimeout(() => {
        if (!input.files || input.files.length === 0) settle(null);
      }, CANCEL_GRACE_MS);
    }

    input.addEventListener('change', onChange);
    input.addEventListener('cancel', onCancel);
    window.addEventListener('focus', onFocus);

    document.body.appendChild(input);
    input.click();
  });
}

/** Liest eine Datei als Text (UTF-8), z. B. ein Scratch-Book. */
export function readFileText(file: File): Promise<string> {
  return file.text();
}

/** Liest eine Datei als Bytes, z. B. eine `.sqlite`-Datei. */
export async function readFileBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}
