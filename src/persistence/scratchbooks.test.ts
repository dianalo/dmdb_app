import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAutosaver,
  createScratchbook,
  deleteScratchbook,
  getScratchbook,
  listScratchbooks,
  renameScratchbook,
  updateScratchbook,
} from './scratchbooks';
import { resetDmdbForTests } from './testSupport';

/** Kurze echte Pause, damit sich die ISO-Zeitstempel unterscheiden. */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 2));
}

describe('persistence/scratchbooks', () => {
  beforeEach(async () => {
    await resetDmdbForTests();
  });

  it('legt ein Scratch-Book mit leerem Inhalt an', async () => {
    const book = await createScratchbook('Kapitel 3');

    expect(book.name).toBe('Kapitel 3');
    expect(book.content).toBe('');
    expect(book.createdAt).toBe(book.updatedAt);
    await expect(getScratchbook(book.id)).resolves.toEqual(book);
  });

  it('ändert Inhalt und Name und setzt dabei updatedAt', async () => {
    const book = await createScratchbook('Entwurf', 'SELECT 1;');
    await tick();

    const updated = await updateScratchbook(book.id, { content: 'SELECT 2;' });
    expect(updated.content).toBe('SELECT 2;');
    expect(updated.createdAt).toBe(book.createdAt);
    expect(Date.parse(updated.updatedAt)).toBeGreaterThan(Date.parse(book.updatedAt));

    const renamed = await renameScratchbook(book.id, 'Kapitel 5');
    expect(renamed.name).toBe('Kapitel 5');
    expect(renamed.content).toBe('SELECT 2;');
  });

  it('wirft beim Ändern eines unbekannten Scratch-Books', async () => {
    await expect(updateScratchbook('gibt-es-nicht', { content: '' })).rejects.toThrow(
      /gibt-es-nicht/,
    );
  });

  it('löscht ein Scratch-Book', async () => {
    const book = await createScratchbook('Wegwerf');
    await deleteScratchbook(book.id);

    await expect(getScratchbook(book.id)).resolves.toBeUndefined();
    await expect(listScratchbooks()).resolves.toEqual([]);
  });

  it('listet über den Index byUpdatedAt, zuletzt bearbeitetes zuerst', async () => {
    const a = await createScratchbook('A');
    await tick();
    const b = await createScratchbook('B');
    await tick();
    const c = await createScratchbook('C');

    expect((await listScratchbooks()).map((book) => book.name)).toEqual(['C', 'B', 'A']);

    await tick();
    await updateScratchbook(a.id, { content: '-- neu' });
    expect((await listScratchbooks()).map((book) => book.name)).toEqual(['A', 'C', 'B']);
    expect(b.id).not.toBe(c.id);
  });
});

describe('persistence/scratchbooks: createAutosaver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fasst mehrere schedule-Aufrufe pro ID zu einem Speichern zusammen', async () => {
    const save = vi.fn();
    const autosaver = createAutosaver(save, 500);

    autosaver.schedule('a', 'SELECT 1');
    autosaver.schedule('a', 'SELECT 12');
    autosaver.schedule('a', 'SELECT 123');
    vi.advanceTimersByTime(499);
    expect(save).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('a', 'SELECT 123');
  });

  it('debounced pro ID getrennt', async () => {
    const save = vi.fn();
    const autosaver = createAutosaver(save, 500);

    autosaver.schedule('a', 'A1');
    autosaver.schedule('b', 'B1');
    autosaver.schedule('a', 'A2');
    vi.advanceTimersByTime(500);

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls).toContainEqual(['a', 'A2']);
    expect(save.mock.calls).toContainEqual(['b', 'B1']);
  });

  it('speichert bei flush() sofort und nur einmal', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const autosaver = createAutosaver(save, 500);

    autosaver.schedule('a', 'SELECT 1');
    await autosaver.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('a', 'SELECT 1');

    // Der ausstehende Timer darf nicht noch einmal feuern.
    vi.advanceTimersByTime(1000);
    expect(save).toHaveBeenCalledTimes(1);

    // Ohne Vorgemerktes ist flush() ein No-op.
    await autosaver.flush();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('verwirft Vorgemerktes bei cancel()', async () => {
    const save = vi.fn();
    const autosaver = createAutosaver(save, 500);

    autosaver.schedule('a', 'SELECT 1');
    autosaver.cancel();
    vi.advanceTimersByTime(1000);
    await autosaver.flush();

    expect(save).not.toHaveBeenCalled();
  });
});
