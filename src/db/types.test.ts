import { describe, expect, it } from 'vitest';
import { ROW_CAP } from './types';

describe('db/types', () => {
  it('begrenzt Resultatmengen auf 1000 Zeilen', () => {
    expect(ROW_CAP).toBe(1000);
  });

  it('lädt das Setup-File fake-indexeddb/auto', () => {
    expect(indexedDB).toBeDefined();
  });
});
