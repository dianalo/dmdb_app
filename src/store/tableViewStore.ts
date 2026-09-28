/**
 * Zustand der Tabellen-Tabs: Modus, Sortierung, Suche und geladene Zeilen pro Tabelle.
 *
 * Lebt nur im Speicher (wird nicht gespeichert). Die Ansicht lädt ihre Daten bei jeder
 * Aktivierung neu und zusätzlich, wenn sich `dataVersion` ändert, also nach jedem Lauf
 * in einem Editor-Tab, nach dem Zurücksetzen und nach einem Datenbankwechsel.
 */
import { create } from 'zustand';
import {
  SqlError,
  translateThrown,
  type TableInfo,
  type SqlValue,
  type TranslatedError,
} from '@/db';
import {
  PAGE_SIZE,
  mergeRows,
  nextSort,
  type SortState,
} from '@/components/TableView/tableViewLogic';
import { useDbStore } from './dbStore';
import { getEngine } from './engine';
import { useResultStore } from './resultStore';
import { tableTabId, useUiStore } from './uiStore';

export type TableViewMode = 'data' | 'ddl';
export type TableViewStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

export interface TableViewData {
  mode: TableViewMode;
  sort: SortState | null;
  /** Die (entprellte) Suche, mit der zuletzt geladen wurde. */
  filter: string;
  status: TableViewStatus;
  info: TableInfo | null;
  /** Geladene Zeilen (erste Seite plus alles über «Mehr laden»). */
  rows: SqlValue[][];
  /** Anzahl Zeilen, die zur Suche passen. */
  total: number;
  loadingMore: boolean;
  error?: TranslatedError;
}

export interface TableViewState {
  views: Record<string, TableViewData>;
  /** Zählt Änderungen an der Datenbank; Tabellen-Tabs laden danach neu. */
  dataVersion: number;

  /** Lädt Schema und Zeilen neu; die Anzahl geladener Zeilen bleibt erhalten. */
  refresh(name: string): Promise<void>;
  /** Hängt die nächsten `PAGE_SIZE` Zeilen an. */
  loadMore(name: string): Promise<void>;
  setMode(name: string, mode: TableViewMode): void;
  /** Sortierzyklus für eine Spalte: ↑ → ↓ → aus. */
  toggleSort(name: string, column: string): Promise<void>;
  setFilter(name: string, filter: string): Promise<void>;
  /** Merkt eine Änderung an der Datenbank vor. */
  bumpDataVersion(): void;
}

export const DEFAULT_TABLE_VIEW: TableViewData = {
  mode: 'data',
  sort: null,
  filter: '',
  status: 'idle',
  info: null,
  rows: [],
  total: 0,
  loadingMore: false,
};

/** Laufende Ladevorgänge pro Tabelle: nur das Ergebnis des jüngsten zählt. */
const sequence = new Map<string, number>();
function nextSeq(name: string): number {
  const seq = (sequence.get(name) ?? 0) + 1;
  sequence.set(name, seq);
  return seq;
}
const isCurrent = (name: string, seq: number): boolean => sequence.get(name) === seq;

function isMissingTable(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('no such table');
}

export const useTableViewStore = create<TableViewState>()((set, get) => {
  const view = (name: string): TableViewData => get().views[name] ?? DEFAULT_TABLE_VIEW;

  function patch(name: string, next: Partial<TableViewData>): void {
    set((state) => ({
      views: { ...state.views, [name]: { ...(state.views[name] ?? DEFAULT_TABLE_VIEW), ...next } },
    }));
  }

  /** Lädt die ersten `limit` Zeilen mit der aktuellen Sortierung und Suche. */
  async function load(name: string, limit: number): Promise<void> {
    const seq = nextSeq(name);
    if (view(name).info === null) patch(name, { status: 'loading' });
    try {
      const engine = await getEngine();
      const tables = await engine.listTables();
      if (!tables.includes(name)) {
        if (isCurrent(name, seq))
          patch(name, { status: 'missing', info: null, rows: [], total: 0 });
        return;
      }
      const { sort, filter } = view(name);
      const info = await engine.tableInfo(name);
      const page = await engine.pageTable({
        table: name,
        sort: sort ?? undefined,
        filter,
        offset: 0,
        limit,
      });
      if (!isCurrent(name, seq)) return;
      patch(name, {
        status: 'ready',
        info,
        rows: page.rows,
        total: page.total,
        loadingMore: false,
        error: undefined,
      });
    } catch (error) {
      if (!isCurrent(name, seq)) return;
      if (isMissingTable(error)) {
        patch(name, { status: 'missing', info: null, rows: [], total: 0 });
      } else {
        patch(name, {
          status: 'error',
          loadingMore: false,
          error: error instanceof SqlError ? error.translated : translateThrown(error),
        });
      }
    }
  }

  return {
    views: {},
    dataVersion: 0,

    refresh(name) {
      return load(name, Math.max(PAGE_SIZE, view(name).rows.length));
    },

    async loadMore(name) {
      const current = view(name);
      if (current.status !== 'ready' || current.loadingMore) return;
      if (current.rows.length >= current.total) return;
      const seq = nextSeq(name);
      patch(name, { loadingMore: true });
      try {
        const engine = await getEngine();
        const page = await engine.pageTable({
          table: name,
          sort: current.sort ?? undefined,
          filter: current.filter,
          offset: current.rows.length,
          limit: PAGE_SIZE,
        });
        if (!isCurrent(name, seq)) return;
        patch(name, {
          rows: mergeRows(view(name).rows, page.rows, true),
          total: page.total,
          loadingMore: false,
        });
      } catch {
        // Die Tabelle hat sich darunter verändert: einfach ganz neu laden.
        if (isCurrent(name, seq)) await load(name, PAGE_SIZE);
      }
    },

    setMode(name, mode) {
      patch(name, { mode });
    },

    toggleSort(name, column) {
      patch(name, { sort: nextSort(view(name).sort, column) });
      return load(name, PAGE_SIZE);
    },

    setFilter(name, filter) {
      if (view(name).filter === filter) return Promise.resolve();
      patch(name, { filter });
      return load(name, PAGE_SIZE);
    },

    bumpDataVersion() {
      set((state) => ({ dataVersion: state.dataVersion + 1 }));
    },
  };
});

/* ---------- Änderungen an der Datenbank erkennen ---------- */

// Nach jedem abgeschlossenen Lauf in einem Editor-Tab.
useResultStore.subscribe((state, previous) => {
  if (state.byTab === previous.byTab) return;
  const finished = Object.entries(state.byTab).some(
    ([tabId, tab]) => tab.ranAt !== previous.byTab[tabId]?.ranAt,
  );
  if (finished) useTableViewStore.getState().bumpDataVersion();
});

// Datenbankwechsel, Zurücksetzen (neue Metadaten), gespeicherte Änderungen, neues Schema.
useDbStore.subscribe((state, previous) => {
  if (
    state.activeDbId !== previous.activeDbId ||
    state.databases !== previous.databases ||
    state.tables !== previous.tables
  ) {
    useTableViewStore.getState().bumpDataVersion();
  }
});

// Geschlossene Tabellen-Tabs vergessen ihren Zustand.
useUiStore.subscribe((state, previous) => {
  if (state.tabs === previous.tabs) return;
  const open = new Set(state.tabs.map((tab) => tab.id));
  const { views } = useTableViewStore.getState();
  const stale = Object.keys(views).filter((name) => !open.has(tableTabId(name)));
  if (stale.length === 0) return;
  const next = { ...views };
  for (const name of stale) {
    delete next[name];
    sequence.delete(name);
  }
  useTableViewStore.setState({ views: next });
});

/** Nur für Tests: alles vergessen. */
export function resetTableViewStoreForTests(): void {
  sequence.clear();
  useTableViewStore.setState({ views: {}, dataVersion: 0 });
}
