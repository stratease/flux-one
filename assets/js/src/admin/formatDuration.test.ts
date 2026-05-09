import { describe, expect, it } from 'vitest';
import { formatDuration, formatDurationLong, formatDurationShort, getUsageTier } from './formatDuration';

describe('formatDuration', () => {
  it('formats edge and common values', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(5)).toBe('5s');
    expect(formatDuration(65)).toBe('1m 5s');
    expect(formatDuration(8100)).toBe('2h 15m');
  });
});

describe('formatDurationLong', () => {
  it('supports days and preserves existing formats', () => {
    expect(formatDurationLong(0)).toBe('0s');
    expect(formatDurationLong(65)).toBe('1m 5s');
    expect(formatDurationLong(8100)).toBe('2h 15m');
    expect(formatDurationLong(86400)).toBe('1d');
    expect(formatDurationLong(90000)).toBe('1d 1h');
  });
});

describe('formatDurationShort', () => {
  it('formats for chart labels', () => {
    expect(formatDurationShort(0)).toBe('0s');
    expect(formatDurationShort(59)).toBe('59s');
    expect(formatDurationShort(60)).toBe('1m');
    expect(formatDurationShort(3599)).toBe('59m');
    expect(formatDurationShort(3600)).toBe('1h');
    expect(formatDurationShort(3660)).toBe('1h 1m');
    expect(formatDurationShort(86400)).toBe('1d');
    expect(formatDurationShort(90000)).toBe('1d 1h');
  });
});

describe('getUsageTier', () => {
  it('classifies low/medium/high by time saved', () => {
    expect(getUsageTier(0)).toBe('low');
    expect(getUsageTier(14 * 60 + 59)).toBe('low');
    expect(getUsageTier(15 * 60)).toBe('medium');
    expect(getUsageTier(2 * 60 * 60 - 1)).toBe('medium');
    expect(getUsageTier(2 * 60 * 60)).toBe('high');
  });
});
