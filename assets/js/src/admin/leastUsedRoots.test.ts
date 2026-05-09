import { describe, expect, it } from 'vitest';
import { pickLeastUsedRoots } from './leastUsedRoots';

const ALL_ROOTS = ['nav', 'edit', 'plugin', 'user', 'menu', 'config', 'aggregate', 'summary'];

describe('pickLeastUsedRoots', () => {
  it('returns the first three roots in original order when every count is zero', () => {
    expect(pickLeastUsedRoots(ALL_ROOTS, {}, {}, 3)).toEqual(['nav', 'edit', 'plugin']);
  });

  it('sorts ascending by run count and respects the limit', () => {
    const counts = { nav: 10, edit: 2, plugin: 5, user: 0, menu: 1, config: 0, aggregate: 7, summary: 3 };
    expect(pickLeastUsedRoots(ALL_ROOTS, counts, {}, 3)).toEqual(['user', 'config', 'menu']);
  });

  it('breaks count ties by ascending estimated seconds saved', () => {
    const counts = { nav: 1, edit: 1, plugin: 1, user: 0, menu: 0, config: 0, aggregate: 0, summary: 0 };
    const seconds = { nav: 30, edit: 10, plugin: 20 };
    const out = pickLeastUsedRoots(['nav', 'edit', 'plugin'], counts, seconds, 3);
    expect(out).toEqual(['edit', 'plugin', 'nav']);
  });

  it('preserves original order for full ties (stable sort)', () => {
    const counts = { nav: 5, edit: 5, plugin: 5, user: 5 };
    expect(pickLeastUsedRoots(['nav', 'edit', 'plugin', 'user'], counts, {}, 3)).toEqual([
      'nav',
      'edit',
      'plugin',
    ]);
  });

  it('treats missing count and seconds keys as zero without throwing', () => {
    const counts: Record<string, number> = { nav: 4 };
    expect(pickLeastUsedRoots(ALL_ROOTS, counts, {}, 3)).toEqual(['edit', 'plugin', 'user']);
  });

  it('coerces non-finite or negative counts to zero so they outrank real counts', () => {
    const counts = { nav: Number.NaN as unknown as number, edit: -3, plugin: Infinity, user: 2 };
    expect(pickLeastUsedRoots(['nav', 'edit', 'plugin', 'user'], counts, {}, 3)).toEqual([
      'nav',
      'edit',
      'plugin',
    ]);
  });

  it('returns fewer than the limit when fewer ids are supplied', () => {
    expect(pickLeastUsedRoots(['nav', 'edit'], {}, {}, 3)).toEqual(['nav', 'edit']);
  });

  it('defaults the limit to three when omitted', () => {
    expect(pickLeastUsedRoots(ALL_ROOTS, {}, {}).length).toBe(3);
  });
});
