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
 *
 * @since 0.1.0
 * @since 1.6.3 Dropped `sites` → `site` mapping (site command removed).
 * This must align with `app/Services/CommandRouter.php` (no `sites` root alias).
 */
export function canonicalizeTokens(tokens: Token[]): Token[] {
  // "plugin upload|install" => "nav add plugin" (navigation command).
  if (tokens[0] === 'plugin' && ['upload', 'install'].includes(tokens[1] || '')) {
    return ['nav', 'add', 'plugin'];
  }

  // "role set …" => "user role set …" (matches CommandRouter / UsersHandler).
  if (tokens[0] === 'role' && tokens[1] === 'set') return ['user', 'role', 'set', ...tokens.slice(2)];

  // "lock user X" => "user lock X" (canonical; matches CommandRouter).
  if (tokens[0] === 'lock' && tokens[1] === 'user') return ['user', 'lock', ...tokens.slice(2)];
  if (tokens[0] === 'unlock' && tokens[1] === 'user') return ['user', 'unlock', ...tokens.slice(2)];
  if (tokens[0] === 'users' && tokens[1] === 'lock') return ['user', 'lock', ...tokens.slice(2)];
  if (tokens[0] === 'users' && tokens[1] === 'unlock') return ['user', 'unlock', ...tokens.slice(2)];

  // "email aggregate" => "aggregate email"
  if (tokens[0] === 'email' && tokens[1] === 'aggregate') return ['aggregate', 'email', ...tokens.slice(2)];
  if (tokens[0] === 'emails' && tokens[1] === 'aggregate') return ['aggregate', 'email', ...tokens.slice(2)];

  // "email summary" => "summary email" (represented as tokens for standard mode)
  if (tokens[0] === 'email' && tokens[1] === 'summary') return ['summary', 'email', ...tokens.slice(2)];

  // "menu show" => "menu list" (alias; mirrors CommandRouter::canonicalize_tokens).
  if (tokens[0] === 'menu' && tokens[1] === 'show') {
    return ['menu', 'list', ...tokens.slice(2)];
  }

  const out = [...tokens];
  if (out[0] === 'go' || out[0] === 'open') {
    out[0] = 'nav';
  }
  if (out[0] === 'plugins') {
    out[0] = 'plugin';
  }
  if (out[0] === 'users') {
    out[0] = 'user';
  }
  if (out[0] === 'edit') {
    if (out[1] === 'posts') {
      out[1] = 'post';
    }
    if (out[1] === 'pages') {
      out[1] = 'page';
    }
  }
  if (out[0] === 'pnav') {
    if (out[1] === 'posts') {
      out[1] = 'post';
    }
    if (out[1] === 'pages') {
      out[1] = 'page';
    }
  }
  return out;
}

/**
 * Parse `edit` / `pnav` content search tail after the root (same rules as Command Bar debounce).
 *
 * @since 1.6.3
 * @param rawLower Lowercased full input.
 * @param root     `edit` or `pnav`.
 * @return Kind + remainder for XHR `q`, or null when input does not start with the root command.
 */
export function parseContentIndexTail(
  rawLower: string,
  root: 'edit' | 'pnav'
): { kind: 'any' | 'post' | 'page'; rest: string } | null {
  if ( ! new RegExp( `^${ root }(\\s|$)`, 'i' ).test( rawLower ) ) {
    return null;
  }
  const kindFromInput =
    rawLower.startsWith( `${ root } page` ) ? 'page' : rawLower.startsWith( `${ root } post` ) ? 'post' : 'any';
  const rest = rawLower.replace( new RegExp( `^${ root }\\s+(post|page|p)\\s*`, 'i' ), '' ).trim();
  return { kind: kindFromInput, rest };
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

/**
 * Root token for usage metrics (`summary email` → `summary`; aligns with CommandRouter).
 *
 * @since 1.6.0
 */
export function getRootToken(canonical: string): string {
  const tokens = canonical
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean);
  if (tokens.length === 0) {
    return '';
  }
  if (tokens[0] === 'summary') {
    return 'summary';
  }
  return tokens[0];
}

