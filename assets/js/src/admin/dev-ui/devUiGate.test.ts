/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { isDevEnabled } from './DevUiPage';

describe('Dev UI gate', () => {
  it('false when flag missing', () => {
    (window as any).fluxOneAdmin = undefined;
    expect(isDevEnabled()).toBe(false);
  });

  it('false when flag not true', () => {
    (window as any).fluxOneAdmin = { isDev: false };
    expect(isDevEnabled()).toBe(false);
  });

  it('true when isDev === true', () => {
    (window as any).fluxOneAdmin = { isDev: true };
    expect(isDevEnabled()).toBe(true);
  });
});

