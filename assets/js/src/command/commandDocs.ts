/**
 * In-app command reference (keep in sync with registry + CommandRouter).
 *
 * @see ./registry.ts
 */

export type CommandDocBackend = 'none' | 'command' | 'command+get';

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
    summary: 'Prefix for plugin subcommands (list, update, activate, deactivate, delete, upload, add, install).',
    details: 'Does nothing by itself; choose a subcommand from suggestions or type one.',
    backend: 'none',
  },
  {
    canonical: 'plugin list',
    kind: 'sub',
    summary: 'Shows every installed plugin in the widget panel.',
    details:
      'Client uses TanStack Query for the plugins index when available (no POST). Otherwise the same data is loaded via the command API.',
    backend: 'none',
  },
  {
    canonical: 'plugin update',
    kind: 'sub',
    summary: 'Runs WordPress plugin updates for one plugin (by display name).',
    details: 'POST /command → PluginsHandler → wp_update_plugins / upgrade APIs. Requires install_plugins.',
    backend: 'command',
  },
  {
    canonical: 'plugin update all',
    kind: 'sub',
    summary: 'Updates every plugin that has an update available.',
    details: 'POST /command. Same permission model as single update.',
    backend: 'command',
  },
  {
    canonical: 'plugin activate',
    kind: 'sub',
    summary: 'Activates one plugin by name.',
    details: 'POST /command → activate_plugin(). Requires activate_plugins.',
    backend: 'command',
  },
  {
    canonical: 'plugin deactivate',
    kind: 'sub',
    summary: 'Deactivates one plugin by name.',
    details: 'POST /command → deactivate_plugins(). Requires activate_plugins.',
    backend: 'command',
  },
  {
    canonical: 'plugin delete',
    kind: 'sub',
    summary: 'Deletes one inactive plugin by name.',
    details: 'POST /command. Plugin must be inactive. Requires delete_plugins.',
    backend: 'command',
  },
  {
    canonical: 'plugin upload',
    kind: 'sub',
    summary: 'Opens WordPress “Upload Plugin” (zip) in the admin.',
    details:
      'Navigation alias: plugin upload → nav add plugin (client redirect to core upload tab). Requires install_plugins.',
    backend: 'command',
    aliases: ['plugin install'],
  },
  {
    canonical: 'plugin install',
    kind: 'sub',
    summary: 'Alias for plugin upload (zip upload tab).',
    details: 'Same as plugin upload.',
    backend: 'command',
  },

  {
    canonical: 'user',
    kind: 'root',
    summary: 'Prefix for user listing, add, lock/unlock, role changes, or opening a user by email.',
    details: 'Does nothing by itself without a subcommand or email.',
    backend: 'none',
  },
  {
    canonical: 'user list',
    kind: 'sub',
    summary: 'Lists users (email, display name) in the widget panel.',
    details: 'Client fast path from TanStack-cached users index when possible; otherwise POST returns the same panel payload.',
    backend: 'none',
  },
  {
    canonical: 'user <email>',
    kind: 'sub',
    summary: 'Opens a small user detail panel for that email.',
    details: 'POST /command when not served from cache. Requires list_users–level access for meaningful data.',
    backend: 'command',
  },
  {
    canonical: 'user add',
    kind: 'sub',
    summary: 'Creates a user with username, email, and role (no password prompt).',
    details:
      'POST /command → wp_insert_user with generated password; wp_send_new_user_notifications when available. Requires create_users. Role must be one of your editable roles (from bootstrap). Form: user add {login} {email} {role}.',
    backend: 'command',
  },
  {
    canonical: 'user lock',
    kind: 'sub',
    summary: 'Sets a Flux One lock flag on the account so they cannot log in.',
    details: 'POST /command → user meta. Alias: lock user <email>.',
    backend: 'command',
    aliases: ['lock user'],
  },
  {
    canonical: 'user unlock',
    kind: 'sub',
    summary: 'Clears the Flux One lock so the user can authenticate again.',
    details: 'POST /command. Alias: unlock user <email>.',
    backend: 'command',
    aliases: ['unlock user'],
  },
  {
    canonical: 'user role set',
    kind: 'sub',
    summary: 'Sets the user’s single role to a role slug (e.g. editor, administrator).',
    details:
      'POST /command → WP_User::set_role(). Requires promote_users. Canonical form: user role set <email> <role>. Alias: role set <email> <role> (rewritten server-side).',
    backend: 'command',
    aliases: ['role set'],
  },

  {
    canonical: 'menu',
    kind: 'root',
    summary: 'Prefix for menu operations.',
    backend: 'none',
  },
  {
    canonical: 'menu list',
    kind: 'sub',
    summary: 'Lists registered nav menus in the widget.',
    details: 'Client fast path from cached menus index when possible.',
    backend: 'none',
  },
  {
    canonical: 'menu show',
    kind: 'sub',
    summary: 'Resolves a menu by name and opens it in the WordPress menu editor.',
    details: 'Uses cached menus index for suggestions and client-side redirect when unambiguous.',
    backend: 'none',
  },

  {
    canonical: 'site',
    kind: 'root',
    summary: 'Multisite: list blogs or switch the active site context.',
    details: 'Only relevant when multisite is enabled.',
    backend: 'none',
  },
  {
    canonical: 'site list',
    kind: 'sub',
    summary: 'Lists sites (domain + path) in the widget.',
    details: 'Client fast path from cached sites index when possible.',
    backend: 'none',
  },
  {
    canonical: 'site switch',
    kind: 'sub',
    summary: 'Switches the admin session to another site in the network.',
    details: 'POST /command → switch_to_blog / cookie context. Requires super admin or equivalent.',
    backend: 'command',
  },

  {
    canonical: 'config',
    kind: 'root',
    summary: 'Lists or changes Flux suite settings for plugins that are currently active.',
    details:
      'POST /command with original input (not lowercased) so API keys keep case. Use `config list` or `config search {query}` for a table; `config get {id}`; `config set {id} {value}` (booleans: true/false/on/off; enums as documented in the list). Definitions: SuiteConfigCatalog + filter flux_one_suite_config_definitions.',
    backend: 'command',
  },
  {
    canonical: 'config list',
    kind: 'sub',
    summary: 'Table of available config keys, current values (secrets masked), plugin, and type.',
    details: 'Only includes settings for active Flux suite plugins.',
    backend: 'command',
  },
  {
    canonical: 'config get',
    kind: 'sub',
    summary: 'Prints one setting: `config get {id}`.',
    backend: 'command',
  },
  {
    canonical: 'config set',
    kind: 'sub',
    summary: 'Updates one setting: `config set {id} {value}`.',
    details: 'Value is taken from the raw command after the id (spaces allowed for secrets).',
    backend: 'command',
  },

  {
    canonical: 'edit',
    kind: 'root',
    summary: 'Edit a post or page by searching title/slug.',
    details: 'Client-only navigation; search runs as you type (XHR) and results link directly to edit screens.',
    backend: 'none',
  },
  {
    canonical: 'edit p',
    kind: 'sub',
    summary: 'Search posts + pages by title/slug and open the editor for the selected item.',
    details: 'XHR search while typing. Results are labeled as Post/Page.',
    backend: 'none',
  },
  {
    canonical: 'edit post',
    kind: 'sub',
    summary: 'Search posts by title/slug and open the editor.',
    details: 'XHR search while typing.',
    backend: 'none',
  },
  {
    canonical: 'edit page',
    kind: 'sub',
    summary: 'Search pages by title/slug and open the editor.',
    details: 'XHR search while typing.',
    backend: 'none',
  },
  {
    canonical: 'nav',
    kind: 'root',
    summary: 'Navigates the browser to a known wp-admin URL (no command POST when resolved).',
    details:
      'Matches against a preloaded destinations index. Aliases: go, open. Recent destinations may be recorded.',
    backend: 'none',
    aliases: ['go', 'open'],
  },
  {
    canonical: 'aggregate email',
    kind: 'root',
    summary: 'Opens a modal showing all captured emails (full context) for the last 7 days.',
    details:
      'POST /command returns panel id aggregate_email; client opens a modal and loads aggregate JSON. Body display prefers HTML (iframe) when available; falls back to raw body text; headers are hidden in this view.',
    backend: 'command+get',
  },
  {
    canonical: 'summary email',
    kind: 'root',
    summary: 'Opens the aggregate panel and requests an AI summary when the feature is enabled.',
    details: 'POST /command with aiRequested; backend may call out to the summarization service.',
    backend: 'command',
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
