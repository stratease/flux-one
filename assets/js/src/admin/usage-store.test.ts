/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { readPendingFromLocalStorage, recordCommandUsage } from './usage-store';

describe('usage-store', () => {
  beforeEach(() => {
    localStorage.clear();
    (window as unknown as { fluxOneAdmin?: unknown }).fluxOneAdmin = {
      bootstrap: {
        commandUsage: {
          counts: {},
          estimatesSeconds: { nav: 5, menu: 30 },
          totalSecondsSaved: 0,
        },
      },
    };
  });

  it('recordCommandUsage increments allowed roots only', () => {
    recordCommandUsage('nav');
    recordCommandUsage('menu');
    expect(readPendingFromLocalStorage()).toEqual({ nav: 1, menu: 1 });
    recordCommandUsage('bogus');
    expect(readPendingFromLocalStorage()).toEqual({ nav: 1, menu: 1 });
  });
});
