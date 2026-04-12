import { ROOT_COMMANDS, SUBCOMMANDS_BY_ROOT } from './registry';
import { canonicalizeTokens, parseInput } from './normalize';
import type { ParsedInput, Suggestion } from './types';
import Fuse from 'fuse.js';

export type IndexData = {
  plugins?: Array<{ name: string; pluginFile: string; active?: boolean; version?: string; updateAvailable?: boolean }>;
  users?: Array<{ id: number; email: string; displayName?: string; login?: string }>;
  menus?: Array<{ id: number; name: string; slug?: string }>;
  sites?: Array<{ blogId: number; domain: string; path: string }>;
  destinations?: Array<{ id: string; label: string; value: string; url: string }>;
  /** Active Flux suite config keys (from GET /index/suite-config). */
  suiteConfig?: Array<{ id: string; label: string; plugin: string; type: string; searchText: string }>;
};

export type SuggestionsResult = {
  parsed: ParsedInput;
  /** Phase A: matching root commands. */
  commandRow: Suggestion[];
  /** Phase B: subcommands or nav destinations. */
  subcommandRow: Suggestion[];
  /** commandRow then subcommandRow (keyboard / ghost). */
  merged: Suggestion[];
};

function filterRoots(q: string): Suggestion[] {
  const qq = q.trim().toLowerCase();
  if (!qq) return ROOT_COMMANDS.slice(0, 12);

  const fuse = new Fuse(ROOT_COMMANDS, {
    keys: ['label', 'value', 'description'],
    threshold: 0.35,
    ignoreLocation: true,
  });

  return fuse.search(qq).slice(0, 12).map((r) => r.item);
}

/** Text after `plugin {verb}` (optional space + tail). */
function tailAfterPluginVerb(rawLower: string, verb: string): string {
  const re = new RegExp(`^.*?plugin\\s+${verb}(?:\\s+(.*))?$`, 'i');
  const m = rawLower.match(re);
  return m && m[1] != null ? String(m[1]).trim() : '';
}

const WP_DEFAULT_ROLES = ['administrator', 'editor', 'author', 'contributor', 'subscriber'] as const;

function filterSubsForRoot(rootKey: string, normalizedInput: string): Suggestion[] {
  const subsAll = SUBCOMMANDS_BY_ROOT[rootKey] || [];
  if (!subsAll.length) return [];

  const qq = normalizedInput.trim().toLowerCase();
  if (!qq) return subsAll.slice(0, 12);

  const fuse = new Fuse(subsAll, {
    keys: ['label', 'value'],
    threshold: 0.35,
    ignoreLocation: true,
  });

  const hit = fuse.search(qq).slice(0, 12).map((r) => r.item);
  return hit.length ? hit : subsAll.slice(0, 8);
}

function destinationSuggestions(
  list: NonNullable<IndexData['destinations']>,
  query: string
): Suggestion[] {
  const fuse = new Fuse(list, {
    keys: ['label', 'value', 'id'],
    threshold: 0.35,
    ignoreLocation: true,
  });
  const results = query ? fuse.search(query).slice(0, 12).map((r) => r.item) : list.slice(0, 12);
  return results.map<Suggestion>((d) => ({
    id: `dest.${d.id}`,
    kind: 'entity',
    entityType: 'destination',
    label: d.label,
    value: `nav ${d.value}`,
    clientAction: 'nav',
    navUrl: d.url,
  }));
}

/** Exported for preview UI (canonical first token after aliases). */
export function getRouteTokens(parsed: ParsedInput): string[] {
  const withSummary =
    parsed.mode === 'summary' ? (['summary', ...parsed.tokens] as string[]) : [...parsed.tokens];
  return canonicalizeTokens(withSummary);
}

function routeTokens(parsed: ParsedInput): string[] {
  return getRouteTokens(parsed);
}

/**
 * Resolve `nav <query>` against the preloaded destinations index; returns a URL only when unambiguous.
 */
export function resolveNavDestinationUrl(
  query: string,
  destinations: IndexData['destinations'] | undefined
): string | null {
  if (!destinations?.length || !query.trim()) {
    return null;
  }
  const q = query.trim().toLowerCase();
  const strong = destinations.filter(
    (d) => q === String(d.value).toLowerCase() || q === String(d.id).toLowerCase()
  );
  if (strong.length === 1 && strong[0].url) {
    return strong[0].url;
  }
  const fuse = new Fuse(destinations, {
    keys: ['label', 'value', 'id'],
    threshold: 0.35,
    ignoreLocation: true,
  });
  const r = fuse.search(q);
  if (r.length === 1 && r[0].item.url) {
    return r[0].item.url;
  }
  return null;
}

/**
 * Token-aware suggestions with after-space entity/subcommand expansion.
 */
export function getSuggestions(raw: string, indices: IndexData): SuggestionsResult {
  const parsed = parseInput(raw);
  const normalized = parsed.normalized;
  const rawLower = raw.toLowerCase();

  const rt = routeTokens(parsed);
  const t0 = rt[0] || '';
  const t1 = rt[1] || '';

  const pack = (commandRow: Suggestion[], subcommandRow: Suggestion[]): SuggestionsResult => ({
    parsed,
    commandRow,
    subcommandRow,
    merged: [...commandRow, ...subcommandRow],
  });

  // --- Phase C: entity / deep paths (unchanged behavior, single list in subcommand row) ---

  if (t0 === 'plugin') {
    const subsAll = SUBCOMMANDS_BY_ROOT.plugin;
    const subs = filterSubsForRoot('plugin', normalized);
    const subSuggestions = subs.length ? subs : subsAll.slice(0, 8);

    if (rt.length === 1) {
      const commandRow = filterRoots(normalized);
      const showExactRoot = t0 === 'plugin';
      const subRow =
        parsed.hasTrailingSpace || (showExactRoot && !parsed.hasTrailingSpace)
          ? subSuggestions.slice(0, 12)
          : [];
      return pack(parsed.hasTrailingSpace ? [] : commandRow, subRow);
    }

    if (t1 === 'update') {
      const q = tailAfterPluginVerb(rawLower, 'update');
      if (!q) {
        return pack(
          [],
          [
            {
              id: 'cmd.plugin.update.all',
              kind: 'subcommand',
              label: 'plugin update all',
              value: 'plugin update all',
            },
          ]
        );
      }
      const list = indices.plugins || [];
      const fuse = new Fuse(list, { keys: ['name', 'pluginFile'], threshold: 0.35, ignoreLocation: true });
      const results = fuse.search(q).slice(0, 10).map((r) => r.item);
      return pack(
        [],
        results.map((p) => ({
          id: `plugin.update.${p.pluginFile}`,
          kind: 'entity' as const,
          entityType: 'plugin' as const,
          label: `${p.name}${p.updateAvailable ? ' (update available)' : ''}`,
          value: `plugin update ${p.name}`,
        }))
      );
    }

    if (['activate', 'deactivate', 'delete'].includes(t1)) {
      const q = tailAfterPluginVerb(rawLower, t1);
      const list = indices.plugins || [];
      const fuse = new Fuse(list, { keys: ['name', 'pluginFile'], threshold: 0.35, ignoreLocation: true });
      const results = q
        ? fuse.search(q).slice(0, 10).map((r) => r.item)
        : list.slice(0, 10);
      return pack(
        [],
        results.map((p) => ({
          id: `plugin.${p.pluginFile}`,
          kind: 'entity' as const,
          entityType: 'plugin' as const,
          label: `${p.name}${p.active ? ' (active)' : ''}`,
          value: `plugin ${t1} ${p.name}`,
        }))
      );
    }

    return pack([], subSuggestions.slice(0, 12));
  }

  if (t0 === 'user') {
    if (rt.length === 1) {
      const subsAll = SUBCOMMANDS_BY_ROOT.user;
      const subs = filterSubsForRoot('user', normalized);
      const subSuggestions = subs.length ? subs : subsAll;
      const commandRow = filterRoots(normalized);
      const subRow =
        parsed.hasTrailingSpace || (!parsed.hasTrailingSpace && t0 === 'user') ? subSuggestions.slice(0, 12) : [];
      return pack(parsed.hasTrailingSpace ? [] : commandRow, subRow);
    }

    if (t1 === 'list' || t1 === 'show') {
      return pack([], []);
    }

    if (t1 === 'lock') {
      const query = rawLower.replace(/^.*user\s+lock\s+/i, '').trim();
      const list = indices.users || [];
      const fuse = new Fuse(list, {
        keys: ['email', 'displayName', 'login'],
        threshold: 0.35,
        ignoreLocation: true,
      });
      const results = query ? fuse.search(query).slice(0, 10).map((r) => r.item) : list.slice(0, 10);
      const matches = results.map<Suggestion>((u) => ({
        id: `user.${u.id}`,
        kind: 'entity',
        entityType: 'user',
        label: `${u.email}${u.displayName ? ` — ${u.displayName}` : ''}`,
        value: `user lock ${u.email}`,
      }));
      return pack([], matches);
    }

    if (t1 === 'unlock') {
      const query = rawLower.replace(/^.*user\s+unlock\s+/i, '').trim();
      const list = indices.users || [];
      const fuse = new Fuse(list, {
        keys: ['email', 'displayName', 'login'],
        threshold: 0.35,
        ignoreLocation: true,
      });
      const results = query ? fuse.search(query).slice(0, 10).map((r) => r.item) : list.slice(0, 10);
      const matches = results.map<Suggestion>((u) => ({
        id: `user.${u.id}`,
        kind: 'entity',
        entityType: 'user',
        label: `${u.email}${u.displayName ? ` — ${u.displayName}` : ''}`,
        value: `user unlock ${u.email}`,
      }));
      return pack([], matches);
    }

    const t2 = rt[2] || '';
    if (t1 === 'role' && t2 === 'set') {
      const tailM = rawLower.match(/^.*?user\s+role\s+set\s*(.*)$/i);
      const rest = (tailM && tailM[1] != null ? String(tailM[1]) : '').trim();
      const list = indices.users || [];

      if (!rest) {
        return pack(
          [],
          list.slice(0, 10).map<Suggestion>((u) => ({
            id: `user.role.${u.id}`,
            kind: 'entity',
            entityType: 'user',
            label: `${u.email}${u.displayName ? ` — ${u.displayName}` : ''}`,
            value: `user role set ${u.email} `,
          }))
        );
      }

      const emailTail = /^(\S+@\S+)\s*(.*)$/.exec(rest);
      if (emailTail) {
        const em = emailTail[1];
        const roleQ = (emailTail[2] || '').trim();
        if (!roleQ) {
          return pack(
            [],
            WP_DEFAULT_ROLES.map<Suggestion>((r) => ({
              id: `role.pick.${r}`,
              kind: 'subcommand',
              label: r,
              value: `user role set ${em} ${r}`,
            }))
          );
        }
        const rfuse = new Fuse(
          WP_DEFAULT_ROLES.map((name) => ({ name })),
          { keys: ['name'], threshold: 0.35, ignoreLocation: true }
        );
        const rhits = rfuse.search(roleQ).slice(0, 8).map((r) => r.item.name);
        const roles = rhits.length ? rhits : WP_DEFAULT_ROLES.filter((r) => r.startsWith(roleQ.toLowerCase())).slice(0, 8);
        return pack(
          [],
          roles.map<Suggestion>((r) => ({
            id: `role.pick.${r}`,
            kind: 'subcommand',
            label: r,
            value: `user role set ${em} ${r}`,
          }))
        );
      }

      const fuse = new Fuse(list, {
        keys: ['email', 'displayName', 'login'],
        threshold: 0.35,
        ignoreLocation: true,
      });
      const results = fuse.search(rest).slice(0, 10).map((r) => r.item);
      return pack(
        [],
        results.map<Suggestion>((u) => ({
          id: `user.role.${u.id}`,
          kind: 'entity',
          entityType: 'user',
          label: `${u.email}${u.displayName ? ` — ${u.displayName}` : ''}`,
          value: `user role set ${u.email} `,
        }))
      );
    }

    const q = rawLower.replace(/^user\s+/i, '').trim();
    const list = indices.users || [];
    const fuse = new Fuse(list, {
      keys: ['email', 'displayName', 'login'],
      threshold: 0.35,
      ignoreLocation: true,
    });
    const results = q ? fuse.search(q).slice(0, 10).map((r) => r.item) : [];
    return pack(
      [],
      results.map<Suggestion>((u) => ({
        id: `user.${u.id}`,
        kind: 'entity',
        entityType: 'user',
        label: `${u.email}${u.displayName ? ` — ${u.displayName}` : ''}`,
        value: `user ${u.email}`,
      }))
    );
  }

  if (t0 === 'menu') {
    if (rt.length === 1) {
      const item = SUBCOMMANDS_BY_ROOT.menu[0];
      const commandRow = filterRoots(normalized);
      const subRow =
        parsed.hasTrailingSpace || (!parsed.hasTrailingSpace && t0 === 'menu') ? (item ? [item] : []) : [];
      return pack(parsed.hasTrailingSpace ? [] : commandRow, subRow);
    }
    return pack([], []);
  }

  if (t0 === 'site') {
    if (rt.length === 1) {
      const subsAll = SUBCOMMANDS_BY_ROOT.site;
      const subs = filterSubsForRoot('site', normalized);
      const subSuggestions = subs.length ? subs : subsAll;
      const commandRow = filterRoots(normalized);
      const subRow =
        parsed.hasTrailingSpace || (!parsed.hasTrailingSpace && t0 === 'site') ? subSuggestions.slice(0, 12) : [];
      return pack(parsed.hasTrailingSpace ? [] : commandRow, subRow);
    }

    if (t1 === 'switch') {
      const query = rawLower.replace(/^.*site\s+switch\s+/i, '').trim();
      const list = indices.sites || [];
      const fuse = new Fuse(list, {
        keys: ['domain', 'path'],
        threshold: 0.35,
        ignoreLocation: true,
      });
      const results = query ? fuse.search(query).slice(0, 10).map((r) => r.item) : list.slice(0, 10);
      const matches = results.map<Suggestion>((s) => ({
        id: `site.${s.blogId}`,
        kind: 'entity',
        entityType: 'site',
        label: `${s.domain}${s.path}`,
        value: `site switch ${s.domain}${s.path}`,
      }));
      return pack([], matches);
    }

    return pack([], []);
  }

  if (t0 === 'config') {
    const subsAll = SUBCOMMANDS_BY_ROOT.config;
    const subs = filterSubsForRoot('config', normalized);
    const subSuggestions = subs.length ? subs : subsAll;
    if (rt.length === 1) {
      const commandRow = filterRoots(normalized);
      const subRow =
        parsed.hasTrailingSpace || (!parsed.hasTrailingSpace && t0 === 'config')
          ? subSuggestions.slice(0, 12)
          : [];
      return pack(parsed.hasTrailingSpace ? [] : commandRow, subRow);
    }

    const list = indices.suiteConfig || [];
    const cfgM = rawLower.match(/^config\s+(get|set)\s*(.*)$/i);
    if (cfgM) {
      const verb = String(cfgM[1] || '').toLowerCase();
      const rest = String(cfgM[2] || '').trim();

      if (verb === 'get') {
        const fuse = new Fuse(list, {
          keys: ['id', 'label', 'plugin', 'searchText'],
          threshold: 0.35,
          ignoreLocation: true,
        });
        const results = rest
          ? fuse.search(rest).slice(0, 12).map((r) => r.item)
          : list.slice(0, 12);
        return pack(
          [],
          results.map<Suggestion>((row) => ({
            id: `cfg.get.${row.id}`,
            kind: 'entity',
            entityType: 'configKey',
            label: `${row.label} (${row.plugin})`,
            value: `config get ${row.id}`,
          }))
        );
      }

      if (verb === 'set') {
        const fs = rest.indexOf(' ');
        const partialId = (fs === -1 ? rest : rest.slice(0, fs)).trim();
        const valuePart = fs === -1 ? '' : rest.slice(fs + 1).trim();

        if (!valuePart) {
          const fuse = new Fuse(list, {
            keys: ['id', 'label', 'plugin', 'searchText'],
            threshold: 0.35,
            ignoreLocation: true,
          });
          const results = partialId
            ? fuse.search(partialId).slice(0, 12).map((r) => r.item)
            : list.slice(0, 12);
          return pack(
            [],
            results.map<Suggestion>((row) => ({
              id: `cfg.set.${row.id}`,
              kind: 'entity',
              entityType: 'configKey',
              label: `${row.label} · ${row.type} (${row.plugin})`,
              value: `config set ${row.id} `,
            }))
          );
        }

        const def = list.find((x) => String(x.id).toLowerCase() === partialId.toLowerCase());
        if (def && def.type === 'bool' && !/\s/.test(valuePart)) {
          const pv = valuePart.toLowerCase();
          const hints = ['true', 'false'].filter((b) => b.startsWith(pv));
          if (hints.length) {
            return pack(
              [],
              hints.map<Suggestion>((b) => ({
                id: `cfg.bool.${def.id}.${b}`,
                kind: 'subcommand',
                label: b,
                value: `config set ${def.id} ${b}`,
              }))
            );
          }
        }
      }
    }

    // e.g. `config list`, `config search …`, `config li` — anything other than get/set entity flow.
    const tailAfterConfig = rawLower.replace(/^config\s+/, '').trim();
    const fuseCfgSub = new Fuse(subsAll, {
      keys: ['label', 'value'],
      threshold: 0.4,
      ignoreLocation: true,
    });
    const cfgSubHits = tailAfterConfig
      ? fuseCfgSub.search(tailAfterConfig).slice(0, 10).map((r) => r.item)
      : subsAll;
    return pack([], cfgSubHits.length ? cfgSubHits : subsAll.slice(0, 8));
  }

  if (t0 === 'nav') {
    const query = rawLower.replace(/^.*(nav|go|open)\s+/i, '').trim();
    const list = indices.destinations || [];
    const dests = destinationSuggestions(list, query);
    if (rt.length === 1) {
      const commandRow = filterRoots(normalized);
      const subRow =
        parsed.hasTrailingSpace || (!parsed.hasTrailingSpace && t0 === 'nav') ? dests : [];
      return pack(parsed.hasTrailingSpace ? [] : commandRow, subRow);
    }
    return pack([], dests);
  }

  // --- Phase A: unknown prefix, only roots ---
  if (!t0) {
    return pack(filterRoots(''), []);
  }

  const commandRow = filterRoots(normalized);
  return pack(commandRow, []);
}
