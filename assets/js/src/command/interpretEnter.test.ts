import { describe, expect, it } from 'vitest';
import { interpretEnter, interpretSuggestionPick } from './interpretEnter';
import type { IndexData } from './suggest';

describe('interpretEnter', () => {
  it('runs trusted plugin entity when ladder is ambiguous (multiple plugins in index)', () => {
    const indices: IndexData = {
      plugins: [
        { name: 'A', pluginFile: 'a/a.php' },
        { name: 'B', pluginFile: 'b/b.php' },
      ],
    };
    const merged = [
      {
        id: 'p1',
        kind: 'entity' as const,
        entityType: 'plugin' as const,
        label: 'A',
        value: 'plugin activate a/a.php',
      },
    ];
    const out = interpretEnter('plugin activate a', { indices, mergedSuggestions: merged, activeIndex: 0 });
    expect(out).toEqual({ kind: 'complete_and_run', value: 'plugin activate a/a.php' });
  });

  it('uses first merged row when activeIndex is out of range but list is non-empty', () => {
    const indices: IndexData = { plugins: [{ name: 'A', pluginFile: 'a/a.php' }] };
    const merged = [
      {
        id: 'p1',
        kind: 'entity' as const,
        entityType: 'plugin' as const,
        label: 'A',
        value: 'plugin activate a/a.php',
      },
    ];
    const out = interpretEnter('plugin activate x', { indices, mergedSuggestions: merged, activeIndex: 99 });
    expect(out).toEqual({ kind: 'complete_and_run', value: 'plugin activate a/a.php' });
  });
});

describe('interpretSuggestionPick', () => {
  it('runs trusted plugin entity without ladder unique match', () => {
    const indices: IndexData = {
      plugins: [
        { name: 'A', pluginFile: 'a/a.php' },
        { name: 'B', pluginFile: 'b/b.php' },
      ],
    };
    const suggestion = {
      id: 'p1',
      kind: 'entity' as const,
      entityType: 'plugin' as const,
      label: 'A',
      value: 'plugin activate a/a.php',
    };
    expect(interpretSuggestionPick(suggestion, indices)).toEqual({
      kind: 'complete_and_run',
      value: 'plugin activate a/a.php',
    });
  });

  it('does not auto-run configKey entity picks (ladder / hybrid fill)', () => {
    const indices: IndexData = { suiteConfig: [{ id: 'foo', label: 'Foo', plugin: 'x', type: 'string', searchText: 'foo' }] };
    const suggestion = {
      id: 'ck1',
      kind: 'entity' as const,
      entityType: 'configKey' as const,
      label: 'Foo',
      value: 'config set foo',
    };
    expect(interpretSuggestionPick(suggestion, indices)).toEqual({ kind: 'complete', value: 'config set foo' });
  });
});
