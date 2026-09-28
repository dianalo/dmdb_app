import { expect, test, type Page } from '@playwright/test';
import {
  activePanel,
  selectAllInEditor,
  firstSummary,
  openApp,
  openDialog,
  runSql,
  setEditorText,
  waitForReady,
} from './helpers';

/** Auf schmalen Viewports ist die Seitenleiste ein Drawer, der erst geöffnet werden muss. */
async function showSidebar(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: 'Seitenleiste öffnen' });
  if (await toggle.isVisible()) await toggle.click();
  await expect(page.locator('#sidepanel')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('App lädt mit Beispieldatenbank und Speicherhinweis', async ({ page }) => {
  await expect(page).toHaveTitle(/DB-Client/);
  await showSidebar(page);
  const tables = page.getByRole('region', { name: 'Tabellen' }).getByRole('listitem');
  await expect(tables).toHaveCount(10);
  await expect(page.getByRole('button', { name: 'song', exact: true })).toBeVisible();

  const notice = page.getByRole('note');
  await expect(notice).toContainText('nur in diesem Browser gespeichert');
  await notice.getByRole('button', { name: 'Verstanden' }).click();
  await expect(notice).toHaveCount(0);
});

test('Query ausführen liefert Zeilenzahl', async ({ page }) => {
  await runSql(page, 'SELECT titel FROM song ORDER BY dauer_sek DESC;');
  await expect(firstSummary(page)).toContainText('300 Zeilen');
  await expect(activePanel(page).locator('article tbody tr').first()).toBeVisible();
});

test('Fehlermeldung auf Deutsch mit Vorschlag', async ({ page }) => {
  await runSql(page, 'SELECT * FROM sng;');
  const error = activePanel(page).getByRole('alert');
  await expect(error).toContainText('Die Tabelle «sng» existiert nicht.');
  await expect(error).toContainText('Meintest du «song»?');
});

test('DML bleibt nach Reload erhalten', async ({ page }) => {
  await runSql(page, "UPDATE song SET titel = 'E2E' WHERE id = 1;");
  await expect(firstSummary(page)).toContainText('1 Zeile geändert');

  await page.reload();
  await waitForReady(page);
  await runSql(page, 'SELECT titel FROM song WHERE id = 1;');
  await expect(firstSummary(page)).toContainText('1 Zeile');
  await expect(activePanel(page).locator('article tbody td').first()).toHaveText('E2E');
});

test('Zurücksetzen stellt die Beispieldatenbank wieder her', async ({ page }) => {
  await runSql(page, 'DELETE FROM bewertung;');
  await expect(firstSummary(page)).toContainText('620 Zeilen geändert');

  await page.getByRole('button', { name: 'Zurücksetzen' }).click();
  const dialog = openDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Zurücksetzen' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Datenbank zurückgesetzt.' }),
  ).toBeVisible();

  await runSql(page, 'SELECT COUNT(*) FROM bewertung;');
  await expect(activePanel(page).locator('article tbody td').first()).toHaveText('620');
});

test('Tabellenansicht: Daten, Sortierung und DDL', async ({ page }) => {
  await showSidebar(page);
  await page.getByRole('button', { name: 'song', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'song' })).toHaveAttribute('aria-selected', 'true');

  const panel = activePanel(page);
  await expect(panel.locator('header')).toContainText('300 Zeilen');
  await expect(panel.locator('tbody tr').first()).toBeVisible();

  const dauer = panel.locator('thead th').filter({ hasText: 'dauer_sek' });
  await dauer.getByRole('button').click();
  await expect(dauer).toHaveAttribute('aria-sort', 'ascending');
  await dauer.getByRole('button').click();
  await expect(dauer).toHaveAttribute('aria-sort', 'descending');

  await panel.getByRole('button', { name: 'DDL', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'DDL', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(panel.locator('.cm-content')).toContainText('CREATE TABLE song');
  await panel.getByRole('button', { name: 'Daten', exact: true }).click();
  await expect(panel.locator('thead th').first()).toBeVisible();
});

test('Neue Datenbank aus DDL erstellen und wieder löschen', async ({ page }) => {
  const dbSelect = page.getByRole('combobox', { name: 'Datenbank' });
  await page.getByRole('button', { name: 'Datenbank-Aktionen' }).click();
  await page.getByRole('menuitem', { name: 'Neue Datenbank…' }).click();

  const dialog = openDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Name').fill('Schule');
  await setEditorText(
    page,
    "CREATE TABLE klasse (id INTEGER PRIMARY KEY, name TEXT);\nINSERT INTO klasse (name) VALUES ('4a');",
    dialog,
  );
  await dialog.getByRole('button', { name: 'Erstellen' }).click();
  await expect(dialog).toHaveCount(0);

  await expect(dbSelect.locator('option:checked')).toHaveText('Schule');
  await expect(page.locator('#sidepanel').getByText('klasse', { exact: true })).toHaveCount(1);
  await runSql(page, 'SELECT name FROM klasse;');
  await expect(activePanel(page).locator('article tbody td').first()).toHaveText('4a');

  await page.getByRole('button', { name: 'Datenbank-Aktionen' }).click();
  await page.getByRole('menuitem', { name: 'Löschen' }).click();
  await expect(openDialog(page)).toContainText('Datenbank «Schule» löschen?');
  await openDialog(page).getByRole('button', { name: 'Löschen' }).click();
  await expect(openDialog(page)).toHaveCount(0);
  await expect(dbSelect.locator('option', { hasText: 'Schule' })).toHaveCount(0);
  await expect(dbSelect.locator('option:checked')).toHaveText('Musik-Streaming');
});

test('Scratch-Book bleibt nach Reload erhalten', async ({ page }) => {
  await showSidebar(page);
  await page.getByRole('button', { name: 'Neues Scratch-Book erstellen' }).click();
  await expect(page.getByRole('tab', { name: 'Scratch-Book 1' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await setEditorText(page, 'SELECT name FROM genre;');
  // Autosave ist debounced (500 ms).
  await page.waitForTimeout(1_000);

  await page.reload();
  await waitForReady(page);
  // Offene Tabs werden wiederhergestellt.
  const tab = page.getByRole('tab', { name: 'Scratch-Book 1' });
  await expect(tab).toHaveCount(1);
  await tab.click();
  await expect(activePanel(page).locator('.cm-content')).toHaveText('SELECT name FROM genre;');
  await expect(page.locator('#sidepanel').getByText('Scratch-Book 1', { exact: true })).toHaveCount(
    1,
  );
});

test.describe('Tablet', () => {
  test('Drawer öffnet die Seitenleiste und schliesst nach Auswahl', async ({ page, hasTouch }) => {
    test.skip(!hasTouch, 'nur mit Touch-Emulation');
    const width = page.viewportSize()?.width ?? 0;
    test.skip(width >= 1024, 'ab 1024 px ist die Seitenleiste fix, kein Drawer');

    const toggle = page.getByRole('button', { name: 'Seitenleiste öffnen' });
    const sidepanel = page.locator('#sidepanel');
    await expect(sidepanel).not.toHaveAttribute('data-open');
    await toggle.tap();
    await expect(sidepanel).toHaveAttribute('data-open');
    await page.getByRole('button', { name: 'album', exact: true }).tap();
    await expect(sidepanel).not.toHaveAttribute('data-open');
    await expect(page.getByRole('tab', { name: 'album' })).toHaveAttribute('aria-selected', 'true');
  });

  test('Smart Punctuation wird zu geraden Anführungszeichen', async ({ page, hasTouch }) => {
    test.skip(!hasTouch, 'nur mit Touch-Emulation');
    const editor = activePanel(page).locator('.cm-content');
    await editor.tap();
    await selectAllInEditor(page);
    await page.keyboard.insertText('SELECT * FROM genre WHERE name = ');
    await page.keyboard.insertText('’Rock’');
    await expect(editor).toHaveText("SELECT * FROM genre WHERE name = 'Rock'");
  });
});
