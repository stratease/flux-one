import type { Suggestion } from './types';

/**
 * Returns the ghost hint remainder (text to display after the caret).
 */
export function getGhostRemainder(input: string, best?: Suggestion | null): string {
  if (!best) return '';
  const raw = input;
  if (!raw) return '';
  if (!best.value.toLowerCase().startsWith(raw.toLowerCase())) return '';
  return best.value.slice(raw.length);
}

