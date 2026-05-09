import React, { useEffect, useMemo, useState } from 'react';
import { Stack, Typography } from '@mui/material';
import PeopleOutlineOutlinedIcon from '@mui/icons-material/PeopleOutlineOutlined';
import { __, _n, sprintf } from '@wordpress/i18n';
import { formatDurationLong, getUsageTier } from '../formatDuration';
import { pickTierMessage } from '../overviewUsageMessages';
import {
  DEFAULT_COUNT_UP_DELAY_MS,
  DEFAULT_COUNT_UP_DURATION_MS,
  computeCountUpValue,
} from '../countUpAnimation';

export type AnimatedTimeSavedProps = {
  totalSecondsSaved: number;
  commandsUsedCount: number;
  durationMs?: number;
  delayMs?: number;
};

function clampInt(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    return false;
  }
}

/**
 * Animated time saved hero (count-up + tier message).
 *
 * @since 1.6.0
 */
export function AnimatedTimeSaved({
  totalSecondsSaved,
  commandsUsedCount,
  durationMs = DEFAULT_COUNT_UP_DURATION_MS,
  delayMs = DEFAULT_COUNT_UP_DELAY_MS,
}: AnimatedTimeSavedProps) {
  const target = clampInt(totalSecondsSaved);
  const commandCount = clampInt(commandsUsedCount);
  const tier = useMemo(() => getUsageTier(target), [target]);
  const message = useMemo(() => pickTierMessage(tier), [tier]);

  const [shownSeconds, setShownSeconds] = useState(0);
  const [messageVisible, setMessageVisible] = useState(false);

  useEffect(() => {
    setShownSeconds(0);
    setMessageVisible(false);

    if (target <= 0) {
      setMessageVisible(true);
      return;
    }

    if (prefersReducedMotion()) {
      setShownSeconds(target);
      setMessageVisible(true);
      return;
    }

    let raf = 0;
    let start = 0;

    const tick = (ts: number) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      const step = computeCountUpValue(elapsed, target, delayMs, durationMs);
      setShownSeconds(step.value);
      if (step.done) {
        setMessageVisible(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [target, durationMs, delayMs]);

  // The reveal transition mirrors the easing of the count-up so the message
  // settles in alongside the final number rather than snapping in cold.
  const revealMs = Math.max(200, Math.round(durationMs * 0.35));

  return (
    <>
      <Typography variant="h5" component="h2">
        {sprintf(
          /* translators: %s: Duration such as 2h 15m. */
          __("You've saved %s", 'flux-one'),
          formatDurationLong(shownSeconds)
        )}
      </Typography>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25 }}>
        <PeopleOutlineOutlinedIcon
          aria-hidden="true"
          fontSize="small"
          sx={{ color: 'text.secondary', fontSize: 16 }}
        />
        <Typography variant="body2" color="text.secondary">
          {sprintf(
            /* translators: %d: Distinct command roots shown in the time-saved chart. */
            _n('Across %d command', 'Across %d commands', commandCount, 'flux-one'),
            commandCount
          )}
        </Typography>
      </Stack>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          mt: 0.5,
          opacity: messageVisible ? 1 : 0,
          transform: messageVisible ? 'translateY(0)' : 'translateY(4px)',
          transition: `opacity ${revealMs}ms ease, transform ${revealMs}ms ease`,
        }}
      >
        {message}
      </Typography>
    </>
  );
}
