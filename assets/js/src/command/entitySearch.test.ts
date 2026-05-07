import { describe, expect, it } from 'vitest';
import { configKeyAdapter } from './entityAdapters';
import { SUITE_CONFIG_KEY_FUSE_THRESHOLD, searchEntities } from './entitySearch';

describe('searchEntities suite config keys', () => {
  const adapter = {
    ...configKeyAdapter,
    getValue: (row: { id: string }) => row.id,
    toSuggestion: (row: { id: string; label: string }) => ({
      id: row.id,
      kind: 'entity' as const,
      entityType: 'configKey' as const,
      label: row.label,
      value: row.id,
    }),
  };

  it('ranks matching id above unrelated flux row for dotted core id query', () => {
    const items = [
      {
        id: 'wp.permalink_structure',
        label: 'Permalink structure',
        plugin: 'WordPress',
        type: 'string',
        searchText: '',
        group: 'reading',
        groupLabel: 'Reading',
      },
      {
        id: 'flux.email_capture',
        label: 'Email capture',
        plugin: 'Flux One',
        type: 'bool',
        searchText: '',
        group: 'flux_one',
        groupLabel: 'Flux One',
      },
    ];
    const out = searchEntities({
      query: 'wp.permalink_structure',
      items,
      adapter,
      limit: 8,
      threshold: SUITE_CONFIG_KEY_FUSE_THRESHOLD,
      multiTokenAnd: true,
    });
    expect(out[0]?.value).toBe('wp.permalink_structure');
  });

  it('multi-token AND restricts to rows containing every token (group / plugin)', () => {
    const items = [
      {
        id: 'opt.a',
        label: 'Option A',
        plugin: 'Flux One',
        type: 'bool',
        searchText: '',
        group: 'x',
        groupLabel: 'Flux One',
      },
      {
        id: 'wp.blogname',
        label: 'Site title',
        plugin: 'WordPress',
        type: 'string',
        searchText: '',
        group: 'gen',
        groupLabel: 'General',
      },
    ];
    const out = searchEntities({
      query: 'flux one',
      items,
      adapter,
      limit: 12,
      threshold: SUITE_CONFIG_KEY_FUSE_THRESHOLD,
      multiTokenAnd: true,
    });
    expect(out.map((s) => s.value)).toEqual(['opt.a']);
  });
});
