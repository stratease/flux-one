/**
 * Pure animation progression for the Overview "You've saved" count-up hero.
 *
 * Kept separate from the React component so the timing curve can be unit
 * tested without a DOM.
 *
 * @package FluxOne
 * @since 1.6.0
 */

export type CountUpStep = {
  value: number;
  done: boolean;
};

/**
 * Default initial pause before the count-up starts ticking, in milliseconds.
 *
 * @since 1.6.0
 */
export const DEFAULT_COUNT_UP_DELAY_MS = 400;

/**
 * Default count-up duration, in milliseconds. Standard hero animation length.
 *
 * @since 1.6.0
 */
export const DEFAULT_COUNT_UP_DURATION_MS = 2200;

/**
 * Compute the displayed value for a count-up animation at a given elapsed time.
 *
 * @since 1.6.0
 */
export function computeCountUpValue(
  elapsedMs: number,
  target: number,
  delayMs: number,
  durationMs: number
): CountUpStep {
  const safeTarget = Number.isFinite(target) && target > 0 ? Math.floor(target) : 0;
  if (safeTarget === 0) {
    return { value: 0, done: true };
  }

  const safeDuration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;
  if (safeDuration === 0) {
    return { value: safeTarget, done: true };
  }

  const safeDelay = Number.isFinite(delayMs) && delayMs > 0 ? delayMs : 0;
  const elapsed = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;

  if (elapsed < safeDelay) {
    return { value: 0, done: false };
  }

  const t = Math.min(1, (elapsed - safeDelay) / safeDuration);
  const eased = 1 - Math.pow(1 - t, 3);
  return {
    value: Math.round(safeTarget * eased),
    done: t >= 1,
  };
}
