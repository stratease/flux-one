import { MULTISTEP_COMMANDS, ROOT_COMMANDS, SUBCOMMANDS_BY_ROOT } from './registry';
import { canonicalizeTokens, parseInput } from './normalize';
import type { ParsedInput, Suggestion } from './types';
import Fuse from 'fuse.js';
import { searchEntities, SUITE_CONFIG_KEY_FUSE_THRESHOLD } from './entitySearch';
import {
  configKeyAdapter,
  destinationAdapter,
  makeEditContentAdapter,
  pluginAdapter,
  siteAdapter,
  userAdapter,
} from './entityAdapters';

export type IndexData = {
  plugins?: Array<{ name: string; pluginFile: string; active?: boolean; version?: string; updateAvailable?: boolean }>;
  users?: Array<{ id: number; email: string; displayName?: string; login?: string }>;
  menus?: Array<{ id: number; name: string; slug?: string }>;
  sites?: Array<{ blogId: number; domain: string; path: string }>;
  destinations?: Array<{
    id: string;
    label: string;
    value: string;
    url: string;
    searchText?: string;
    pathLabels: string[];
    parentId?: string;
  }>;
  /** Active Flux suite config keys (from GET /index/suite-config). */
  suiteConfig?: Array<{
    id: string;
    label: string;
    plugin: string;
    type: string;
    searchText: string;
    group?: string;
    groupLabel?: string;
    groupOrder?: number;
    min?: number;
    max?: number;
    choices?: string[];
  }>;
  /** Role slugs the current user may assign (from GET /bootstrap editableRoles). */
  editableRoles?: string[];

  /** Logged-in user (from bootstrap); used to exclude self from `user lock` targets. */
  currentUser?: { id: number; email: string };

  /** Content search (XHR) for edit command. */
  content?: Array<{
    id: number;
    postType: 'post' | 'page';
    title: string;
    slug: string;
    editUrl: string;
    searchText?: string;
  }>;
};

function isCompleteEmailToken(s: string): boolean {
  return /^[^\s@]+@[^\s@]+$/.test((s || '').trim());
}

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
    keys: ['label', 'value', 'description', 'searchText'],
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

function getMultiStepPrompt(commandKey: string, stepIndex: number, fallback: string): string {
  const def = MULTISTEP_COMMANDS[commandKey];
  return def?.steps?.[stepIndex]?.prompt || fallback;
}

function filterSubsForRoot(rootKey: string, normalizedInput: string): Suggestion[] {
  const subsAll = SUBCOMMANDS_BY_ROOT[rootKey] || [];
  if (!subsAll.length) return [];

  const qq = normalizedInput.trim().toLowerCase();
  if (!qq) return subsAll.slice(0, 12);

  const fuse = new Fuse(subsAll, {
    keys: ['label', 'value', 'description'],
    threshold: 0.35,
    ignoreLocation: true,
  });

  const hit = fuse.search(qq).slice(0, 12).map((r) => r.item);
  return hit.length ? hit : subsAll.slice(0, 8);
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
  const fuseRows = destinations.map((d) => ({
    ...d,
    pathText: Array.isArray(d.pathLabels) ? d.pathLabels.join(' ') : '',
  }));
  const fuse = new Fuse(fuseRows, {
    keys: ['label', 'value', 'id', 'searchText', 'pathText'],
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
      const results = searchEntities({
        query: q,
        items: list,
        adapter: {
          ...pluginAdapter,
          getValue: (p) => `plugin update ${p.name}`,
          toSuggestion: (p) => ({
            id: `plugin.update.${p.pluginFile}`,
            kind: 'entity',
            entityType: 'plugin',
            label: `${p.name}${p.updateAvailable ? ' (update available)' : ''}`,
            value: `plugin update ${p.name}`,
          }),
        },
        limit: 10,
      });
      return pack(
        [],
        results
      );
    }

    if (['activate', 'deactivate', 'delete'].includes(t1)) {
      const q = tailAfterPluginVerb(rawLower, t1);
      const list = indices.plugins || [];
      const results = searchEntities({
        query: q,
        items: q ? list : list.slice(0, 200),
        adapter: {
          ...pluginAdapter,
          getValue: (p) => `plugin ${t1} ${p.name}`,
          toSuggestion: (p) => ({
            id: `plugin.${t1}.${p.pluginFile}`,
            kind: 'entity',
            entityType: 'plugin',
            label: `${p.name}${p.active ? ' (active)' : ''}`,
            value: `plugin ${t1} ${p.name}`,
          }),
        },
        limit: 10,
      });
      return pack(
        [],
        results
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
      const selfId = indices.currentUser?.id;
      const list = (indices.users || []).filter((u) => (selfId == null ? true : u.id !== selfId));
      const matches = searchEntities({
        query,
        items: query ? list : list.slice(0, 200),
        adapter: {
          ...userAdapter,
          getValue: (u) => `user lock ${u.email}`,
          toSuggestion: (u) => ({
            id: `user.lock.${u.id}`,
            kind: 'entity',
            entityType: 'user',
            label: `${u.email}${u.displayName ? ` — ${u.displayName}` : ''}`,
            value: `user lock ${u.email}`,
          }),
        },
        limit: 10,
      });
      return pack([], matches);
    }

    if (t1 === 'unlock') {
      const query = rawLower.replace(/^.*user\s+unlock\s+/i, '').trim();
      const list = indices.users || [];
      const matches = searchEntities({
        query,
        items: query ? list : list.slice(0, 200),
        adapter: {
          ...userAdapter,
          getValue: (u) => `user unlock ${u.email}`,
          toSuggestion: (u) => ({
            id: `user.unlock.${u.id}`,
            kind: 'entity',
            entityType: 'user',
            label: `${u.email}${u.displayName ? ` — ${u.displayName}` : ''}`,
            value: `user unlock ${u.email}`,
          }),
        },
        limit: 10,
      });
      return pack([], matches);
    }

    if (t1 === 'add') {
      const tailM = rawLower.match(/^.*?user\s+add\s*(.*)$/i);
      const rest = (tailM && tailM[1] != null ? String(tailM[1]) : '').trim();
      const parts = rest.split(/\s+/).filter(Boolean);
      const roleKeys =
        indices.editableRoles && indices.editableRoles.length > 0
          ? indices.editableRoles
          : [...WP_DEFAULT_ROLES];

      if (parts.length === 0) {
        return pack(
          [],
          [
            {
              id: 'user.add.template',
              kind: 'subcommand',
              label: getMultiStepPrompt('user add', 0, 'Enter username, then email and role.'),
              value: 'user add ',
            },
          ]
        );
      }

      if (parts.length === 1) {
        const login = parts[0];
        return pack(
          [],
          [
            {
              id: 'user.add.need-email',
              kind: 'subcommand',
              label: `${login} — ${getMultiStepPrompt('user add', 1, 'now add email, then role.')}`,
              value: `user add ${login} `,
            },
          ]
        );
      }

      if (parts.length === 2) {
        const [login, email] = parts;
        if (!isCompleteEmailToken(email)) {
          return pack(
            [],
            [
              {
                id: 'user.add.need-complete-email',
                kind: 'subcommand',
                label: `${login} — finish email, then ${getMultiStepPrompt('user add', 2, 'choose a role.').toLowerCase()}`,
                value: `user add ${login} ${email}`,
              },
            ]
          );
        }
        return pack(
          [],
          roleKeys.map<Suggestion>((r) => ({
            id: `user.add.role.${r}`,
            kind: 'subcommand',
            label: `${r} — ${getMultiStepPrompt('user add', 2, 'Choose a role.')}`,
            value: `user add ${login} ${email} ${r}`,
          }))
        );
      }

      const [login, email, ...roleParts] = parts;
      const roleQuery = roleParts.join(' ');
      const rfuse = new Fuse(
        roleKeys.map((name) => ({ name })),
        { keys: ['name'], threshold: 0.35, ignoreLocation: true }
      );
      const rhits = roleQuery
        ? rfuse.search(roleQuery).slice(0, 10).map((r) => r.item.name)
        : roleKeys.slice(0, 12);
      const roles = rhits.length
        ? rhits
        : roleKeys.filter((r) => r.startsWith(roleQuery.toLowerCase())).slice(0, 10);
      return pack(
        [],
        roles.map<Suggestion>((r) => ({
          id: `user.add.role.${r}`,
          kind: 'subcommand',
          label: `${r} — ${getMultiStepPrompt('user add', 2, 'Choose a role.')}`,
          value: `user add ${login} ${email} ${r}`,
        }))
      );
    }

    const t2 = rt[2] || '';
    if (t1 === 'role' && t2 === 'set') {
      const tailM = rawLower.match(/^.*?user\s+role\s+set\s*(.*)$/i);
      const rest = (tailM && tailM[1] != null ? String(tailM[1]) : '').trim();
      const list = indices.users || [];

      if (!rest) {
        return pack(
          [],
          searchEntities({
            query: '',
            items: list.slice(0, 200),
            adapter: {
              ...userAdapter,
              getValue: (u) => `user role set ${u.email} `,
              toSuggestion: (u) => ({
                id: `user.role.${u.id}`,
                kind: 'entity',
                entityType: 'user',
                label: `${u.email}${u.displayName ? ` — ${u.displayName}` : ''}`,
                value: `user role set ${u.email} `,
              }),
            },
            limit: 10,
          })
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

      return pack(
        [],
        searchEntities({
          query: rest,
          items: list,
          adapter: {
            ...userAdapter,
            getValue: (u) => `user role set ${u.email} `,
            toSuggestion: (u) => ({
              id: `user.role.${u.id}`,
              kind: 'entity',
              entityType: 'user',
              label: `${u.email}${u.displayName ? ` — ${u.displayName}` : ''}`,
              value: `user role set ${u.email} `,
            }),
          },
          limit: 10,
        })
      );
    }

    const subsUnknown = filterSubsForRoot('user', normalized);
    const subRowUnknown = subsUnknown.length ? subsUnknown : SUBCOMMANDS_BY_ROOT.user.slice(0, 12);
    return pack([], subRowUnknown.slice(0, 12));
  }

  if (t0 === 'menu') {
    if (rt.length === 1) {
      const subsAll = SUBCOMMANDS_BY_ROOT.menu;
      const subs = filterSubsForRoot('menu', normalized);
      const subSuggestions = subs.length ? subs : subsAll;
      const commandRow = filterRoots(normalized);
      const subRow =
        parsed.hasTrailingSpace || (!parsed.hasTrailingSpace && t0 === 'menu')
          ? subSuggestions.slice(0, 12)
          : [];
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
      const matches = searchEntities({
        query,
        items: query ? list : list.slice(0, 200),
        adapter: {
          ...siteAdapter,
          getValue: (s) => `site switch ${s.domain}${s.path}`,
          toSuggestion: (s) => ({
            id: `site.${s.blogId}`,
            kind: 'entity',
            entityType: 'site',
            label: `${s.domain}${s.path}`,
            value: `site switch ${s.domain}${s.path}`,
          }),
        },
        limit: 10,
      });
      return pack([], matches);
    }

    return pack([], []);
  }

  if (t0 === 'edit') {
    if (rt.length === 1) {
      const subsAll = SUBCOMMANDS_BY_ROOT.edit || [];
      const subs = filterSubsForRoot('edit', normalized);
      const subSuggestions = subs.length ? subs : subsAll;
      const commandRow = filterRoots(normalized);
      const subRow =
        parsed.hasTrailingSpace || (!parsed.hasTrailingSpace && t0 === 'edit') ? subSuggestions.slice(0, 12) : [];
      return pack(parsed.hasTrailingSpace ? [] : commandRow, subRow);
    }

    const kind = t1 === 'post' ? 'post' : t1 === 'page' ? 'page' : 'any';
    const typedSub = t1 === 'post' ? 'post' : t1 === 'page' ? 'page' : 'p';
    const rest = rawLower.replace(/^edit\s+(p|post|page)\s*/i, '').trim();
    const list = indices.content || [];
    const results = searchEntities({
      query: rest,
      items: list,
      adapter: makeEditContentAdapter({ kind, typedSub }),
      limit: 10,
    });
    return pack([], results);
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
        return pack(
          [],
          searchEntities({
            query: rest,
            items: rest ? list : list.slice(0, 200),
            adapter: {
              ...configKeyAdapter,
              getValue: (row) => `config get ${row.id}`,
              toSuggestion: (row) => ({
                id: `cfg.get.${row.id}`,
                kind: 'entity',
                entityType: 'configKey',
                label: `${row.label} (${row.plugin})`,
                value: `config get ${row.id}`,
              }),
            },
            limit: 12,
            threshold: SUITE_CONFIG_KEY_FUSE_THRESHOLD,
            multiTokenAnd: true,
          })
        );
      }

      if (verb === 'set') {
        const fs = rest.indexOf(' ');
        let partialId = (fs === -1 ? rest : rest.slice(0, fs)).trim();
        let valuePart = fs === -1 ? '' : rest.slice(fs + 1).trim();

        // Only split "id" vs "value" on the first space when the first segment is an exact
        // catalog id. Otherwise `config set flux one` becomes id=`flux` value=`one` and entity
        // search never runs—multi-token input is a single search query (same idea as `config get`).
        if (fs !== -1 && partialId) {
          const firstIsKnownId = list.some((x) => String(x.id).toLowerCase() === partialId.toLowerCase());
          if (!firstIsKnownId) {
            partialId = rest.trim();
            valuePart = '';
          }
        }

        if (!valuePart) {
          const exact = list.find((x) => String(x.id).toLowerCase() === partialId.toLowerCase());
          if (exact && exact.type === 'bool') {
            return pack(
              [],
              (['true', 'false'] as const).map<Suggestion>((b) => ({
                id: `cfg.bool.${exact.id}.${b}`,
                kind: 'entity',
                entityType: 'configValue',
                label: b,
                value: `config set ${exact.id} ${b}`,
              }))
            );
          }
          if (exact && exact.type === 'enum' && Array.isArray(exact.choices) && exact.choices.length > 0) {
            return pack(
              [],
              exact.choices.map<Suggestion>((ch) => ({
                id: `cfg.enum.${exact.id}.${ch}`,
                kind: 'entity',
                entityType: 'configValue',
                label: String(ch),
                value: `config set ${exact.id} ${ch}`,
              }))
            );
          }
          return pack(
            [],
            searchEntities({
              query: partialId,
              items: partialId ? list : list.slice(0, 200),
              adapter: {
                ...configKeyAdapter,
                getValue: (row) => `config set ${row.id} `,
                toSuggestion: (row) => ({
                  id: `cfg.set.${row.id}`,
                  kind: 'entity',
                  entityType: 'configKey',
                  label: `${row.label} · ${row.type} (${row.plugin})`,
                  value: `config set ${row.id} `,
                }),
              },
              limit: 12,
              threshold: SUITE_CONFIG_KEY_FUSE_THRESHOLD,
              multiTokenAnd: true,
            })
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
                kind: 'entity',
                entityType: 'configValue',
                label: b,
                value: `config set ${def.id} ${b}`,
              }))
            );
          }
        }
        if (def && def.type === 'enum' && Array.isArray(def.choices) && def.choices.length > 0 && !/\s/.test(valuePart)) {
          const pv = valuePart.toLowerCase();
          const hints = def.choices.filter((ch) => String(ch).toLowerCase().startsWith(pv));
          if (hints.length) {
            return pack(
              [],
              hints.map<Suggestion>((ch) => ({
                id: `cfg.enum.${def.id}.${ch}`,
                kind: 'entity',
                entityType: 'configValue',
                label: String(ch),
                value: `config set ${def.id} ${ch}`,
              }))
            );
          }
        }
      }
    }

    // e.g. `config list`, `config li` — anything other than get/set entity flow.
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
    const dests = searchEntities({
      query,
      items: list,
      adapter: destinationAdapter,
      limit: 12,
    });
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
