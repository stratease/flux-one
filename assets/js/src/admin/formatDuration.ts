/**
 * Compact duration for time-saved hero copy.
 *
 * @package FluxOne
 * @since 1.6.0
 */

import { __ } from '@wordpress/i18n';

/**
 * @since 1.6.0
 */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return __('0s', 'flux-one');
  }
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  if (m > 0) {
    return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
  }
  return `${sec}s`;
}
