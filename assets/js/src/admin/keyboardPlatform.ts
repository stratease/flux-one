/**
 * Client-side modifier detection for admin bar labeling (async UA-CH + sync fallback).
 *
 * @since 1.2.1
 */

export type AdminBarModifierWord = 'ctrl' | 'cmd';

/**
 * Resolve whether the admin bar should show "Cmd" vs "Ctrl" for the mod key.
 *
 * @since 1.2.1
 */
export async function resolveAdminBarModifierWord(): Promise<AdminBarModifierWord> {
  if (typeof navigator === 'undefined') {
    return 'ctrl';
  }
  const ua = (navigator as Navigator & { userAgentData?: { getHighEntropyValues?: (h: string[]) => Promise<{ platform?: string }> } })
    .userAgentData;
  if (ua && typeof ua.getHighEntropyValues === 'function') {
    try {
      const hints = await ua.getHighEntropyValues(['platform']);
      const p = String(hints.platform || '').toLowerCase();
      if (p.includes('mac')) {
        return 'cmd';
      }
    } catch {
      /* ignore */
    }
  }
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? 'cmd' : 'ctrl';
}
