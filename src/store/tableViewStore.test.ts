import { beforeEach, describe, expect, it } from 'vitest';
import { loadTestSqlJs } from '@/db/testUtils';
import { resetConnectionForTests } from '@/persistence';
import { resetDmdbForTests } from '@/persistence/testSupport';
import { resetDbStoreForTests, useDbStore } from './dbStore';
import { setSqlJsLoader } from './engine';
import { useResultStore } from './resultStore';
import { resetTableViewStoreForTests, useTableViewStore } from './tableViewStore';
import { SQL_TAB_ID, resetUiStoreForTests, useUiStore } from './uiStore';

const view = (name: string) => useTableViewStore.getState().views[name];

describe('tableViewStore', () => {
  beforeEach(async () => {
    resetDbStoreForTests();
    resetUiStoreForTests();
    resetTableViewStoreForTests();
    useResultStore.setState({ byTab: {} });
    setSqlJsLoader(loadTestSqlJs);
    resetConnectionForTests();
    await resetDmdbForTests();
    await useDbStore.getState().init();
    useUiStore.getState().openTable('song');
  });

  it('lädt die ersten 200 Zeilen, Schema und DDL', async () => {
    await useTableViewStore.getState().refresh('song');
    const song = view('song');
    expect(song?.status).toBe('ready');
    expect(song?.info?.rowCount).toBe(300);
    expect(song?.info?.ddl).toMatch(/^CREATE TABLE song/);
    expect(song?.info?.columns.find((c) => c.name === 'id')?.primaryKey).toBe(true);
    expect(song?.rows).toHaveLength(200);
    expect(song?.total).toBe(300);
  });

  it('«Mehr laden» hängt die nächste Seite an; ein Refresh behält die Anzahl', async () => {
    const store = useTableViewStore.getState();
    await store.refresh('song');
    await store.loadMore('song');
    expect(view('song')?.rows).toHaveLength(300);
    await store.loadMore('song'); // nichts mehr da
    expect(view('song')?.rows).toHaveLength(300);
    await store.refresh('song');
    expect(view('song')?.rows).toHaveLength(300);
  });

  it('sortiert im Zyklus und setzt dabei auf die erste Seite zurück', async () => {
    const store = useTableViewStore.getState();
    await store.refresh('song');
    await store.loadMore('song');
    await store.toggleSort('song', 'dauer_sek');
    await store.toggleSort('song', 'dauer_sek');
    const song = view('song');
    expect(song?.sort).toEqual({ column: 'dauer_sek', dir: 'desc' });
    expect(song?.rows).toHaveLength(200);
    const columns = song?.info?.columns.map((c) => c.name) ?? [];
    const index = columns.indexOf('dauer_sek');
    const durations = song?.rows.map((row) => row[index] as number) ?? [];
    expect(durations[0]).toBe(Math.max(...durations));
    await store.toggleSort('song', 'dauer_sek');
    expect(view('song')?.sort).toBeNull();
  });

  it('filtert über alle Spalten', async () => {
    const store = useTableViewStore.getState();
    await store.setFilter('song', 'gibt es sicher nicht');
    expect(view('song')?.total).toBe(0);
    expect(view('song')?.info?.rowCount).toBe(300);
  });

  it('erhöht dataVersion nach einem Lauf und sieht die Änderung', async () => {
    const before = useTableViewStore.getState().dataVersion;
    await useResultStore
      .getState()
      .run(SQL_TAB_ID, "UPDATE song SET titel = 'Testtitel' WHERE id = 1;");
    expect(useTableViewStore.getState().dataVersion).toBeGreaterThan(before);
    await useTableViewStore.getState().setFilter('song', 'Testtitel');
    expect(view('song')?.total).toBe(1);
  });

  it('meldet eine gelöschte Tabelle', async () => {
    await useTableViewStore.getState().refresh('song');
    await useDbStore.getState().execute('PRAGMA foreign_keys = OFF; DROP TABLE song;');
    await useTableViewStore.getState().refresh('song');
    expect(view('song')?.status).toBe('missing');
  });

  it('vergisst den Zustand, wenn der Tab geschlossen wird', async () => {
    await useTableViewStore.getState().refresh('song');
    useTableViewStore.getState().setMode('song', 'ddl');
    expect(view('song')?.mode).toBe('ddl');
    useUiStore.getState().closeTab('table:song');
    expect(view('song')).toBeUndefined();
  });
});
