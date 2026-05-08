/**
 * Authoritative + pending command usage for optimistic Overview UI.
 *
 * @package FluxOne
 * @since 1.6.0
 */

const LS_KEY = 'flux_one_pending_command_usage';

type CommandUsageBootstrap = {
  counts?: Record<string, number>;
  estimatesSeconds?: Record<string, number>;
  totalSecondsSaved?: number;
};

let authoritativeCounts: Record<string, number> = {};
let estimatesSeconds: Record<string, number> = {};
const listeners = new Set<() => void>();
let initializedFromWindow = false;
let version = 0;
let cachedSnapshot: {
  counts: Record<string, number>;
  totalSecondsSaved: number;
  totalCommandRuns: number;
} | null = null;
let cachedVersion = -1;

function notify(): void {
  version += 1;
  listeners.forEach((cb) => {
    cb();
  });
}

function totalSecondsForCounts(counts: Record<string, number>): number {
  let t = 0;
  for (const [root, n] of Object.entries(counts)) {
    const sec = estimatesSeconds[root];
    if (sec != null && n > 0) {
      t += n * sec;
    }
  }
  return t;
}

function mergeDisplay(): {
  counts: Record<string, number>;
  totalSecondsSaved: number;
  totalCommandRuns: number;
} {
  const pending = readPendingFromLocalStorage();
  const counts: Record<string, number> = { ...authoritativeCounts };
  for (const [k, v] of Object.entries(pending)) {
    if (v <= 0) {
      continue;
    }
    counts[k] = (counts[k] || 0) + v;
  }
  let totalRuns = 0;
  for (const n of Object.values(counts)) {
    totalRuns += n;
  }
  return {
    counts,
    totalSecondsSaved: totalSecondsForCounts(counts),
    totalCommandRuns: totalRuns,
  };
}

/**
 * @since 1.6.0
 */
export function readPendingFromLocalStorage(): Record<string, number> {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) {
      return {};
    }
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== 'object') {
      return {};
    }
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
      const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : 0;
      if (n > 0) {
        out[k] = n;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * @since 1.6.0
 */
export function writePendingToLocalStorage(q: Record<string, number>): void {
  if (typeof window === 'undefined') {
    return;
  }
  const cleaned: Record<string, number> = {};
  for (const [k, v] of Object.entries(q)) {
    if (v > 0) {
      cleaned[k] = v;
    }
  }
  if (Object.keys(cleaned).length === 0) {
    window.localStorage.removeItem(LS_KEY);
    return;
  }
  window.localStorage.setItem(LS_KEY, JSON.stringify(cleaned));
}

/**
 * @since 1.6.0
 */
export function initUsageStoreFromWindow(): void {
  if (initializedFromWindow) {
    return;
  }
  const cu = window.fluxOneAdmin?.bootstrap?.commandUsage as CommandUsageBootstrap | undefined;
  if (!cu) {
    return;
  }
  authoritativeCounts = { ...(cu.counts || {}) };
  estimatesSeconds = { ...(cu.estimatesSeconds || {}) };
  initializedFromWindow = true;
  notify();
}

/**
 * @since 1.6.0
 */
export function recordCommandUsage(root: string): void {
  initUsageStoreFromWindow();
  const key = root.trim().toLowerCase();
  if (!key || !Object.prototype.hasOwnProperty.call(estimatesSeconds, key)) {
    return;
  }
  const pending = readPendingFromLocalStorage();
  pending[key] = (pending[key] || 0) + 1;
  writePendingToLocalStorage(pending);
  notify();
}

/**
 * @since 1.6.0
 */
export function applyHeartbeatServerCounts(counts: Record<string, number>): void {
  authoritativeCounts = { ...counts };
  writePendingToLocalStorage({});
  notify();
}

/**
 * @since 1.6.0
 */
export function subscribeUsageStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * @since 1.6.0
 */
export function getUsageStoreSnapshot(): {
  counts: Record<string, number>;
  totalSecondsSaved: number;
  totalCommandRuns: number;
} {
  if (cachedSnapshot === null || cachedVersion !== version) {
    cachedSnapshot = mergeDisplay();
    cachedVersion = version;
  }
  return cachedSnapshot;
}
