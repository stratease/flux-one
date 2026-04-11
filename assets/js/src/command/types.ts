export type CommandMode = 'standard' | 'summary';

export type Token = string;

export type SuggestionKind = 'command' | 'subcommand' | 'entity';

export type EntityType = 'plugin' | 'user' | 'menu' | 'site' | 'destination';

export type Suggestion = {
  id: string;
  kind: SuggestionKind;
  label: string;
  value: string; // the full input value to place in the textbox
  description?: string;
  entityType?: EntityType;
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

