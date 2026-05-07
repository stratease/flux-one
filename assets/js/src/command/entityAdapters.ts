import type { EntityAdapter } from './entitySearch';
import type { Suggestion } from './types';

type PluginRow = { name: string; pluginFile: string; active?: boolean; version?: string; updateAvailable?: boolean };
type UserRow = { id: number; email: string; displayName?: string; login?: string };
type SiteRow = { blogId: number; domain: string; path: string };
type DestinationRow = { id: string; label: string; value: string; url: string; searchText?: string; pathLabels: string[] };
type MenuRow = { id: number; name: string; slug?: string };
type ConfigKeyRow = {
  id: string;
  label: string;
  plugin: string;
  type: string;
  searchText: string;
  group?: string;
  groupLabel?: string;
  choices?: string[];
};
type ConfigValueRow = { id: string; value: string; label?: string; searchText?: string };
type ContentRow = { id: number; postType: 'post' | 'page'; title: string; slug: string; editUrl: string; searchText?: string };

export const pluginAdapter: EntityAdapter<PluginRow> = {
  entityType: 'plugin',
  getId: (p) => p.pluginFile,
  getLabel: (p) => `${p.name}${p.updateAvailable ? ' (update available)' : ''}${p.active ? ' (active)' : ''}`,
  getValue: (p) => p.name,
  getSearchText: (p) => `${p.pluginFile} ${p.version || ''}`,
  toSuggestion: (p) => ({
    id: `plugin.${p.pluginFile}`,
    kind: 'entity',
    entityType: 'plugin',
    label: `${p.name}${p.active ? ' (active)' : ''}`,
    value: p.name,
  }),
  rankBoost: (p, ctx) => {
    const q = ctx.query;
    if (!q) return 0;
    const name = p.name.toLowerCase();
    if (q === name) return 0.6;
    if (name.startsWith(q)) return 0.35;
    return 0;
  },
};

export const userAdapter: EntityAdapter<UserRow> = {
  entityType: 'user',
  getId: (u) => String(u.id),
  getLabel: (u) => `${u.email}${u.displayName ? ` — ${u.displayName}` : ''}`,
  getValue: (u) => u.email,
  getSearchText: (u) => `${u.displayName || ''} ${u.login || ''}`,
  toSuggestion: (u) => ({
    id: `user.${u.id}`,
    kind: 'entity',
    entityType: 'user',
    label: `${u.email}${u.displayName ? ` — ${u.displayName}` : ''}`,
    value: u.email,
  }),
  rankBoost: (u, ctx) => {
    const q = ctx.query;
    if (!q) return 0;
    const em = u.email.toLowerCase();
    if (q === em) return 0.7;
    if (em.startsWith(q)) return 0.4;
    return 0;
  },
};

export const siteAdapter: EntityAdapter<SiteRow> = {
  entityType: 'site',
  getId: (s) => String(s.blogId),
  getLabel: (s) => `${s.domain}${s.path}`,
  getValue: (s) => `${s.domain}${s.path}`,
  getSearchText: (s) => `${s.blogId}`,
  toSuggestion: (s) => ({
    id: `site.${s.blogId}`,
    kind: 'entity',
    entityType: 'site',
    label: `${s.domain}${s.path}`,
    value: `${s.domain}${s.path}`,
  }),
};

export const destinationAdapter: EntityAdapter<DestinationRow> = {
  entityType: 'destination',
  hasHierarchy: true,
  getId: (d) => d.id,
  getLabel: (d) => d.label,
  getValue: (d) => `nav ${d.value}`,
  getSearchText: (d) => `${d.value} ${d.id} ${d.searchText || ''}`,
  getPathLabels: (d) => d.pathLabels,
  toSuggestion: (d, ctx) => ({
    id: `dest.${d.id}`,
    kind: 'entity',
    entityType: 'destination',
    label: d.label,
    displayLabel: ctx.displayLabel,
    pathLabels: ctx.pathLabels,
    value: `nav ${d.value}`,
    clientAction: 'nav',
    navUrl: d.url,
  }),
  rankBoost: (d, ctx) => {
    const q = ctx.query;
    if (!q) return 0;
    const pl = Array.isArray(d.pathLabels) ? d.pathLabels.map((x) => String(x).toLowerCase()) : [];
    const root = pl[0] || '';
    if (root && (q === root || root.startsWith(q))) {
      // Favor roots when query targets the top-level bucket.
      return pl.length === 1 ? 0.7 : 0.25;
    }
    return 0;
  },
};

export const menuShowAdapter: EntityAdapter<MenuRow> = {
  entityType: 'menu',
  getId: (m) => String(m.id),
  getLabel: (m) => String(m.name || ''),
  getValue: (_m) => 'menu list',
  getSearchText: (m) => `${m.slug || ''} ${m.id}`,
  toSuggestion: (m) => ({
    id: `menu.${m.id}`,
    kind: 'entity',
    entityType: 'menu',
    label: String(m.name || ''),
    value: 'menu list',
  }),
  rankBoost: (m, ctx) => {
    const q = ctx.query;
    if (!q) return 0;
    const name = String(m.name || '').toLowerCase();
    const slug = String(m.slug || '').toLowerCase();
    if (q === name || q === slug) return 0.7;
    if (name.startsWith(q) || slug.startsWith(q)) return 0.35;
    return 0;
  },
};

export function makeEditContentAdapter(opts: {
  kind: 'any' | 'post' | 'page';
  typedSub: 'p' | 'post' | 'page';
}): EntityAdapter<ContentRow> {
  const { kind, typedSub } = opts;
  return {
    entityType: 'content',
    hasHierarchy: kind === 'any',
    getId: (r) => String(r.id),
    getLabel: (r) => String(r.title || '(no title)'),
    getValue: (r) => `edit ${typedSub} ${String(r.title || '').trim()}`,
    getSearchText: (r) => `${r.slug || ''} ${r.searchText || ''}`,
    getPathLabels: (r) =>
      kind === 'any' ? [r.postType === 'page' ? 'Page' : 'Post', String(r.title || '(no title)')] : undefined,
    toSuggestion: (r, ctx) => ({
      id: `edit.${r.postType}.${r.id}`,
      kind: 'entity',
      entityType: 'content',
      label: String(r.title || '(no title)'),
      displayLabel: kind === 'any' ? ctx.displayLabel : undefined,
      pathLabels: kind === 'any' ? ctx.pathLabels : undefined,
      value: `edit ${typedSub} ${String(r.title || '').trim()}`,
      clientAction: 'nav',
      navUrl: r.editUrl,
    }),
    rankBoost: (r, ctx) => {
      const q = ctx.query;
      if (!q) return 0;
      const title = String(r.title || '').toLowerCase();
      const slug = String(r.slug || '').toLowerCase();
      if (q === title || q === slug) return 0.8;
      if (title.startsWith(q) || slug.startsWith(q)) return 0.45;
      return 0;
    },
  };
}

export const configKeyAdapter: EntityAdapter<ConfigKeyRow> = {
  entityType: 'configKey',
  getId: (c) => c.id,
  getLabel: (c) => `${c.label} (${c.plugin})`,
  getValue: (c) => c.id,
  getSearchText: (c) =>
    `${c.id} ${c.label} ${c.plugin} ${c.type} ${c.group ?? ''} ${c.groupLabel ?? ''} ${c.searchText}`.trim(),
  toSuggestion: (c) => ({
    id: `cfg.${c.id}`,
    kind: 'entity',
    entityType: 'configKey',
    label: `${c.label} (${c.plugin})`,
    value: c.id,
  }),
  rankBoost: (c, ctx) => {
    const q = ctx.query;
    if (!q) return 0;
    const id = c.id.toLowerCase();
    let boost = 0;
    if (q === id) {
      boost += 0.85;
    } else if (id.startsWith(q)) {
      boost += 0.55;
    } else if (id.includes(q)) {
      boost += 0.22;
    }
    const parts = id.split('.');
    const leaf = parts[parts.length - 1] || '';
    if (leaf && (q === leaf || leaf.startsWith(q))) {
      boost += 0.38;
    }
    if (ctx.queryTokens.length > 1 && ctx.queryTokens.every((t) => id.includes(t))) {
      boost += 0.12;
    }
    return boost;
  },
};

export const configValueAdapter: EntityAdapter<ConfigValueRow> = {
  entityType: 'configValue',
  getId: (v) => v.id,
  getLabel: (v) => v.label || v.value,
  getValue: (v) => v.value,
  getSearchText: (v) => v.searchText || '',
  toSuggestion: (v) => ({
    id: `cfgv.${v.id}`,
    kind: 'entity',
    entityType: 'configValue',
    label: v.label || v.value,
    value: v.value,
  }),
};

export type EntityAdapterMap = Record<NonNullable<Suggestion['entityType']>, EntityAdapter<any>>;

export const ENTITY_ADAPTERS: EntityAdapterMap = {
  plugin: pluginAdapter,
  user: userAdapter,
  menu: menuShowAdapter,
  site: siteAdapter,
  destination: destinationAdapter,
  content: makeEditContentAdapter({ kind: 'any', typedSub: 'p' }),
  configKey: configKeyAdapter,
  configValue: configValueAdapter,
};

