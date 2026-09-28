import { expect, type Locator, type Page } from '@playwright/test';

/** Sichtbarer Tab-Inhalt (es gibt immer genau einen aktiven Tab). */
export function activePanel(page: Page): Locator {
  return page.locator('[role=tabpanel]:not([hidden])');
}

/** Geöffneter modaler Dialog. */
export function openDialog(page: Page): Locator {
  return page.locator('dialog[open]');
}

/** App öffnen und warten, bis die Beispieldatenbank geladen ist. */
export async function openApp(page: Page): Promise<void> {
  await page.goto('./');
  await waitForReady(page);
}

/** Wartet, bis Editor und Tabellenliste bereit sind (auch nach einem Reload). */
export async function waitForReady(page: Page): Promise<void> {
  await expect(activePanel(page).locator('.cm-content')).toBeVisible({ timeout: 30_000 });
  // Im geschlossenen Drawer ist die Tabellenliste `inert` und fehlt im
  // Accessibility-Tree, deshalb hier Text statt Rolle.
  await expect(page.locator('#sidepanel').getByText('song', { exact: true })).toHaveCount(1, {
    timeout: 30_000,
  });
}

/**
 * Markiert den ganzen Inhalt eines fokussierten CodeMirror-Editors.
 *
 * CodeMirror wählt die Tastenbelegung nach dem Browser, nicht nach dem Host-OS.
 * Die Apple-Belegung (Alles-Markieren auf Cmd+A, Ctrl+A ist «Zeilenanfang») gilt,
 * wenn `navigator.platform` «Mac» enthält oder der Browser iOS-Safari ist (Vendor
 * «Apple Computer» und Mobile-UA oder Touch). Die Erkennung hier bildet
 * `@codemirror/view` nach. `ControlOrMeta` richtet sich dagegen nach dem Host
 * (Linux in der CI) und träfe im iPad-Profil die falsche Taste.
 */
export async function selectAllInEditor(page: Page): Promise<void> {
  const apple = await page.evaluate(() => {
    const nav = globalThis.navigator as {
      vendor?: string;
      platform?: string;
      userAgent?: string;
      maxTouchPoints?: number;
    };
    const safari = /Apple Computer/.test(nav.vendor ?? '');
    const ios =
      safari && (/Mobile\/\w+/.test(nav.userAgent ?? '') || (nav.maxTouchPoints ?? 0) > 2);
    return ios || /Mac/.test(nav.platform ?? '');
  });
  await page.keyboard.press(apple ? 'Meta+A' : 'Control+A');
}

/**
 * Ersetzt den Inhalt eines CodeMirror-Editors. `insertText` statt `fill`, damit der
 * Text wie eine Eingabe über die (virtuelle) Tastatur ankommt.
 *
 * Bewusst ohne Delete/Backspace: Im iOS-Modus hält CodeMirror diese Tasten kurz
 * zurück und verschluckt eine unmittelbar folgende Eingabe. Der eingefügte Text
 * ersetzt deshalb direkt die Markierung.
 */
export async function setEditorText(page: Page, text: string, scope?: Locator): Promise<void> {
  const editor = (scope ?? activePanel(page)).locator('.cm-content').first();
  await editor.click();
  await selectAllInEditor(page);
  await page.keyboard.insertText(text);
  // Ein offenes Autocomplete-Popup schliessen.
  const tooltip = page.locator('.cm-tooltip-autocomplete');
  if (await tooltip.isVisible()) await page.keyboard.press('Escape');
}

/** Klickt «Ausführen» im aktiven Editor-Tab. */
export async function clickRun(page: Page): Promise<void> {
  await activePanel(page).getByRole('button', { name: 'Ausführen' }).click();
}

/** SQL in den aktiven Editor schreiben und ausführen. */
export async function runSql(page: Page, sql: string): Promise<void> {
  await setEditorText(page, sql);
  await clickRun(page);
}

/** Zusammenfassung des ersten Ausgabeblocks, z. B. «300 Zeilen». */
export function firstSummary(page: Page): Locator {
  return activePanel(page).locator('article p').first();
}
