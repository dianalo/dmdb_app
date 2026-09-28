/**
 * Resultate pro Editor-Tab. Die eigentliche Ausführung macht `dbStore.execute`.
 */
import { create } from 'zustand';
import { SqlError, translateThrown, type StatementResult, type TranslatedError } from '@/db';
import { useDbStore } from './dbStore';
import { useUiStore } from './uiStore';

export interface TabResults {
  running: boolean;
  results: StatementResult[];
  /** ISO-Zeitstempel des letzten abgeschlossenen Laufs. */
  ranAt?: string;
  /** Gesetzt, wenn der Lauf gelang, das Speichern danach aber nicht. */
  persistError?: TranslatedError;
}

export interface ResultState {
  byTab: Record<string, TabResults>;
  /** Führt `sql` für den Tab aus; `offset` ist die Startposition im Editor. */
  run(tabId: string, sql: string, offset?: number): Promise<void>;
  clear(tabId: string): void;
}

const EMPTY: TabResults = { running: false, results: [] };

export const useResultStore = create<ResultState>()((set, get) => {
  function patch(tabId: string, next: Partial<TabResults>): void {
    set((state) => ({
      byTab: { ...state.byTab, [tabId]: { ...(state.byTab[tabId] ?? EMPTY), ...next } },
    }));
  }

  return {
    byTab: {},

    async run(tabId, sql, offset = 0) {
      if (get().byTab[tabId]?.running) return;
      patch(tabId, { running: true });
      try {
        const outcome = await useDbStore.getState().execute(sql, offset);
        patch(tabId, {
          running: false,
          results: outcome.results,
          ranAt: new Date().toISOString(),
          persistError: outcome.persist.error,
        });
      } catch (error) {
        // Unerwartet (z. B. keine Datenbank offen): als Fehlerblock anzeigen.
        patch(tabId, {
          running: false,
          results: [
            {
              kind: 'error',
              sql,
              error: error instanceof SqlError ? error.translated : translateThrown(error),
              range: [offset, offset + sql.length],
            },
          ],
          ranAt: new Date().toISOString(),
          persistError: undefined,
        });
      }
    },

    clear(tabId) {
      set((state) => {
        const next = { ...state.byTab };
        delete next[tabId];
        return { byTab: next };
      });
    },
  };
});

// Geschlossene Tabs vergessen ihre Resultate (bis zu 1000 Zeilen pro Statement),
// sonst wächst der Speicher mit jedem geöffneten und wieder geschlossenen Tab.
// Ein Lauf, der erst nach dem Schliessen fertig wird, landet hier ebenfalls.
function dropClosedTabs(): void {
  const open = new Set(useUiStore.getState().tabs.map((tab) => tab.id));
  const { byTab } = useResultStore.getState();
  const stale = Object.keys(byTab).filter((id) => !open.has(id) && !byTab[id]?.running);
  if (stale.length === 0) return;
  const next = { ...byTab };
  for (const id of stale) delete next[id];
  useResultStore.setState({ byTab: next });
}

useUiStore.subscribe((state, previous) => {
  if (state.tabs !== previous.tabs) dropClosedTabs();
});

useResultStore.subscribe((state, previous) => {
  if (state.byTab !== previous.byTab) dropClosedTabs();
});

/** Leerer Zustand für Tabs ohne Lauf (stabile Referenz für Selektoren). */
export const EMPTY_TAB_RESULTS = EMPTY;
