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
    return __('0s', 'flux-one-command-bar');
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

export type UsageTier = 'low' | 'medium' | 'high';

const LOW_TIER_SECONDS = 15 * 60;
const MEDIUM_TIER_SECONDS = 2 * 60 * 60;

/**
 * Longer human duration (supports days).
 *
 * @since 1.6.0
 */
export function formatDurationLong(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return __('0s', 'flux-one-command-bar');
  }

  const s = Math.floor(totalSeconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (d > 0) {
    if (h > 0) return `${d}d ${h}h`;
    return `${d}d`;
  }
  if (h > 0) {
    if (m > 0) return `${h}h ${m}m`;
    return `${h}h`;
  }
  if (m > 0) {
    if (sec > 0) return `${m}m ${sec}s`;
    return `${m}m`;
  }
  return `${sec}s`;
}

/**
 * Short duration labels for charts (no seconds once >= 1 minute).
 *
 * @since 1.6.0
 */
export function formatDurationShort(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return __('0s', 'flux-one-command-bar');
  }

  const s = Math.floor(totalSeconds);
  if (s < 60) {
    return `${s}s`;
  }

  const totalMinutes = Math.floor(s / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const totalHours = Math.floor(s / 3600);
  if (totalHours < 24) {
    const m = Math.floor((s % 3600) / 60);
    return m > 0 ? `${totalHours}h ${m}m` : `${totalHours}h`;
  }

  const totalDays = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  return h > 0 ? `${totalDays}d ${h}h` : `${totalDays}d`;
}

/**
 * Usage tier for congrats message selection.
 *
 * @since 1.6.0
 */
export function getUsageTier(totalSecondsSaved: number): UsageTier {
  const t = Number.isFinite(totalSecondsSaved) ? Math.max(0, Math.floor(totalSecondsSaved)) : 0;
  if (t < LOW_TIER_SECONDS) return 'low';
  if (t < MEDIUM_TIER_SECONDS) return 'medium';
  return 'high';
}
