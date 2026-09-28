import { describe, expect, it } from 'vitest';
import { separatorFor } from './insertExample';

describe('separatorFor', () => {
  it('trennt Beispiele mit einer Leerzeile vom bisherigen Inhalt', () => {
    expect(separatorFor('')).toBe('');
    expect(separatorFor('SELECT 1;')).toBe('\n\n');
    expect(separatorFor('SELECT 1;\n')).toBe('\n');
    expect(separatorFor('SELECT 1;\n\n')).toBe('');
    expect(separatorFor('  ')).toBe('\n');
    expect(separatorFor('\n')).toBe('');
  });
});
