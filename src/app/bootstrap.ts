/**
 * Startsequenz der App und Lebenszyklus-Hooks (Speichern beim Verlassen der Seite).
 *
 * `startApp()` ist idempotent, damit der doppelte Effekt-Aufruf im StrictMode
 * nichts doppelt tut.
 */
import { getSettings, requestPersistentStorage } from '@/persistence';
import { useDbStore } from '@/store/dbStore';
import { useScratchbookStore } from '@/store/scratchbookStore';
import { flushUiSettings, useUiStore } from '@/store/uiStore';

let started: Promise<void> | null = null;
let lifecycleInstalled = false;

/** Lädt Datenbank, Scratch-Books und gespeicherten UI-Zustand. */
export async function hydrateApp(): Promise<void> {
  await useDbStore.getState().init();
  if (useDbStore.getState().status !== 'ready') return;

  const [settings] = await Promise.all([getSettings(), useScratchbookStore.getState().load()]);
  const names: Record<string, string> = {};
  for (const item of useScratchbookStore.getState().list) names[item.id] = item.name;

  // Inhalte offener Scratch-Books vorladen, bevor ihre Tabs erscheinen.
  const openIds = (settings.openTabs ?? [])
    .filter((id) => id.startsWith('sb:'))
    .map((id) => id.slice(3))
    .filter((id) => names[id] !== undefined);
  await Promise.all(openIds.map((id) => useScratchbookStore.getState().ensureLoaded(id)));

  useUiStore.getState().hydrate(settings, names);
}

/** Speichert alles Vorgemerkte sofort. */
export function flushAll(): Promise<void> {
  return Promise.all([useScratchbookStore.getState().flush(), flushUiSettings()]).then(
    () => undefined,
  );
}

function installLifecycle(): void {
  if (lifecycleInstalled || typeof window === 'undefined') return;
  lifecycleInstalled = true;

  window.addEventListener('pagehide', () => void flushAll());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushAll();
  });

  // Tab-Wechsel und -Schliessen: Scratch-Books sofort speichern.
  useUiStore.subscribe((state, previous) => {
    if (state.activeTabId !== previous.activeTabId || state.tabs !== previous.tabs) {
      void useScratchbookStore.getState().flush();
    }
  });

  // Datenbankwechsel: Tabellen-Tabs der alten Datenbank schliessen.
  useDbStore.subscribe((state, previous) => {
    if (state.activeDbId !== previous.activeDbId && previous.activeDbId !== null) {
      useUiStore.getState().pruneTableTabs(state.tables);
    }
  });
}

/** Einmaliger Start der App (aus `App.tsx`). */
export function startApp(): Promise<void> {
  started ??= (async () => {
    installLifecycle();
    await hydrateApp();
    if (useDbStore.getState().status === 'ready') {
      void requestPersistentStorage(); // best effort, Ergebnis egal
    } else {
      started = null; // «Neu laden» darf es erneut versuchen
    }
  })();
  return started;
}
