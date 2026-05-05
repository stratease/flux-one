export type CommandMode = 'standard' | 'summary';

export type Token = string;

export type SuggestionKind = 'command' | 'subcommand' | 'entity';

export type EntityType =
  | 'plugin'
  | 'user'
  | 'menu'
  | 'site'
  | 'destination'
  | 'content'
  | 'configKey'
  | 'configValue';

export type ClientNavAction = 'nav';

export type Suggestion = {
  id: string;
  kind: SuggestionKind;
  label: string;
  /** Optional display label for UI (e.g. breadcrumb). */
  displayLabel?: string;
  /** Hierarchy path labels from root -> leaf (when entity supports hierarchy). */
  pathLabels?: string[];
  value: string; // the full input value to place in the textbox
  description?: string;
  /** Extra Fuse terms for root search (not shown as a duplicate row). */
  searchText?: string;
  entityType?: EntityType;
  /** When set with `navUrl`, Command Bar redirects in the browser without POST /command. */
  clientAction?: ClientNavAction;
  navUrl?: string;
};

export type ParsedInput = {
  raw: string;
  normalized: string;
  mode: CommandMode;
  tokens: Token[];
  hasTrailingSpace: boolean;
};

export type CanonicalizationResult = {
  canonical: string;
  tokens: Token[];
  changed: boolean;
};

