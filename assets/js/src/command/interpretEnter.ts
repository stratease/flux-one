import { canonicalizeInput } from './normalize';
import type { EntityType, Suggestion } from './types';
import type { IndexData } from './suggest';
import { resolveRunnableCommand } from './commandLadder';

/**
 * Entity suggestions whose `value` is the exact command to POST (or client-nav),
 * unlike `configKey` / `configValue` rows that may open hybrid UI or need ladder checks.
 *
 * @since 1.6.3
 */
const ENTITY_TYPES_TRUST_PICK_RUN: ReadonlySet<EntityType> = new Set([
  'plugin',
  'user',
  'menu',
  'destination',
  'content',
]);

/**
 * @since 1.6.3
 */
function isTrustedEntityRunnablePick(s: Suggestion): boolean {
  if (s.kind !== 'entity') {
    return false;
  }
  const t = s.entityType;
  return t != null && ENTITY_TYPES_TRUST_PICK_RUN.has(t);
}

export type InterpretEnterResult =
  | { kind: 'complete'; value: string }
  | { kind: 'complete_and_run'; value: string }
  | { kind: 'run'; value: string }
  | { kind: 'none' };

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Enter key: prefer runnable typed command; else use highlighted suggestion.
 */
export function interpretEnter(
  rawInput: string,
  ctx: { indices: IndexData; mergedSuggestions: Suggestion[]; activeIndex: number }
): InterpretEnterResult {
  const trimmed = rawInput.trim();
  const { canonical } = canonicalizeInput(trimmed);
  const direct = resolveRunnableCommand(canonical, ctx.indices);

  if (direct.ok && direct.command) {
    if (norm(direct.command) === norm(canonical)) {
      const runValue = /^config(\s|$)/i.test(trimmed) ? trimmed : direct.command;
      return { kind: 'run', value: runValue };
    }
    return { kind: 'complete_and_run', value: direct.command };
  }

  const merged = ctx.mergedSuggestions;
  const active = merged[ctx.activeIndex] ?? merged[0] ?? null;
  if (!active) {
    return { kind: 'none' };
  }

  // Client-side navigation suggestions (nav-style entities) should run immediately on Enter.
  if (active.clientAction === 'nav' && typeof active.navUrl === 'string' && active.navUrl.trim() !== '') {
    return { kind: 'complete_and_run', value: active.value };
  }

  if (isTrustedEntityRunnablePick(active)) {
    return { kind: 'complete_and_run', value: active.value };
  }

  const activeCanon = canonicalizeInput(active.value.trim()).canonical;
  const fromActive = resolveRunnableCommand(activeCanon, ctx.indices);

  if (fromActive.ok && fromActive.command) {
    return { kind: 'complete_and_run', value: fromActive.command };
  }

  if (trimmed !== active.value || norm(trimmed) !== norm(active.value)) {
    return { kind: 'complete', value: active.value };
  }

  return { kind: 'none' };
}

/**
 * Mouse pick on a suggestion row.
 */
export function interpretSuggestionPick(suggestion: Suggestion, indices: IndexData): InterpretEnterResult {
  if (
    suggestion.clientAction === 'nav' &&
    typeof suggestion.navUrl === 'string' &&
    suggestion.navUrl.trim() !== ''
  ) {
    return { kind: 'complete_and_run', value: suggestion.value };
  }
  if (isTrustedEntityRunnablePick(suggestion)) {
    return { kind: 'complete_and_run', value: suggestion.value };
  }
  const activeCanon = canonicalizeInput(suggestion.value.trim()).canonical;
  const fromActive = resolveRunnableCommand(activeCanon, indices);
  if (fromActive.ok && fromActive.command) {
    return { kind: 'complete_and_run', value: fromActive.command };
  }
  return { kind: 'complete', value: suggestion.value };
}
