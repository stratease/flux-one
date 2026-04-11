import { COMMANDS } from './registry';
import { parseInput } from './normalize';
import type { ParsedInput, Suggestion } from './types';
import Fuse from 'fuse.js';

export type IndexData = {
  plugins?: Array<{ name: string; pluginFile: string; active?: boolean; version?: string; updateAvailable?: boolean }>;
  users?: Array<{ id: number; email: string; displayName?: string; login?: string }>;
  menus?: Array<{ id: number; name: string; slug?: string }>;
  sites?: Array<{ blogId: number; domain: string; path: string }>;
  destinations?: Array<{ id: string; label: string; value: string }>;
};

function filterCommands(q: string): Suggestion[] {
  const qq = q.trim().toLowerCase();
  if (!qq) return COMMANDS.slice(0, 10);

  const fuse = new Fuse(COMMANDS, {
    keys: ['label', 'value'],
    threshold: 0.35,
    ignoreLocation: true,
  });

  return fuse.search(qq).slice(0, 10).map((r) => r.item);
}

/**
 * Token-aware suggestions with after-space entity/subcommand expansion.
 */
export function getSuggestions(raw: string, indices: IndexData): { parsed: ParsedInput; suggestions: Suggestion[] } {
  const parsed = parseInput(raw);
  const normalized = parsed.normalized;
  const rawLower = raw.toLowerCase();

  const t0 = parsed.tokens[0] || '';
  const t1 = parsed.tokens[1] || '';

  // Default: top-level command matches.
  if (!t0) {
    return { parsed, suggestions: filterCommands(normalized) };
  }

  // Stepwise rule: only show the next valid step for the active query.
  // Support `plugins update ...` (alias for plugin update ...).
  if (t0 === 'plugins') {
    // If user is typing "plugins upd" show the next command completion(s) only.
    if (!normalized.includes(' ')) {
      return { parsed, suggestions: filterCommands(normalized).filter((s) => s.value.startsWith('plugins')) };
    }

    // If they started "plugins update", treat it as plugin update flow.
    if (t1 === 'update') {
      const query = rawLower.replace(/^.*plugins\s+update\s+/i, '').trim();
      const list = indices.plugins || [];
      const fuse = new Fuse(list, { keys: ['name', 'pluginFile'], threshold: 0.35, ignoreLocation: true });
      const results = query ? fuse.search(query).slice(0, 10).map((r) => r.item) : [];
      const matches = results.map<Suggestion>((p) => ({
        id: `plugin.update.${p.pluginFile}`,
        kind: 'entity',
        entityType: 'plugin',
        label: `${p.name}${p.updateAvailable ? ' (update available)' : ''}`,
        value: `plugins update ${p.name}`,
      }));

      // If no query yet, show only the next step (update all, or prompt for plugin).
      if (!query) {
        return {
          parsed,
          suggestions: [
            { id: 'cmd.plugins.update.all', kind: 'subcommand', label: 'plugins update all', value: 'plugins update all' },
          ],
        };
      }

      return { parsed, suggestions: matches };
    }

    return { parsed, suggestions: filterCommands(normalized).filter((s) => s.value.startsWith('plugins')) };
  }

  // Plugins: show subcommands as soon as user has started typing `plugin ...`.
  if (t0 === 'plugin') {
    const subsAll = COMMANDS.filter((c) => c.value.startsWith('plugin ') && c.kind === 'subcommand');
    const subs = filterCommands(normalized).filter((s) => s.value.startsWith('plugin ') && s.kind === 'subcommand');
    const subSuggestions = subs.length ? subs : subsAll.slice(0, 6);

    // Stepwise: when user typed only `plugin `, show subcommands only.
    if (parsed.tokens.length === 1) {
      return { parsed, suggestions: subSuggestions.slice(0, 10) };
    }

    // Update flow.
    if (t1 === 'update') {
      const q = rawLower.replace(/^.*plugin\s+update\s+/i, '').trim();
      if (!q) {
        return {
          parsed,
          suggestions: [
            { id: 'cmd.plugin.update.all', kind: 'subcommand', label: 'plugin update all', value: 'plugin update all' },
          ],
        };
      }
      const list = indices.plugins || [];
      const fuse = new Fuse(list, { keys: ['name', 'pluginFile'], threshold: 0.35, ignoreLocation: true });
      const results = fuse.search(q).slice(0, 10).map((r) => r.item);
      return {
        parsed,
        suggestions: results.map((p) => ({
          id: `plugin.update.${p.pluginFile}`,
          kind: 'entity',
          entityType: 'plugin',
          label: `${p.name}${p.updateAvailable ? ' (update available)' : ''}`,
          value: `plugin update ${p.name}`,
        })),
      };
    }

    // Activate/deactivate/delete: show plugin entities only (no mixed list).
    if (['activate', 'deactivate', 'delete'].includes(t1)) {
      const q = rawLower.replace(/^.*plugin\s+(activate|deactivate|delete)\s+/i, '').trim();
      const list = indices.plugins || [];
      if (!q) {
        return { parsed, suggestions: [] };
      }
      const fuse = new Fuse(list, { keys: ['name', 'pluginFile'], threshold: 0.35, ignoreLocation: true });
      const results = fuse.search(q).slice(0, 10).map((r) => r.item);
      return {
        parsed,
        suggestions: results.map((p) => ({
          id: `plugin.${p.pluginFile}`,
          kind: 'entity',
          entityType: 'plugin',
          label: `${p.name}${p.active ? ' (active)' : ''}`,
          value: `plugin ${t1} ${p.name}`,
        })),
      };
    }

    // Fallback: show matching subcommands only.
    return { parsed, suggestions: subSuggestions.slice(0, 10) };
  }

  if (t0 === 'lock' && t1 === 'user') {
    const query = rawLower.replace(/^.*lock\s+user\s+/i, '').trim();
    const list = indices.users || [];
    const fuse = new Fuse(list, {
      keys: ['email', 'displayName', 'login'],
      threshold: 0.35,
      ignoreLocation: true,
    });
    const results = query ? fuse.search(query).slice(0, 10).map((r) => r.item) : [];
    const matches = results.map<Suggestion>((u) => ({
      id: `user.${u.id}`,
      kind: 'entity',
      entityType: 'user',
      label: `${u.email}${u.displayName ? ` — ${u.displayName}` : ''}`,
      value: `lock user ${u.email}`,
    }));
    return { parsed, suggestions: matches };
  }

  if (t0 === 'unlock' && t1 === 'user') {
    const query = rawLower.replace(/^.*unlock\s+user\s+/i, '').trim();
    const list = indices.users || [];
    const fuse = new Fuse(list, {
      keys: ['email', 'displayName', 'login'],
      threshold: 0.35,
      ignoreLocation: true,
    });
    const results = query ? fuse.search(query).slice(0, 10).map((r) => r.item) : [];
    const matches = results.map<Suggestion>((u) => ({
      id: `user.${u.id}`,
      kind: 'entity',
      entityType: 'user',
      label: `${u.email}${u.displayName ? ` — ${u.displayName}` : ''}`,
      value: `unlock user ${u.email}`,
    }));
    return { parsed, suggestions: matches };
  }

  if (t0 === 'menu') {
    const query = rawLower.replace(/^.*menu\s+/i, '').trim();
    const list = indices.menus || [];
    const fuse = new Fuse(list, {
      keys: ['name', 'slug'],
      threshold: 0.35,
      ignoreLocation: true,
    });
    const results = query ? fuse.search(query).slice(0, 10).map((r) => r.item) : [];
    const matches = results.map<Suggestion>((m) => ({
      id: `menu.${m.id}`,
      kind: 'entity',
      entityType: 'menu',
      label: m.name,
      value: `menu ${m.name}`,
    }));
    return { parsed, suggestions: matches };
  }

  if (t0 === 'site' && t1 === 'switch') {
    const query = rawLower.replace(/^.*site\s+switch\s+/i, '').trim();
    const list = indices.sites || [];
    const fuse = new Fuse(list, {
      keys: ['domain', 'path'],
      threshold: 0.35,
      ignoreLocation: true,
    });
    const results = query ? fuse.search(query).slice(0, 10).map((r) => r.item) : [];
    const matches = results.map<Suggestion>((s) => ({
      id: `site.${s.blogId}`,
      kind: 'entity',
      entityType: 'site',
      label: `${s.domain}${s.path}`,
      value: `site switch ${s.domain}${s.path}`,
    }));
    return { parsed, suggestions: matches };
  }

  if (['nav', 'go', 'open'].includes(t0)) {
    const query = rawLower.replace(/^.*(nav|go|open)\s+/i, '').trim();
    const list = indices.destinations || [];
    const fuse = new Fuse(list, {
      keys: ['label', 'value'],
      threshold: 0.35,
      ignoreLocation: true,
    });
    const results = query ? fuse.search(query).slice(0, 10).map((r) => r.item) : [];
    const matches = results.map<Suggestion>((d) => ({
      id: `dest.${d.id}`,
      kind: 'entity',
      entityType: 'destination',
      label: d.label,
      value: `${t0} ${d.value}`,
    }));
    return { parsed, suggestions: matches };
  }

  // Default: command matches.
  return { parsed, suggestions: filterCommands(normalized) };
}

