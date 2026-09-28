import { describe, expect, it } from 'vitest';
import { ariaSort, counterText, isNumericType, mergeRows, nextSort } from './tableViewLogic';

describe('tableViewLogic', () => {
  it('nextSort zykliert aufsteigend → absteigend → aus', () => {
    const asc = nextSort(null, 'titel');
    expect(asc).toEqual({ column: 'titel', dir: 'asc' });
    const desc = nextSort(asc, 'titel');
    expect(desc).toEqual({ column: 'titel', dir: 'desc' });
    expect(nextSort(desc, 'titel')).toBeNull();
  });

  it('nextSort beginnt bei einer anderen Spalte wieder aufsteigend', () => {
    expect(nextSort({ column: 'titel', dir: 'desc' }, 'id')).toEqual({ column: 'id', dir: 'asc' });
  });

  it('ariaSort nur für die sortierte Spalte', () => {
    expect(ariaSort({ column: 'id', dir: 'asc' }, 'id')).toBe('ascending');
    expect(ariaSort({ column: 'id', dir: 'desc' }, 'id')).toBe('descending');
    expect(ariaSort({ column: 'id', dir: 'desc' }, 'titel')).toBeUndefined();
    expect(ariaSort(null, 'id')).toBeUndefined();
  });

  it('mergeRows hängt an oder ersetzt', () => {
    const first = [[1], [2]];
    expect(mergeRows(first, [[3]], true)).toEqual([[1], [2], [3]]);
    expect(mergeRows(first, [[3]], false)).toEqual([[3]]);
    expect(first).toEqual([[1], [2]]);
  });

  it('counterText zeigt «N von M Zeilen», solange nicht alles geladen ist', () => {
    expect(counterText(200, 300)).toBe('200 von 300 Zeilen');
    expect(counterText(300, 300)).toBe('300 Zeilen');
    expect(counterText(1, 1)).toBe('1 Zeile');
    expect(counterText(200, 201)).toBe('200 von 201 Zeilen');
  });

  it('isNumericType erkennt numerische Affinität', () => {
    for (const type of ['INTEGER', 'INT', 'REAL', 'NUMERIC', 'DECIMAL(5,2)', 'double']) {
      expect(isNumericType(type)).toBe(true);
    }
    for (const type of ['TEXT', 'VARCHAR(20)', '', 'BLOB', 'DATE', 'CHARINT']) {
      expect(isNumericType(type)).toBe(false);
    }
  });
});
