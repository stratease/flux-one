import Fuse from 'fuse.js';
import type { Suggestion } from './types';

export type EntityAdapter<T> = {
  entityType: Suggestion['entityType'];
  hasHierarchy?: boolean;
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  /** Full input value to put in the textbox (e.g. `nav plugins`). */
  getValue: (item: T) => string;
  /** Extra search terms beyond label/value (ids, slugs, etc). */
  getSearchText?: (item: T) => string;
  /** Required when hasHierarchy=true. Must return full root->leaf labels, any depth. */
  getPathLabels?: (item: T) => string[];
  /** Map item -> Suggestion. Called after ranking so adapters can decorate. */
  toSuggestion: (item: T, ctx: { displayLabel?: string; pathLabels?: string[] }) => Suggestion;
  /** Deterministic boost; higher = better. */
  rankBoost?: (item: T, ctx: { query: string; queryTokens: string[] }) => number;
};

export type SearchEntitiesArgs<T> = {
  query: string;
  items: T[];
  adapter: EntityAdapter<T>;
  limit: number;
  /** Eager fuzzy threshold. Higher = more permissive. */
  threshold?: number;
};

function normTokens(q: string): string[] {
  return q
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function buildDisplay(adapterHasHierarchy: boolean, pathLabels: string[] | undefined, leafLabel: string): {
  displayLabel?: string;
  pathLabels?: string[];
} {
  if (!adapterHasHierarchy) {
    return {};
  }
  const pl = Array.isArray(pathLabels) && pathLabels.length ? pathLabels : [leafLabel];
  return { displayLabel: pl.join(' > '), pathLabels: pl };
}

export function searchEntities<T>(args: SearchEntitiesArgs<T>): Suggestion[] {
  const { query, items, adapter, limit } = args;
  const q = (query || '').trim().toLowerCase();
  if (!items.length) return [];

  const hasHierarchy = adapter.hasHierarchy === true;
  const queryTokens = normTokens(q);

  // Build a light wrapper list so Fuse keys are stable.
  const rows = items.map((item) => {
    const label = adapter.getLabel(item);
    const value = adapter.getValue(item);
    const pathLabels = hasHierarchy ? adapter.getPathLabels?.(item) : undefined;
    const { displayLabel } = buildDisplay(hasHierarchy, pathLabels, label);
    const searchText = adapter.getSearchText ? adapter.getSearchText(item) : '';
    const searchable = `${displayLabel || label} ${label} ${value} ${searchText}`.toLowerCase().trim();
    return { item, label, value, searchText, displayLabel: displayLabel || '', searchable };
  });

  const fuse = new Fuse(rows, {
    keys: ['searchable'],
    threshold: args.threshold ?? 0.55,
    ignoreLocation: true,
    includeScore: true,
  });

  const baseHits = q ? fuse.search(q) : rows.slice(0, limit).map((r) => ({ item: r, score: 0 }));

  const scored = baseHits.map((hit) => {
    const row = hit.item;
    const baseScore = typeof hit.score === 'number' ? hit.score : 1;
    const boost = adapter.rankBoost ? adapter.rankBoost(row.item, { query: q, queryTokens }) : 0;
    // Lower is better in Fuse score; convert boost to subtractive.
    const final = baseScore - boost;
    return { row, final };
  });

  scored.sort((a, b) => a.final - b.final);

  const out: Suggestion[] = [];
  for (const s of scored.slice(0, limit)) {
    const leafLabel = adapter.getLabel(s.row.item);
    const pathLabels = hasHierarchy ? adapter.getPathLabels?.(s.row.item) : undefined;
    const disp = buildDisplay(hasHierarchy, pathLabels, leafLabel);
    out.push(adapter.toSuggestion(s.row.item, disp));
  }
  return out;
}

