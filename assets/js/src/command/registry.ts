import type { Suggestion } from './types';

export type MultiStepFieldKind = 'text' | 'email' | 'entity' | 'enum';

export type MultiStepCommandField = {
  field: string;
  kind: MultiStepFieldKind;
  prompt: string;
  source?: 'roles' | 'users' | 'plugins' | 'sites' | 'menus' | 'destinations' | 'configKeys';
};

export type MultiStepCommandDefinition = {
  id: string;
  canonical: string;
  type: 'multistep';
  steps: MultiStepCommandField[];
};

export const MULTISTEP_COMMANDS: Record<string, MultiStepCommandDefinition> = {
  'user add': {
    id: 'cmd.user.add',
    canonical: 'user add',
    type: 'multistep',
    steps: [
      { field: 'login', kind: 'text', prompt: 'Enter username, then email and role.' },
      { field: 'email', kind: 'email', prompt: 'Now add email, then role.' },
      { field: 'role', kind: 'entity', source: 'roles', prompt: 'Choose a role.' },
    ],
  },
};

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
  ],
  user: [
    { id: 'cmd.user.list', kind: 'subcommand', label: 'user list', value: 'user list' },
    { id: 'cmd.user.lock', kind: 'subcommand', label: 'user lock', value: 'user lock ' },
    { id: 'cmd.user.unlock', kind: 'subcommand', label: 'user unlock', value: 'user unlock ' },
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
      description: 'Alias typed as role set … is canonicalized to this command',
    },
  ],
  menu: [
    { id: 'cmd.menu.list', kind: 'subcommand', label: 'menu list', value: 'menu list' },
    { id: 'cmd.menu.show', kind: 'subcommand', label: 'menu show', value: 'menu show' },
  ],
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
  edit: [
    { id: 'cmd.edit.p', kind: 'subcommand', label: 'edit p', value: 'edit p ' , description: 'Edit a post or page (search as you type)' },
    { id: 'cmd.edit.post', kind: 'subcommand', label: 'edit post', value: 'edit post ', description: 'Edit a post (search as you type)' },
    { id: 'cmd.edit.page', kind: 'subcommand', label: 'edit page', value: 'edit page ', description: 'Edit a page (search as you type)' },
  ],
};

/**
 * Top-level commands only (no second-step rows like `plugin list`).
 */
export const ROOT_COMMANDS: Suggestion[] = [
  { id: 'cmd.plugin', kind: 'command', label: 'plugin', value: 'plugin ' },
  {
    id: 'cmd.user',
    kind: 'command',
    label: 'user',
    value: 'user ',
    description: 'List, add, lock, unlock, role set, or pick a user by email',
    searchText: 'role set lock unlock add list',
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
  {
    id: 'cmd.edit',
    kind: 'command',
    label: 'edit',
    value: 'edit ',
    description: 'Edit a post or page by searching title/slug',
    searchText: 'post page p',
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
  ...SUBCOMMANDS_BY_ROOT.edit,
];
