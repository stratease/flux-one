import type { Suggestion } from './types';

/**
 * Canonical command registry (v1).
 *
 * This is the source of truth for:
 * - autocomplete
 * - ghost typehint
 * - preview routing
 * - canonical command strings (history should store canonical only)
 */
export const COMMANDS: Suggestion[] = [
  { id: 'cmd.plugins', kind: 'command', label: 'plugins', value: 'plugins' },
  { id: 'cmd.plugins.update', kind: 'subcommand', label: 'plugins update {plugin}', value: 'plugins update ' },
  { id: 'cmd.plugins.update.all', kind: 'subcommand', label: 'plugins update all', value: 'plugins update all' },

  { id: 'cmd.plugin', kind: 'command', label: 'plugin', value: 'plugin ' },
  { id: 'cmd.plugin.update', kind: 'subcommand', label: 'plugin update', value: 'plugin update ' },
  { id: 'cmd.plugin.update.all', kind: 'subcommand', label: 'plugin update all', value: 'plugin update all' },
  { id: 'cmd.plugin.activate', kind: 'subcommand', label: 'plugin activate {plugin}', value: 'plugin activate ' },
  { id: 'cmd.plugin.deactivate', kind: 'subcommand', label: 'plugin deactivate {plugin}', value: 'plugin deactivate ' },
  { id: 'cmd.plugin.delete', kind: 'subcommand', label: 'plugin delete {plugin}', value: 'plugin delete ' },
  { id: 'cmd.plugin.install', kind: 'subcommand', label: 'plugin install {name}', value: 'plugin install ' },

  { id: 'cmd.users', kind: 'command', label: 'users', value: 'users' },
  { id: 'cmd.user', kind: 'command', label: 'user {email}', value: 'user ' },
  { id: 'cmd.lock.user', kind: 'command', label: 'lock user {email}', value: 'lock user ' },
  { id: 'cmd.unlock.user', kind: 'command', label: 'unlock user {email}', value: 'unlock user ' },
  { id: 'cmd.role.set', kind: 'command', label: 'role set {email} {role}', value: 'role set ' },

  { id: 'cmd.menus', kind: 'command', label: 'menus', value: 'menus' },
  { id: 'cmd.menu', kind: 'command', label: 'menu {name}', value: 'menu ' },

  { id: 'cmd.sites', kind: 'command', label: 'sites', value: 'sites' },
  { id: 'cmd.site', kind: 'command', label: 'site {name}', value: 'site ' },
  { id: 'cmd.site.switch', kind: 'subcommand', label: 'site switch {name}', value: 'site switch ' },

  { id: 'cmd.aggregate.email', kind: 'command', label: 'aggregate email', value: 'aggregate email' },
  { id: 'cmd.summary.email', kind: 'command', label: 'summary email', value: 'summary email' },

  { id: 'cmd.nav', kind: 'command', label: 'nav {destination}', value: 'nav ' },
  { id: 'cmd.go', kind: 'command', label: 'go {destination}', value: 'go ' },
  { id: 'cmd.open', kind: 'command', label: 'open {entity}', value: 'open ' },
];

