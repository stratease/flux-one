/**
 * Least-used command root picker for the Overview "Don't forget to try these" suggestions.
 *
 * @package FluxOne
 * @since 1.6.0
 */

function toNonNegativeInt(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}

/**
 * Pick the N least-used canonical command roots for discovery prompts.
 *
 * Sort order: ascending by run count, ties broken by ascending estimated
 * seconds saved, then by the original index in `rootIds` for full ties.
 *
 * Zero-count roots are intentionally surfaced first so operators see commands
 * they have not tried yet.
 *
 * @since 1.6.0
 */
export function pickLeastUsedRoots(
  rootIds: readonly string[],
  counts: Readonly<Record<string, number>>,
  estimatesSeconds: Readonly<Record<string, number>>,
  limit: number = 3
): string[] {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0;
  if (safeLimit === 0 || rootIds.length === 0) {
    return [];
  }

  const decorated = rootIds.map((id, index) => {
    const count = toNonNegativeInt(counts[id]);
    const perRun = toNonNegativeInt(estimatesSeconds[id]);
    return { id, index, count, seconds: count * perRun };
  });

  decorated.sort((a, b) => {
    if (a.count !== b.count) return a.count - b.count;
    if (a.seconds !== b.seconds) return a.seconds - b.seconds;
    return a.index - b.index;
  });

  return decorated.slice(0, safeLimit).map((row) => row.id);
}
