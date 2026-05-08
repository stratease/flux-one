import { describe, expect, it } from 'vitest';
import { formatDuration } from './formatDuration';

describe('formatDuration', () => {
  it('formats edge and common values', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(5)).toBe('5s');
    expect(formatDuration(65)).toBe('1m 5s');
    expect(formatDuration(8100)).toBe('2h 15m');
  });
});
