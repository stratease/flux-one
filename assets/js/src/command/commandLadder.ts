import type { IndexData } from './suggest';
import { resolveNavDestinationUrl } from './suggest';
import { SUBCOMMANDS_BY_ROOT } from './registry';
import Fuse from 'fuse.js';

/** Commands that are complete with no entity (exact canonical match). */
const TERMINAL_EXACT = new Set([
  'plugin list',
  'plugin show',
  'user list',
  'user show',
  'menu list',
  'site list',
  'site show',
  'plugin update all',
  'plugin upload',
  'plugin install',
  'aggregate email',
  'summary email',
  'config list',
]);

function normalizeCanonical(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Single email token after lock/unlock; runnable without waiting for a unique Fuse hit on the users index. */
function isCompleteEmailQuery(s: string): boolean {
  return /^[^\s@]+@[^\s@]+$/.test((s || '').trim());
}

/**
 * When the user typed `plugin li` or `site sw`, expand to the single matching subcommand value if unambiguous.
 */
function expandUniqueSubcommandToken(root: string, partial: string): string | null {
  const subs = SUBCOMMANDS_BY_ROOT[root];
  if (!subs?.length || !partial) {
    return null;
  }
  const p = partial.toLowerCase();
  const matches = subs.filter((s) => {
    const tail = s.value
      .trim()
      .toLowerCase()
      .replace(new RegExp(`^${String(root)}\\s+`), '');
    const first = tail.split(/\s+/)[0] || '';
    return first.startsWith(p);
  });
  if (matches.length !== 1) {
    return null;
  }
  return matches[0].value.trim();
}

/**
 * If the canonical command is runnable as-is or can be expanded to a unique entity, returns the command to execute.
 */
export function resolveRunnableCommand(canonical: string, indices: IndexData): { ok: boolean; command?: string } {
  const c = normalizeCanonical(canonical);
  if (!c) return { ok: false };

  const pluginTok = /^plugin\s+(\S+)$/.exec(c);
  if (pluginTok) {
    const expanded = expandUniqueSubcommandToken('plugin', pluginTok[1]);
    if (expanded && normalizeCanonical(expanded) !== c) {
      return resolveRunnableCommand(expanded, indices);
    }
  }

  const siteTok = /^site\s+(\S+)$/.exec(c);
  if (siteTok) {
    const expanded = expandUniqueSubcommandToken('site', siteTok[1]);
    if (expanded && normalizeCanonical(expanded) !== c) {
      return resolveRunnableCommand(expanded, indices);
    }
  }

  const userTok = /^user\s+(\S+)$/.exec(c);
  if (
    userTok &&
    userTok[1].toLowerCase() !== 'lock' &&
    userTok[1].toLowerCase() !== 'unlock' &&
    userTok[1].toLowerCase() !== 'role' &&
    userTok[1].toLowerCase() !== 'add'
  ) {
    const expanded = expandUniqueSubcommandToken('user', userTok[1]);
    if (expanded && normalizeCanonical(expanded) !== c) {
      return resolveRunnableCommand(expanded, indices);
    }
  }

  const menuTok = /^menu\s+(\S+)$/.exec(c);
  if (menuTok) {
    const expanded = expandUniqueSubcommandToken('menu', menuTok[1]);
    if (expanded && normalizeCanonical(expanded) !== c) {
      return resolveRunnableCommand(expanded, indices);
    }
  }

  const configTok = /^config\s+(\S+)$/.exec(c);
  if (configTok) {
    const expanded = expandUniqueSubcommandToken('config', configTok[1]);
    if (expanded && normalizeCanonical(expanded) !== c) {
      return resolveRunnableCommand(expanded, indices);
    }
  }

  if (TERMINAL_EXACT.has(c)) {
    return { ok: true, command: c };
  }

  if (c.startsWith('nav ')) {
    const rest = c.slice(4).trim();
    const url = resolveNavDestinationUrl(rest, indices.destinations);
    if (url) {
      return { ok: true, command: c };
    }
    return { ok: false };
  }

  const plugins = indices.plugins || [];
  const users = indices.users || [];
  const sites = indices.sites || [];

  const mUpdate = /^plugin update (.+)$/.exec(c);
  if (mUpdate) {
    const q = mUpdate[1].trim();
    if (!q || q === 'all') return { ok: false };
    const fuse = new Fuse(plugins, { keys: ['name', 'pluginFile'], threshold: 0.35, ignoreLocation: true });
    const r = fuse.search(q);
    if (r.length === 1) {
      return { ok: true, command: `plugin update ${r[0].item.name}` };
    }
    return { ok: false };
  }

  for (const verb of ['activate', 'deactivate', 'delete'] as const) {
    const re = new RegExp(`^plugin ${verb} (.+)$`);
    const m = re.exec(c);
    if (m) {
      const q = m[1].trim();
      if (!q) return { ok: false };
      const fuse = new Fuse(plugins, { keys: ['name', 'pluginFile'], threshold: 0.35, ignoreLocation: true });
      const r = fuse.search(q);
      if (r.length === 1) {
        return { ok: true, command: `plugin ${verb} ${r[0].item.name}` };
      }
      return { ok: false };
    }
  }

  const mLock = /^user lock (.+)$/.exec(c);
  if (mLock) {
    const q = mLock[1].trim();
    if (!q) return { ok: false };
    const self = indices.currentUser;
    if (isCompleteEmailQuery(q)) {
      const em = self?.email?.trim().toLowerCase();
      if (em && q.trim().toLowerCase() === em) {
        return { ok: false };
      }
      return { ok: true, command: `user lock ${q.trim()}` };
    }
    const lockUsers = users.filter((u) => (self?.id == null ? true : u.id !== self.id));
    const fuse = new Fuse(lockUsers, { keys: ['email', 'displayName', 'login'], threshold: 0.35, ignoreLocation: true });
    const r = fuse.search(q);
    if (r.length === 1) {
      return { ok: true, command: `user lock ${r[0].item.email}` };
    }
    return { ok: false };
  }

  const mUnlock = /^user unlock (.+)$/.exec(c);
  if (mUnlock) {
    const q = mUnlock[1].trim();
    if (!q) return { ok: false };
    if (isCompleteEmailQuery(q)) {
      return { ok: true, command: `user unlock ${q.trim()}` };
    }
    const fuse = new Fuse(users, { keys: ['email', 'displayName', 'login'], threshold: 0.35, ignoreLocation: true });
    const r = fuse.search(q);
    if (r.length === 1) {
      return { ok: true, command: `user unlock ${r[0].item.email}` };
    }
    return { ok: false };
  }

  const mAdd = /^user add (\S+)\s+(\S+@\S+)\s+(\S+)$/.exec(c);
  if (mAdd) {
    const email = mAdd[2] || '';
    if (!/^[^\s@]+@[^\s@]+$/.test(email)) {
      return { ok: false };
    }
    return { ok: true, command: c };
  }

  const mSwitch = /^site switch (.+)$/.exec(c);
  if (mSwitch) {
    const q = mSwitch[1].trim();
    if (!q) return { ok: false };
    const fuse = new Fuse(sites, { keys: ['domain', 'path'], threshold: 0.35, ignoreLocation: true });
    const r = fuse.search(q);
    if (r.length === 1) {
      const s = r[0].item;
      return { ok: true, command: `site switch ${s.domain}${s.path}` };
    }
    return { ok: false };
  }

  const mRole = /^user role set (\S+@\S+)\s+(\S+)$/.exec(c);
  if (mRole && mRole[1].trim() && mRole[2].trim()) {
    return { ok: true, command: c };
  }

  const suiteCfg = indices.suiteConfig || [];
  const mCfgGet = /^config get (\S+)$/.exec(c);
  if (mCfgGet) {
    const q = mCfgGet[1].toLowerCase();
    const found = suiteCfg.find((x) => String(x.id).toLowerCase() === q);
    if (found) {
      return { ok: true, command: `config get ${found.id}` };
    }
  }

  const mCfgSet = /^config set (\S+)\s+(.+)$/.exec(c);
  if (mCfgSet) {
    const q = mCfgSet[1].toLowerCase();
    const val = mCfgSet[2].trim();
    if (!val) {
      return { ok: false };
    }
    const found = suiteCfg.find((x) => String(x.id).toLowerCase() === q);
    if (found) {
      return { ok: true, command: `config set ${found.id} ${val}` };
    }
  }

  return { ok: false };
}
