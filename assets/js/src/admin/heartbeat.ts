/**
 * Periodic heartbeat: flush pending command usage (extensible).
 *
 * @package FluxOne
 * @since 1.6.0
 */

import apiFetch from '@wordpress/api-fetch';
import {
  applyHeartbeatServerCounts,
  initUsageStoreFromWindow,
  readPendingFromLocalStorage,
} from './usage-store';

type HeartbeatEnvelope = {
  success?: boolean;
  data?: { counts?: Record<string, number> };
};

function withNonce(options: Record<string, unknown> = {}): Record<string, unknown> {
  const cfg = window.fluxOneAdmin;
  if (!cfg) {
    return options;
  }
  return {
    ...options,
    headers: {
      ...((options.headers as Record<string, string>) || {}),
      'X-WP-Nonce': cfg.nonce,
    },
  };
}

/**
 * @since 1.6.0
 */
export async function flushHeartbeat(): Promise<void> {
  initUsageStoreFromWindow();
  const pending = readPendingFromLocalStorage();
  const body: Record<string, unknown> = {};
  if (Object.keys(pending).length > 0) {
    body.commandUsage = pending;
  }
  try {
    const raw = (await apiFetch(
      withNonce({
        path: '/flux-one/v1/heartbeat',
        method: 'POST',
        data: body,
      }) as Parameters<typeof apiFetch>[0]
    )) as HeartbeatEnvelope;
    if (raw?.success === true && raw.data?.counts !== undefined) {
      applyHeartbeatServerCounts(raw.data.counts);
    }
  } catch {
    // Retain localStorage queue on failure.
  }
}

export { recordCommandUsage } from './usage-store';

let heartbeatSubscribers = 0;
let heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Ref-counted: Command Bar + Plugin App may both mount on same admin load.
 *
 * @since 1.6.0
 */
export function startHeartbeat(): () => void {
  initUsageStoreFromWindow();
  void flushHeartbeat();
  heartbeatSubscribers += 1;
  if (heartbeatIntervalId === null) {
    heartbeatIntervalId = window.setInterval(() => {
      void flushHeartbeat();
    }, 60_000);
  }
  return () => {
    heartbeatSubscribers -= 1;
    if (heartbeatSubscribers <= 0 && heartbeatIntervalId !== null) {
      window.clearInterval(heartbeatIntervalId);
      heartbeatIntervalId = null;
      heartbeatSubscribers = 0;
    }
  };
}
