/**
 * Scratch-Books: Liste, Inhalte der geöffneten, Autosave.
 *
 * Welche Scratch-Books offen sind, steht in den Tabs (`uiStore`); `activeIds`
 * wird daraus abgeleitet, damit es nur eine Quelle der Wahrheit gibt.
 */
import { create } from 'zustand';
import { downloadText } from '@/files/download';
import { de } from '@/i18n/de';
import {
  createAutosaver,
  createScratchbook,
  deleteScratchbook,
  getScratchbook,
  listScratchbooks,
  renameScratchbook,
  saveScratchbookContent,
  type ScratchbookRecord,
} from '@/persistence';
import { nameFromFilename, uniqueName } from './names';
import { scratchbookTabId, useUiStore } from './uiStore';

/** Listeneintrag ohne Inhalt. */
export type ScratchbookSummary = Pick<ScratchbookRecord, 'id' | 'name' | 'updatedAt'>;

export interface ScratchbookState {
  list: ScratchbookSummary[];
  /** Inhalte der geladenen Scratch-Books, nach ID. */
  contents: Record<string, string>;

  load(): Promise<void>;
  /** Lädt den Inhalt (falls nötig) und öffnet bzw. aktiviert den Tab. */
  open(id: string): Promise<void>;
  /** Legt ein Scratch-Book an und öffnet es; ohne Name «Scratch-Book N». */
  create(name?: string, content?: string): Promise<ScratchbookRecord>;
  /** Legt ein Scratch-Book aus einer geöffneten Datei an (Name ohne Endung, eindeutig). */
  createFromFile(filename: string, content: string): Promise<ScratchbookRecord>;
  /** Lädt ein Scratch-Book als `.sql`-Datei herunter (nur im Browser). */
  download(id: string): Promise<void>;
  /** Lädt den Inhalt eines Scratch-Books in den Cache, ohne den Tab zu öffnen. */
  ensureLoaded(id: string): Promise<void>;
  updateContent(id: string, content: string): void;
  /** Speichert alle vorgemerkten Änderungen sofort. */
  flush(): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  remove(id: string): Promise<void>;
}

/** IDs der Scratch-Books, die in einem Tab offen sind. */
export function selectOpenScratchbookIds(): string[] {
  return useUiStore
    .getState()
    .tabs.filter((tab) => tab.kind === 'scratchbook' && tab.refId !== undefined)
    .map((tab) => tab.refId as string);
}

/** Nächster freier Standardname «Scratch-Book N». */
export function nextScratchbookName(existing: string[]): string {
  const taken = new Set(existing);
  for (let n = 1; ; n += 1) {
    const candidate = de.sidebar.defaultScratchbookName(n);
    if (!taken.has(candidate)) return candidate;
  }
}

const summarize = (record: ScratchbookRecord): ScratchbookSummary => ({
  id: record.id,
  name: record.name,
  updatedAt: record.updatedAt,
});

/** Gelöschte Scratch-Books dürfen ein verspätetes Speichern nicht wieder anlegen. */
const deleted = new Set<string>();

const autosaver = createAutosaver(async (id, content) => {
  if (deleted.has(id)) return;
  try {
    await saveScratchbookContent(id, content);
  } catch (error) {
    console.warn('Scratch-Book konnte nicht gespeichert werden.', error);
  }
});

export const useScratchbookStore = create<ScratchbookState>()((set, get) => ({
  list: [],
  contents: {},

  async load() {
    const records = await listScratchbooks();
    set({ list: records.map(summarize) });
  },

  async ensureLoaded(id) {
    if (get().contents[id] !== undefined) return;
    const record = await getScratchbook(id);
    if (!record) return;
    set((state) => ({ contents: { ...state.contents, [id]: record.content } }));
  },

  async open(id) {
    await get().ensureLoaded(id);
    const entry = get().list.find((item) => item.id === id);
    if (!entry || get().contents[id] === undefined) return;
    useUiStore.getState().openScratchbook(id, entry.name);
  },

  async create(name, content = '') {
    const finalName = name?.trim() || nextScratchbookName(get().list.map((item) => item.name));
    const record = await createScratchbook(finalName, content);
    set((state) => ({
      list: [summarize(record), ...state.list],
      contents: { ...state.contents, [record.id]: record.content },
    }));
    useUiStore.getState().openScratchbook(record.id, record.name);
    return record;
  },

  createFromFile(filename, content) {
    const existing = get().list.map((item) => item.name);
    const base = nameFromFilename(filename, nextScratchbookName(existing));
    return get().create(uniqueName(base, existing), content);
  },

  async download(id) {
    await autosaver.flush();
    const entry = get().list.find((item) => item.id === id);
    if (!entry) return;
    const content = get().contents[id] ?? (await getScratchbook(id))?.content ?? '';
    downloadText(`${entry.name}.sql`, content);
  },

  updateContent(id, content) {
    set((state) => ({ contents: { ...state.contents, [id]: content } }));
    autosaver.schedule(id, content);
  },

  flush() {
    return autosaver.flush();
  },

  async rename(id, name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    await autosaver.flush();
    const record = await renameScratchbook(id, trimmed);
    set((state) => ({
      list: state.list.map((item) => (item.id === id ? summarize(record) : item)),
    }));
    useUiStore.getState().renameTab(scratchbookTabId(id), record.name);
  },

  async remove(id) {
    deleted.add(id);
    await autosaver.flush();
    await deleteScratchbook(id);
    useUiStore.getState().closeTab(scratchbookTabId(id));
    set((state) => {
      const contents = { ...state.contents };
      delete contents[id];
      return { list: state.list.filter((item) => item.id !== id), contents };
    });
  },
}));

/** Nur für Tests. */
export function resetScratchbookStoreForTests(): void {
  autosaver.cancel();
  deleted.clear();
  useScratchbookStore.setState({ list: [], contents: {} });
}
