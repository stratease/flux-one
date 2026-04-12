import { canonicalizeInput } from './normalize';
import type { Suggestion } from './types';
import type { IndexData } from './suggest';
import { resolveRunnableCommand } from './commandLadder';

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
  // Server parses `config` with original casing (API keys, model ids).
  if (/^config(\s|$)/i.test(trimmed)) {
    return { kind: 'run', value: trimmed };
  }
  const { canonical } = canonicalizeInput(trimmed);
  const direct = resolveRunnableCommand(canonical, ctx.indices);

  if (direct.ok && direct.command) {
    if (norm(direct.command) === norm(canonical)) {
      return { kind: 'run', value: direct.command };
    }
    return { kind: 'complete_and_run', value: direct.command };
  }

  const active = ctx.mergedSuggestions[ctx.activeIndex] ?? null;
  if (!active) {
    return { kind: 'none' };
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
  const activeCanon = canonicalizeInput(suggestion.value.trim()).canonical;
  const fromActive = resolveRunnableCommand(activeCanon, indices);
  if (fromActive.ok && fromActive.command) {
    return { kind: 'complete_and_run', value: fromActive.command };
  }
  return { kind: 'complete', value: suggestion.value };
}
