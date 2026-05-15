/**
 * In-app command reference (keep in sync with registry + CommandRouter).
 *
 * @see ./registry.ts
 */

export type CommandDocBackend = 'none' | 'command' | 'command+get' | 'command+post';

export type CommandDocRow = {
  canonical: string;
  kind: 'root' | 'sub';
  /** One-line: what happens from the user’s perspective. */
  summary: string;
  /** Optional: HTTP, permissions, side effects, client-only paths. */
  details?: string;
  backend: CommandDocBackend;
  aliases?: string[];
};

export const COMMAND_DOCS: CommandDocRow[] = [
  {
    canonical: 'plugin',
    kind: 'root',
    summary: 'Manage plugins (list, update, activate, deactivate, delete, upload).',
    details: 'Type a subcommand (or pick one from suggestions).',
    backend: 'none',
  },
  {
    canonical: 'plugin list',
    kind: 'sub',
    summary: 'Show all installed plugins.',
    details: 'Includes active state and update availability.',
    backend: 'none',
  },
  {
    canonical: 'plugin update',
    kind: 'sub',
    summary: 'Update one plugin.',
    details: 'Type part of plugin name, then pick the plugin.',
    backend: 'command',
  },
  {
    canonical: 'plugin update all',
    kind: 'sub',
    summary: 'Update all plugins with updates available.',
    backend: 'command',
  },
  {
    canonical: 'plugin activate',
    kind: 'sub',
    summary: 'Activate one plugin.',
    backend: 'command',
  },
  {
    canonical: 'plugin deactivate',
    kind: 'sub',
    summary: 'Deactivate one plugin.',
    backend: 'command',
  },
  {
    canonical: 'plugin delete',
    kind: 'sub',
    summary: 'Delete one inactive plugin.',
    details: 'Plugin must be inactive first.',
    backend: 'command',
  },
  {
    canonical: 'plugin upload',
    kind: 'sub',
    summary: 'Open WordPress plugin upload screen (zip).',
    backend: 'command',
    aliases: ['plugin install'],
  },
  {
    canonical: 'plugin install',
    kind: 'sub',
    summary: 'Alias for `plugin upload`.',
    backend: 'command',
  },

  {
    canonical: 'user',
    kind: 'root',
    summary: 'Manage users (list, add, lock/unlock, role set).',
    details: 'Type a subcommand (or pick one from suggestions).',
    backend: 'none',
  },
  {
    canonical: 'user list',
    kind: 'sub',
    summary: 'Show users (email + display name).',
    backend: 'none',
  },
  {
    canonical: 'user add',
    kind: 'sub',
    summary: 'Create a new user.',
    details: 'Guided flow: username → email → role.',
    backend: 'command',
  },
  {
    canonical: 'user lock',
    kind: 'sub',
    summary: 'Lock a user account (prevents login).',
    details: 'Type an email, or pick a user from suggestions.',
    backend: 'command',
    aliases: ['lock user'],
  },
  {
    canonical: 'user unlock',
    kind: 'sub',
    summary: 'Unlock a user account.',
    details: 'Type an email, or pick a user from suggestions.',
    backend: 'command',
    aliases: ['unlock user'],
  },
  {
    canonical: 'user role set',
    kind: 'sub',
    summary: 'Set a user role.',
    details: 'Type email, then choose role.',
    backend: 'command',
    aliases: ['role set'],
  },

  {
    canonical: 'menu',
    kind: 'root',
    summary: 'Manage navigation menus.',
    backend: 'none',
  },
  {
    canonical: 'menu list',
    kind: 'sub',
    summary: 'Open menu manager to edit order and hierarchy.',
    details: 'Pick menu, move items (Up/Down/Nest/Unnest), then Save order.',
    backend: 'none',
    aliases: ['menu show'],
  },

  {
    canonical: 'config',
    kind: 'root',
    summary: 'View and change Flux Suite settings.',
    details: 'Use `config list` to browse, or `config get` / `config set` for a specific key.',
    backend: 'command',
  },
  {
    canonical: 'config list',
    kind: 'sub',
    summary: 'Show configuration table with inline controls.',
    backend: 'command',
  },
  {
    canonical: 'config get',
    kind: 'sub',
    summary: 'Show one setting value.',
    details: 'Type: `config get {id}`.',
    backend: 'command',
  },
  {
    canonical: 'config set',
    kind: 'sub',
    summary: 'Update one setting.',
    details: 'Type: `config set {id} {value}`.',
    backend: 'command',
  },

  {
    canonical: 'edit',
    kind: 'root',
    summary: 'Find and open editor for a post or page.',
    details: 'Starts searching as you type.',
    backend: 'none',
  },
  {
    canonical: 'edit p',
    kind: 'sub',
    summary: 'Search posts + pages.',
    backend: 'none',
  },
  {
    canonical: 'edit post',
    kind: 'sub',
    summary: 'Search posts only.',
    backend: 'none',
  },
  {
    canonical: 'edit page',
    kind: 'sub',
    summary: 'Search pages only.',
    backend: 'none',
  },

  {
    canonical: 'pnav',
    kind: 'root',
    summary: 'Open public view of a post or page (search title/slug).',
    details: 'Uses the same index as `edit`; navigates to permalink or preview URL.',
    backend: 'none',
  },
  {
    canonical: 'pnav p',
    kind: 'sub',
    summary: 'Search posts + pages; open public view.',
    backend: 'none',
  },
  {
    canonical: 'pnav post',
    kind: 'sub',
    summary: 'Search posts only; open public view.',
    backend: 'none',
  },
  {
    canonical: 'pnav page',
    kind: 'sub',
    summary: 'Search pages only; open public view.',
    backend: 'none',
  },

  {
    canonical: 'nav',
    kind: 'root',
    summary: 'Go to a wp-admin page.',
    details: 'Type a destination name (or pick from suggestions).',
    backend: 'none',
    aliases: ['go', 'open'],
  },
  {
    canonical: 'aggregate email',
    kind: 'root',
    summary: 'Review captured emails in a modal (search, paging, days).',
    details: 'Shows cached summaries when available.',
    backend: 'command+get',
  },
  {
    canonical: 'summary email',
    kind: 'root',
    summary: 'Summarize emails with AI for current page (license required).',
    details: 'Runs summaries for up to 25 emails on the visible page.',
    backend: 'command+post',
  },
];

export function filterCommandDocs(query: string): CommandDocRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return COMMAND_DOCS;
  return COMMAND_DOCS.filter((row) => {
    const hay = [
      row.canonical,
      row.summary,
      row.details || '',
      ...(row.aliases || []),
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}
