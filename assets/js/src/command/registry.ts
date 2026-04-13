import type { Suggestion } from './types';

/**
 * Subcommands keyed by first route token (after alias canonicalization).
 * Multi-word roots (user lock, aggregate email, …) have no entries here.
 */
export const SUBCOMMANDS_BY_ROOT: Record<string, Suggestion[]> = {
  plugin: [
    { id: 'cmd.plugin.list', kind: 'subcommand', label: 'plugin list', value: 'plugin list' },
    { id: 'cmd.plugin.update', kind: 'subcommand', label: 'plugin update', value: 'plugin update ' },
    { id: 'cmd.plugin.update.all', kind: 'subcommand', label: 'plugin update all', value: 'plugin update all' },
    { id: 'cmd.plugin.activate', kind: 'subcommand', label: 'plugin activate', value: 'plugin activate ' },
    { id: 'cmd.plugin.deactivate', kind: 'subcommand', label: 'plugin deactivate', value: 'plugin deactivate ' },
    { id: 'cmd.plugin.delete', kind: 'subcommand', label: 'plugin delete', value: 'plugin delete ' },
    { id: 'cmd.plugin.upload', kind: 'subcommand', label: 'plugin upload', value: 'plugin upload' },
    { id: 'cmd.plugin.add', kind: 'subcommand', label: 'plugin add', value: 'plugin add' },
    { id: 'cmd.plugin.install', kind: 'subcommand', label: 'plugin install', value: 'plugin install' },
  ],
  user: [
    { id: 'cmd.user.list', kind: 'subcommand', label: 'user list', value: 'user list' },
    {
      id: 'cmd.user.add',
      kind: 'subcommand',
      label: 'user add',
      value: 'user add ',
      description: 'username, email, role (password emailed)',
    },
    {
      id: 'cmd.user.role.set',
      kind: 'subcommand',
      label: 'user role set',
      value: 'user role set ',
    },
  ],
  menu: [{ id: 'cmd.menu.list', kind: 'subcommand', label: 'menu list', value: 'menu list' }],
  site: [
    { id: 'cmd.site.list', kind: 'subcommand', label: 'site list', value: 'site list' },
    { id: 'cmd.site.switch', kind: 'subcommand', label: 'site switch', value: 'site switch ' },
  ],
  nav: [],
  config: [
    { id: 'cmd.config.list', kind: 'subcommand', label: 'config list', value: 'config list' },
    { id: 'cmd.config.search', kind: 'subcommand', label: 'config search', value: 'config search ' },
    { id: 'cmd.config.get', kind: 'subcommand', label: 'config get', value: 'config get ' },
    { id: 'cmd.config.set', kind: 'subcommand', label: 'config set', value: 'config set ' },
  ],
};

/**
 * Top-level commands only (no second-step rows like `plugin list`).
 */
export const ROOT_COMMANDS: Suggestion[] = [
  { id: 'cmd.plugin', kind: 'command', label: 'plugin', value: 'plugin ' },
  { id: 'cmd.user', kind: 'command', label: 'user', value: 'user ' },
  { id: 'cmd.user.lock', kind: 'command', label: 'user lock', value: 'user lock ' },
  { id: 'cmd.user.unlock', kind: 'command', label: 'user unlock', value: 'user unlock ' },
  {
    id: 'cmd.user.add.root',
    kind: 'command',
    label: 'user add',
    value: 'user add ',
    description: 'Create user: username email role (password generated)',
  },
  {
    id: 'cmd.user.role.set.root',
    kind: 'command',
    label: 'user role set',
    value: 'user role set ',
    description: 'Set a user role (email then role slug)',
  },
  {
    id: 'cmd.role.set.alias',
    kind: 'command',
    label: 'role set',
    value: 'user role set ',
    description: 'Alias for user role set',
  },
  { id: 'cmd.menu', kind: 'command', label: 'menu', value: 'menu ' },
  { id: 'cmd.site', kind: 'command', label: 'site', value: 'site ' },
  { id: 'cmd.nav', kind: 'command', label: 'nav', value: 'nav ' },
  {
    id: 'cmd.config',
    kind: 'command',
    label: 'config',
    value: 'config ',
    description: 'Flux suite settings (active plugins only)',
  },
  { id: 'cmd.aggregate.email', kind: 'command', label: 'aggregate email', value: 'aggregate email' },
  { id: 'cmd.summary.email', kind: 'command', label: 'summary email', value: 'summary email' },
];

/** Full list for ghost, previews, and modules that still expect a flat registry. */
export const COMMANDS: Suggestion[] = [
  ...ROOT_COMMANDS,
  ...SUBCOMMANDS_BY_ROOT.plugin,
  ...SUBCOMMANDS_BY_ROOT.user,
  ...SUBCOMMANDS_BY_ROOT.menu,
  ...SUBCOMMANDS_BY_ROOT.site,
  ...SUBCOMMANDS_BY_ROOT.config,
];
