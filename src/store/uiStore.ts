/**
 * UI-Zustand: offene Tabs, aktiver Tab, Seitenleiste, Splitter, Inhalt des Tabs «SQL».
 *
 * Tabs, aktiver Tab, Splitter-Verhältnis und Ad-hoc-SQL werden (debounced) in den
 * Einstellungen gespeichert. Erst nach `hydrate()` wird geschrieben, sonst würde
 * der Anfangszustand die gespeicherten Werte überschreiben.
 */
import { create } from 'zustand';
import { patchSettings, type Settings } from '@/persistence';
import { de } from '@/i18n/de';

export type TabKind = 'sql' | 'scratchbook' | 'table';

export interface Tab {
  id: string;
  kind: TabKind;
  /** Scratch-Book-ID bzw. Tabellenname. */
  refId?: string;
  title: string;
}

/** ID des festen Tabs «SQL». */
export const SQL_TAB_ID = 'sql';

export const DEFAULT_SPLIT_RATIO = 0.45;
export const MIN_SPLIT_RATIO = 0.15;
export const MAX_SPLIT_RATIO = 0.85;
const SETTINGS_DELAY_MS = 400;

const SQL_TAB: Tab = { id: SQL_TAB_ID, kind: 'sql', title: de.tabs.sql };

export const scratchbookTabId = (id: string): string => `sb:${id}`;
export const tableTabId = (name: string): string => `table:${name}`;
/** DOM-IDs für die ARIA-Verknüpfung von Tab und Tab-Inhalt. */
export const tabButtonId = (tabId: string): string => `tab-${tabId}`;
export const tabPanelId = (tabId: string): string => `tabpanel-${tabId}`;

/** Rekonstruiert einen Tab aus seiner gespeicherten ID. */
function tabFromId(id: string, scratchbookNames: Record<string, string>): Tab | null {
  if (id === SQL_TAB_ID) return SQL_TAB;
  if (id.startsWith('sb:')) {
    const refId = id.slice(3);
    const name = scratchbookNames[refId];
    return name === undefined ? null : { id, kind: 'scratchbook', refId, title: name };
  }
  if (id.startsWith('table:')) {
    const refId = id.slice(6);
    return refId ? { id, kind: 'table', refId, title: refId } : null;
  }
  return null;
}

export function clampRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return DEFAULT_SPLIT_RATIO;
  return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, ratio));
}

export interface UiState {
  hydrated: boolean;
  tabs: Tab[];
  activeTabId: string;
  /** Drawer unter 1024 px; darüber ist die Seitenleiste immer sichtbar. */
  sidebarOpen: boolean;
  /** Anteil des Editors an der Höhe (0 bis 1). */
  splitRatio: number;
  /** Ausgabe maximiert (Editor eingeklappt), wird nicht gespeichert. */
  outputMaximized: boolean;
  adhocSql: string;

  /** Übernimmt den gespeicherten Stand; unbekannte Scratch-Books fallen weg. */
  hydrate(settings: Settings, scratchbookNames: Record<string, string>): void;
  activate(id: string): void;
  openScratchbook(id: string, name: string): void;
  openTable(name: string): void;
  closeTab(id: string): void;
  renameTab(id: string, title: string): void;
  /** Schliesst alle Tabellen-Tabs, deren Tabelle es nicht (mehr) gibt. */
  pruneTableTabs(existing: string[]): void;
  setSidebarOpen(open: boolean): void;
  toggleSidebar(): void;
  setSplitRatio(ratio: number): void;
  toggleOutputMaximized(): void;
  setAdhocSql(sql: string): void;
}

export const useUiStore = create<UiState>()((set, get) => {
  function openTab(tab: Tab): void {
    const { tabs } = get();
    const existing = tabs.find((candidate) => candidate.id === tab.id);
    set({ tabs: existing ? tabs : [...tabs, tab], activeTabId: tab.id });
  }

  return {
    hydrated: false,
    tabs: [SQL_TAB],
    activeTabId: SQL_TAB_ID,
    sidebarOpen: false,
    splitRatio: DEFAULT_SPLIT_RATIO,
    outputMaximized: false,
    adhocSql: '',

    hydrate(settings, scratchbookNames) {
      const tabs: Tab[] = [SQL_TAB];
      for (const id of settings.openTabs ?? []) {
        const tab = tabFromId(id, scratchbookNames);
        if (tab && !tabs.some((existing) => existing.id === tab.id)) tabs.push(tab);
      }
      const activeTabId = tabs.some((tab) => tab.id === settings.activeTabId)
        ? (settings.activeTabId as string)
        : SQL_TAB_ID;
      set({
        hydrated: true,
        tabs,
        activeTabId,
        splitRatio: clampRatio(settings.splitRatio ?? DEFAULT_SPLIT_RATIO),
        adhocSql: settings.adhocSql ?? '',
      });
    },

    activate(id) {
      if (get().tabs.some((tab) => tab.id === id)) set({ activeTabId: id });
    },

    openScratchbook(id, name) {
      openTab({ id: scratchbookTabId(id), kind: 'scratchbook', refId: id, title: name });
    },

    openTable(name) {
      openTab({ id: tableTabId(name), kind: 'table', refId: name, title: name });
    },

    closeTab(id) {
      if (id === SQL_TAB_ID) return;
      const { tabs, activeTabId } = get();
      const index = tabs.findIndex((tab) => tab.id === id);
      if (index < 0) return;
      const next = tabs.filter((tab) => tab.id !== id);
      let nextActive = activeTabId;
      if (activeTabId === id) {
        // Wie im Browser: den rechten Nachbarn aktivieren, sonst den linken.
        nextActive = (next[index] ?? next[index - 1] ?? SQL_TAB).id;
      }
      set({ tabs: next, activeTabId: nextActive });
    },

    renameTab(id, title) {
      set((state) => ({
        tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, title } : tab)),
      }));
    },

    pruneTableTabs(existing) {
      const keep = new Set(existing);
      const { tabs, activeTabId } = get();
      const next = tabs.filter((tab) => tab.kind !== 'table' || keep.has(tab.refId ?? ''));
      if (next.length === tabs.length) return;
      set({
        tabs: next,
        activeTabId: next.some((tab) => tab.id === activeTabId) ? activeTabId : SQL_TAB_ID,
      });
    },

    setSidebarOpen(open) {
      set({ sidebarOpen: open });
    },

    toggleSidebar() {
      set((state) => ({ sidebarOpen: !state.sidebarOpen }));
    },

    setSplitRatio(ratio) {
      set({ splitRatio: clampRatio(ratio), outputMaximized: false });
    },

    toggleOutputMaximized() {
      set((state) => ({ outputMaximized: !state.outputMaximized }));
    },

    setAdhocSql(sql) {
      set({ adhocSql: sql });
    },
  };
});

/* ---------- Persistenz (debounced) ---------- */

type PersistedUi = Pick<Settings, 'openTabs' | 'activeTabId' | 'splitRatio' | 'adhocSql'>;

function persistedSlice(state: UiState): PersistedUi {
  return {
    openTabs: state.tabs.map((tab) => tab.id),
    activeTabId: state.activeTabId,
    splitRatio: state.splitRatio,
    adhocSql: state.adhocSql,
  };
}

let timer: ReturnType<typeof setTimeout> | null = null;
let pendingWrite: PersistedUi | null = null;
let inFlight: Promise<unknown> = Promise.resolve();

function write(): Promise<void> {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  const slice = pendingWrite;
  pendingWrite = null;
  if (slice === null) return inFlight.then(() => undefined);
  inFlight = inFlight
    .then(() => patchSettings(slice))
    .catch((error: unknown) => {
      console.warn('Einstellungen konnten nicht gespeichert werden.', error);
    });
  return inFlight.then(() => undefined);
}

useUiStore.subscribe((state, previous) => {
  if (!state.hydrated) return;
  const changed =
    !previous.hydrated ||
    state.tabs !== previous.tabs ||
    state.activeTabId !== previous.activeTabId ||
    state.splitRatio !== previous.splitRatio ||
    state.adhocSql !== previous.adhocSql;
  if (!changed) return;
  pendingWrite = persistedSlice(state);
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(() => void write(), SETTINGS_DELAY_MS);
});

/** Schreibt vorgemerkte Einstellungen sofort (beim Verlassen der Seite, in Tests). */
export function flushUiSettings(): Promise<void> {
  return write();
}

/** Nur für Tests: Anfangszustand ohne Schreiben wiederherstellen. */
export function resetUiStoreForTests(): void {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  pendingWrite = null;
  useUiStore.setState({
    hydrated: false,
    tabs: [SQL_TAB],
    activeTabId: SQL_TAB_ID,
    sidebarOpen: false,
    splitRatio: DEFAULT_SPLIT_RATIO,
    outputMaximized: false,
    adhocSql: '',
  });
}
