import type { CanonicalizationResult, ParsedInput, Token } from './types';

export function parseInput(raw: string): ParsedInput {
  const hasTrailingSpace = /\s$/.test(raw);
  const normalized = raw.toLowerCase().trim().replace(/\s+/g, ' ');
  const tokens = normalized ? normalized.split(' ') : [];

  let mode: ParsedInput['mode'] = 'standard';
  let modeTokens = tokens;
  if (tokens[0] === 'summary') {
    mode = 'summary';
    modeTokens = tokens.slice(1);
  }

  return {
    raw,
    normalized,
    mode,
    tokens: modeTokens,
    hasTrailingSpace,
  };
}

/**
 * Canonicalize alias token orders to match server CommandRouter rules.
 * This must align with `app/Services/CommandRouter.php`.
 */
export function canonicalizeTokens(tokens: Token[]): Token[] {
  // "user lock X" => "lock user X"
  if (tokens[0] === 'user' && tokens[1] === 'lock') return ['lock', 'user', ...tokens.slice(2)];
  if (tokens[0] === 'users' && tokens[1] === 'lock') return ['lock', 'user', ...tokens.slice(2)];
  if (tokens[0] === 'user' && tokens[1] === 'unlock') return ['unlock', 'user', ...tokens.slice(2)];
  if (tokens[0] === 'users' && tokens[1] === 'unlock') return ['unlock', 'user', ...tokens.slice(2)];

  // "email aggregate" => "aggregate email"
  if (tokens[0] === 'email' && tokens[1] === 'aggregate') return ['aggregate', 'email', ...tokens.slice(2)];
  if (tokens[0] === 'emails' && tokens[1] === 'aggregate') return ['aggregate', 'email', ...tokens.slice(2)];

  // "email summary" => "summary email" (represented as tokens for standard mode)
  if (tokens[0] === 'email' && tokens[1] === 'summary') return ['summary', 'email', ...tokens.slice(2)];

  // Treat "plugins update ..." as alias for "plugin update ...".
  if (tokens[0] === 'plugins' && tokens[1] === 'update') return ['plugin', 'update', ...tokens.slice(2)];

  return tokens;
}

export function canonicalizeInput(raw: string): CanonicalizationResult {
  const parsed = parseInput(raw);
  const reconstructedTokens = parsed.mode === 'summary' ? ['summary', ...parsed.tokens] : parsed.tokens;
  const aliasCanonical = canonicalizeTokens(reconstructedTokens);

  // If canonicalization produced "summary ..." token, keep it as prefix.
  const canonical = aliasCanonical.join(' ').trim();
  const changed = canonical !== raw.toLowerCase().trim().replace(/\s+/g, ' ');

  return { canonical, tokens: aliasCanonical, changed };
}

