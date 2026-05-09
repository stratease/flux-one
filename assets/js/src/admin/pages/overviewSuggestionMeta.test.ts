import { describe, expect, it } from 'vitest';
import {
  OVERVIEW_SUGGESTION_META,
  OVERVIEW_SUGGESTION_META_BY_ID,
  buildSuggestionPrefillEvent,
} from './overviewSuggestionMeta';

const EXPECTED_ROOTS = ['nav', 'edit', 'plugin', 'user', 'menu', 'config', 'aggregate', 'summary'];

describe('OVERVIEW_SUGGESTION_META', () => {
  it('covers every canonical root advertised by CommandRouter', () => {
    const ids = OVERVIEW_SUGGESTION_META.map((m) => m.id);
    expect(ids.sort()).toEqual([...EXPECTED_ROOTS].sort());
  });

  it('uses canonical strings without trailing whitespace or punctuation', () => {
    for (const entry of OVERVIEW_SUGGESTION_META) {
      expect(entry.canonical).toMatch(/^[a-z]+$/);
    }
  });

  it('exposes a by-id index that mirrors the array', () => {
    for (const entry of OVERVIEW_SUGGESTION_META) {
      expect(OVERVIEW_SUGGESTION_META_BY_ID[entry.id]).toBe(entry);
    }
  });

  it('attaches a renderable icon component to each entry', () => {
    for (const entry of OVERVIEW_SUGGESTION_META) {
      expect(typeof entry.Icon).toBe('object'); // MUI icon = forwardRef object
    }
  });
});

describe('buildSuggestionPrefillEvent', () => {
  it('produces a flux-one-open CustomEvent with canonical + trailing space', () => {
    const evt = buildSuggestionPrefillEvent('nav');
    expect(evt.type).toBe('flux-one-open');
    expect(evt.detail.input).toBe('nav ');
  });

  it('trims surrounding whitespace before appending the trailing space', () => {
    const evt = buildSuggestionPrefillEvent('  plugin  ');
    expect(evt.detail.input).toBe('plugin ');
  });

  it('returns an empty input when canonical is empty', () => {
    const evt = buildSuggestionPrefillEvent('');
    expect(evt.detail.input).toBe('');
  });
});
