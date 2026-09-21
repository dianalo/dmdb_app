/**
 * CRUD für Scratch-Books plus der debounced Autosave (PLAN.md, 500 ms).
 */
import { openDmdb } from './idb';
import { newId, nowIso } from './ids';
import type { ScratchbookRecord } from './types';

/** Felder, die von aussen geändert werden dürfen. */
export type ScratchbookPatch = Partial<Pick<ScratchbookRecord, 'name' | 'content'>>;

/** Alle Scratch-Books, zuletzt bearbeitetes zuerst (Index `byUpdatedAt`). */
export async function listScratchbooks(): Promise<ScratchbookRecord[]> {
  const db = await openDmdb();
  const ascending = await db.getAllFromIndex('scratchbooks', 'byUpdatedAt');
  return ascending.reverse();
}

export async function getScratchbook(id: string): Promise<ScratchbookRecord | undefined> {
  const db = await openDmdb();
  return db.get('scratchbooks', id);
}

export async function createScratchbook(name: string, content = ''): Promise<ScratchbookRecord> {
  const timestamp = nowIso();
  const record: ScratchbookRecord = {
    id: newId(),
    name,
    content,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const db = await openDmdb();
  await db.put('scratchbooks', record);
  return record;
}

/** Ändert Name und/oder Inhalt und setzt `updatedAt`. */
export async function updateScratchbook(
  id: string,
  patch: ScratchbookPatch,
): Promise<ScratchbookRecord> {
  const db = await openDmdb();
  const tx = db.transaction('scratchbooks', 'readwrite');
  const store = tx.objectStore('scratchbooks');
  const current = await store.get(id);
  if (!current) {
    await tx.done;
    throw new Error(`Es gibt kein Scratch-Book mit der ID «${id}».`);
  }
  const next: ScratchbookRecord = {
    ...current,
    ...patch,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: nowIso(),
  };
  await store.put(next);
  await tx.done;
  return next;
}

export function renameScratchbook(id: string, name: string): Promise<ScratchbookRecord> {
  return updateScratchbook(id, { name });
}

export async function deleteScratchbook(id: string): Promise<void> {
  const db = await openDmdb();
  await db.delete('scratchbooks', id);
}

/** Speichert den Inhalt eines Scratch-Books (Standard-Speicherfunktion des Autosavers). */
export async function saveScratchbookContent(id: string, content: string): Promise<void> {
  await updateScratchbook(id, { content });
}

/** Speicherfunktion des Autosavers. */
export type SaveFn = (id: string, content: string) => void | Promise<void>;

export interface Autosaver {
  /** Merkt den neuen Inhalt vor und speichert ihn nach `delayMs` ohne weitere Änderung. */
  schedule(id: string, content: string): void;
  /** Speichert alle vorgemerkten Inhalte sofort (Tab-Wechsel, Schliessen der Seite). */
  flush(): Promise<void>;
  /** Verwirft alle vorgemerkten Inhalte, ohne zu speichern. */
  cancel(): void;
}

/**
 * Debounced Autosave, pro Scratch-Book getrennt.
 * Reine Timer-Logik ohne DOM, damit sie sich mit `vi.useFakeTimers()` testen lässt.
 */
export function createAutosaver(saveFn: SaveFn, delayMs = 500): Autosaver {
  const pending = new Map<string, { content: string; timer: ReturnType<typeof setTimeout> }>();
  const inFlight = new Set<Promise<void>>();

  function run(id: string, content: string): void {
    const promise = Promise.resolve(saveFn(id, content)).then(() => undefined);
    inFlight.add(promise);
    void promise.finally(() => inFlight.delete(promise));
  }

  function take(id: string): string | undefined {
    const entry = pending.get(id);
    if (!entry) return undefined;
    clearTimeout(entry.timer);
    pending.delete(id);
    return entry.content;
  }

  return {
    schedule(id, content) {
      const existing = pending.get(id);
      if (existing) clearTimeout(existing.timer);
      pending.set(id, {
        content,
        timer: setTimeout(() => {
          const value = take(id);
          if (value !== undefined) run(id, value);
        }, delayMs),
      });
    },

    async flush() {
      for (const id of [...pending.keys()]) {
        const content = take(id);
        if (content !== undefined) run(id, content);
      }
      // Auch bereits angestossene Speicherungen abwarten, damit `flush()` wirklich
      // bedeutet: alles ist geschrieben.
      while (inFlight.size > 0) {
        await Promise.all([...inFlight]);
      }
    },

    cancel() {
      for (const entry of pending.values()) clearTimeout(entry.timer);
      pending.clear();
    },
  };
}
