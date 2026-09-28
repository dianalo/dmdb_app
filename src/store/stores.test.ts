import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadTestSqlJs } from '@/db/testUtils';
import { getDatabaseMeta, getSettings, resetConnectionForTests, setSetting } from '@/persistence';
import { resetDmdbForTests } from '@/persistence/testSupport';
import { hydrateApp } from '@/app/bootstrap';
import { resetDbStoreForTests, useDbStore } from './dbStore';
import { setSqlJsLoader } from './engine';
import { useResultStore } from './resultStore';
import {
  nextScratchbookName,
  resetScratchbookStoreForTests,
  useScratchbookStore,
} from './scratchbookStore';
import {
  SQL_TAB_ID,
  flushUiSettings,
  resetUiStoreForTests,
  scratchbookTabId,
  tableTabId,
  useUiStore,
} from './uiStore';

const BUILTIN = 'builtin:musik-streaming';

/** Simuliert einen Neustart der App: Stores und Engine vergessen, IndexedDB bleibt. */
function restart(): void {
  resetDbStoreForTests();
  resetUiStoreForTests();
  resetScratchbookStoreForTests();
  useResultStore.setState({ byTab: {} });
  setSqlJsLoader(loadTestSqlJs);
  resetConnectionForTests();
}

async function countRows(sql: string): Promise<unknown> {
  const outcome = await useDbStore.getState().execute(sql);
  const first = outcome.results[0];
  return first?.kind === 'rows' ? first.rows[0]?.[0] : first;
}

describe('stores', () => {
  beforeEach(async () => {
    restart();
    await resetDmdbForTests();
  });

  afterEach(async () => {
    await flushUiSettings();
    await useScratchbookStore.getState().flush();
  });

  describe('dbStore', () => {
    it('init baut die Beispieldatenbank aus dem Seed und zeigt 10 Tabellen', async () => {
      await useDbStore.getState().init();
      const state = useDbStore.getState();
      expect(state.status).toBe('ready');
      expect(state.activeDbId).toBe(BUILTIN);
      expect(state.tables).toHaveLength(10);
      expect(state.tables).toContain('song');
      expect(state.errorContext.columns['song']).toContain('titel');
      expect(state.databases.map((db) => db.id)).toEqual([BUILTIN]);
    });

    it('init ist idempotent', async () => {
      await Promise.all([useDbStore.getState().init(), useDbStore.getState().init()]);
      expect(useDbStore.getState().status).toBe('ready');
    });

    it('DELETE FROM song wird gespeichert und übersteht einen Neustart', async () => {
      await useDbStore.getState().init();
      await useResultStore
        .getState()
        .run(
          SQL_TAB_ID,
          'DELETE FROM song_genre; DELETE FROM playlist_song; DELETE FROM bewertung; DELETE FROM song;',
        );
      const tab = useResultStore.getState().byTab[SQL_TAB_ID];
      expect(tab?.running).toBe(false);
      expect(tab?.results.map((r) => r.kind)).toEqual(['changes', 'changes', 'changes', 'changes']);
      expect(tab?.persistError).toBeUndefined();
      expect((await getDatabaseMeta(BUILTIN))?.modified).toBe(true);

      restart();
      await useDbStore.getState().init();
      expect(await countRows('SELECT COUNT(*) FROM song')).toBe(0);
    });

    it('ein reines SELECT markiert die Datenbank nicht als verändert', async () => {
      await useDbStore.getState().init();
      await useResultStore
        .getState()
        .run(SQL_TAB_ID, 'SELECT titel FROM song ORDER BY dauer_sek DESC;');
      const result = useResultStore.getState().byTab[SQL_TAB_ID]?.results[0];
      expect(result?.kind).toBe('rows');
      if (result?.kind === 'rows') expect(result.rows).toHaveLength(300);
      expect((await getDatabaseMeta(BUILTIN))?.modified).toBe(false);
    });

    it('DDL aktualisiert die Tabellenliste', async () => {
      await useDbStore.getState().init();
      await useDbStore
        .getState()
        .execute('CREATE TABLE notiz (id INTEGER PRIMARY KEY, text TEXT);');
      expect(useDbStore.getState().tables).toContain('notiz');
      expect(useDbStore.getState().errorContext.columns['notiz']).toEqual(['id', 'text']);
    });

    it('meldet einen Speicherfehler bei offener Transaktion', async () => {
      await useDbStore.getState().init();
      const outcome = await useDbStore.getState().execute('BEGIN; DELETE FROM bewertung;');
      expect(outcome.persist.saved).toBe(false);
      expect(outcome.persist.error?.title).toBeTruthy();
      await useDbStore.getState().execute('ROLLBACK;');
    });

    it('resetBuiltin stellt den Seed wieder her', async () => {
      await useDbStore.getState().init();
      await useDbStore.getState().execute('DELETE FROM bewertung;');
      expect(await countRows('SELECT COUNT(*) FROM bewertung')).toBe(0);
      await useDbStore.getState().resetBuiltin();
      expect(Number(await countRows('SELECT COUNT(*) FROM bewertung'))).toBeGreaterThan(0);
      expect((await getDatabaseMeta(BUILTIN))?.modified).toBe(false);
    });

    it('createFromDdl, switchDatabase und deleteDatabase', async () => {
      await useDbStore.getState().init();
      const meta = await useDbStore
        .getState()
        .createFromDdl('Schule', 'CREATE TABLE klasse (id INTEGER PRIMARY KEY, name TEXT);');
      expect(useDbStore.getState().activeDbId).toBe(meta.id);
      expect(useDbStore.getState().tables).toEqual(['klasse']);
      expect((await getSettings()).activeDbId).toBe(meta.id);

      await useDbStore.getState().switchDatabase(BUILTIN);
      expect(useDbStore.getState().tables).toHaveLength(10);
      await useDbStore.getState().switchDatabase(meta.id);

      await useDbStore.getState().deleteDatabase(meta.id);
      expect(useDbStore.getState().activeDbId).toBe(BUILTIN);
      expect(useDbStore.getState().databases.map((db) => db.id)).toEqual([BUILTIN]);
      await expect(useDbStore.getState().deleteDatabase(BUILTIN)).rejects.toThrow();
    });

    it('createFromDdl mit Fehler speichert nichts', async () => {
      await useDbStore.getState().init();
      await expect(
        useDbStore.getState().createFromDdl('Kaputt', 'CREATE TABEL x (id INTEGER);'),
      ).rejects.toThrow();
      expect(useDbStore.getState().databases).toHaveLength(1);
      expect(useDbStore.getState().activeDbId).toBe(BUILTIN);
    });

    it('importSqlite übernimmt gültige Dateien und lehnt ungültige ab', async () => {
      await useDbStore.getState().init();
      const SQL = await loadTestSqlJs();
      const source = new SQL.Database();
      source.run('CREATE TABLE t (a INTEGER); INSERT INTO t VALUES (1);');
      const bytes = source.export();
      source.close();

      const meta = await useDbStore.getState().importSqlite('Import', bytes);
      expect(useDbStore.getState().activeDbId).toBe(meta.id);
      expect(useDbStore.getState().tables).toEqual(['t']);

      await expect(
        useDbStore.getState().importSqlite('Müll', new TextEncoder().encode('kein sqlite')),
      ).rejects.toThrow();
      expect(useDbStore.getState().activeDbId).toBe(meta.id);
    });

    it('importSqliteFile benennt nach der Datei und macht den Namen eindeutig', async () => {
      await useDbStore.getState().init();
      const SQL = await loadTestSqlJs();
      const source = new SQL.Database();
      source.run('CREATE TABLE t (a INTEGER);');
      const bytes = source.export();
      source.close();

      const first = await useDbStore.getState().importSqliteFile('schule.sqlite', bytes);
      const second = await useDbStore.getState().importSqliteFile('Schule.db', bytes);
      expect(first.name).toBe('schule');
      expect(second.name).toBe('Schule (2)');
      expect(useDbStore.getState().activeDbId).toBe(second.id);
    });

    it('fällt auf die Beispieldatenbank zurück, wenn activeDbId unbekannt ist', async () => {
      await resetDmdbForTests();
      await setSetting('activeDbId', 'gibt-es-nicht');
      await useDbStore.getState().init();
      expect(useDbStore.getState().activeDbId).toBe(BUILTIN);
    });
  });

  describe('uiStore', () => {
    it('öffnet, aktiviert und schliesst Tabs; SQL bleibt', () => {
      const ui = useUiStore.getState();
      ui.openTable('song');
      ui.openTable('album');
      ui.openTable('song');
      expect(useUiStore.getState().tabs.map((t) => t.id)).toEqual([
        SQL_TAB_ID,
        tableTabId('song'),
        tableTabId('album'),
      ]);
      expect(useUiStore.getState().activeTabId).toBe(tableTabId('song'));
      ui.closeTab(tableTabId('song'));
      expect(useUiStore.getState().activeTabId).toBe(tableTabId('album'));
      ui.closeTab(SQL_TAB_ID);
      ui.closeTab(tableTabId('album'));
      expect(useUiStore.getState().tabs.map((t) => t.id)).toEqual([SQL_TAB_ID]);
      expect(useUiStore.getState().activeTabId).toBe(SQL_TAB_ID);
    });

    it('begrenzt das Splitter-Verhältnis', () => {
      useUiStore.getState().setSplitRatio(2);
      expect(useUiStore.getState().splitRatio).toBe(0.85);
      useUiStore.getState().setSplitRatio(-1);
      expect(useUiStore.getState().splitRatio).toBe(0.15);
    });

    it('Tabs, aktiver Tab, Splitter und Ad-hoc-SQL überstehen einen Neustart', async () => {
      await hydrateApp();
      const sb = await useScratchbookStore.getState().create();
      useUiStore.getState().openTable('song');
      useUiStore.getState().setSplitRatio(0.6);
      useUiStore.getState().setAdhocSql('SELECT 1;');
      useUiStore.getState().activate(scratchbookTabId(sb.id));
      await flushUiSettings();

      restart();
      await hydrateApp();
      const ui = useUiStore.getState();
      expect(ui.tabs.map((t) => t.id)).toEqual([
        SQL_TAB_ID,
        scratchbookTabId(sb.id),
        tableTabId('song'),
      ]);
      expect(ui.tabs[1]?.title).toBe('Scratch-Book 1');
      expect(ui.activeTabId).toBe(scratchbookTabId(sb.id));
      expect(ui.splitRatio).toBe(0.6);
      expect(ui.adhocSql).toBe('SELECT 1;');
      expect(useScratchbookStore.getState().contents[sb.id]).toBe('');
    });

    it('schreibt vor hydrate() nichts in die Einstellungen', async () => {
      useUiStore.getState().setAdhocSql('nicht speichern');
      await flushUiSettings();
      expect((await getSettings()).adhocSql).toBeUndefined();
    });

    it('lässt Tabs gelöschter Scratch-Books beim Laden weg', () => {
      useUiStore
        .getState()
        .hydrate({ openTabs: ['sql', 'sb:weg', 'table:song'], activeTabId: 'sb:weg' }, {});
      expect(useUiStore.getState().tabs.map((t) => t.id)).toEqual(['sql', 'table:song']);
      expect(useUiStore.getState().activeTabId).toBe('sql');
    });
  });

  describe('scratchbookStore', () => {
    it('vergibt freie Standardnamen', () => {
      expect(nextScratchbookName([])).toBe('Scratch-Book 1');
      expect(nextScratchbookName(['Scratch-Book 1', 'Scratch-Book 3'])).toBe('Scratch-Book 2');
    });

    it('speichert Inhalte per Autosave und lädt sie nach einem Neustart', async () => {
      await hydrateApp();
      const sb = await useScratchbookStore.getState().create('Übung K4');
      expect(useUiStore.getState().activeTabId).toBe(scratchbookTabId(sb.id));
      useScratchbookStore.getState().updateContent(sb.id, 'SELECT * FROM song;');
      await useScratchbookStore.getState().flush();
      await flushUiSettings();

      restart();
      await hydrateApp();
      expect(useScratchbookStore.getState().list.map((item) => item.name)).toEqual(['Übung K4']);
      expect(useScratchbookStore.getState().contents[sb.id]).toBe('SELECT * FROM song;');
    });

    it('create vergibt den ersten freien Standardnamen', async () => {
      await hydrateApp();
      const a = await useScratchbookStore.getState().create();
      const b = await useScratchbookStore.getState().create();
      await useScratchbookStore.getState().remove(a.id);
      const c = await useScratchbookStore.getState().create();
      expect([a.name, b.name, c.name]).toEqual([
        'Scratch-Book 1',
        'Scratch-Book 2',
        'Scratch-Book 1',
      ]);
    });

    it('createFromFile übernimmt Name und Inhalt und öffnet den Tab', async () => {
      await hydrateApp();
      const first = await useScratchbookStore
        .getState()
        .createFromFile('Übung K4.sql', 'SELECT 1;');
      const second = await useScratchbookStore.getState().createFromFile('übung k4.txt', '');
      const third = await useScratchbookStore.getState().createFromFile('.sql', 'x');
      expect(first.name).toBe('Übung K4');
      expect(second.name).toBe('übung k4 (2)');
      expect(third.name).toBe('Scratch-Book 1');
      expect(useScratchbookStore.getState().contents[first.id]).toBe('SELECT 1;');
      expect(useUiStore.getState().activeTabId).toBe(scratchbookTabId(third.id));

      restart();
      await hydrateApp();
      await useScratchbookStore.getState().ensureLoaded(first.id);
      expect(useScratchbookStore.getState().contents[first.id]).toBe('SELECT 1;');
    });

    it('benennt um und löscht (inklusive Tab)', async () => {
      await hydrateApp();
      const sb = await useScratchbookStore.getState().create();
      await useScratchbookStore.getState().rename(sb.id, 'Neu benannt');
      expect(useUiStore.getState().tabs[1]?.title).toBe('Neu benannt');
      useScratchbookStore.getState().updateContent(sb.id, 'x');
      await useScratchbookStore.getState().remove(sb.id);
      expect(useScratchbookStore.getState().list).toEqual([]);
      expect(useUiStore.getState().tabs.map((t) => t.id)).toEqual([SQL_TAB_ID]);
    });
  });
});
