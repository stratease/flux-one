import React from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import { useTheme } from '@mui/material/styles';
import { __, sprintf } from '@wordpress/i18n';
import { formatDuration } from '../formatDuration';

export type OverviewBarChartProps = {
  counts: Record<string, number>;
  estimatesSeconds: Record<string, number>;
  rootLabels: Record<string, string>;
  totalSecondsSaved: number;
};

/**
 * Per-command time saved (seconds), sorted descending.
 *
 * @since 1.6.0
 */
export function OverviewBarChart({
  counts,
  estimatesSeconds,
  rootLabels,
  totalSecondsSaved,
}: OverviewBarChartProps) {
  const theme = useTheme();

  const rows = Object.entries(counts)
    .map(([root, c]) => {
      const n = typeof c === 'number' && c > 0 ? Math.floor(c) : 0;
      const per = estimatesSeconds[root] ?? 0;
      const seconds = n * per;
      return { root, n, seconds, label: rootLabels[root] ?? root };
    })
    .filter((r) => r.n > 0 && r.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds);

  if (rows.length === 0) {
    return null;
  }

  const labels = rows.map((r) => r.label);
  const values = rows.map((r) => r.seconds);
  const ariaSummary = sprintf(
    /* translators: %s: Human-readable duration. */
    __('Time saved chart. Total about %s.', 'flux-one'),
    formatDuration(totalSecondsSaved)
  );

  return (
    <div role="img" aria-label={ariaSummary}>
      <BarChart
        height={280}
        colors={[theme.palette.primary.main]}
        xAxis={[
          {
            id: 'commands',
            data: labels,
            scaleType: 'band',
          },
        ]}
        series={[
          {
            id: 'seconds',
            label: __('Seconds saved', 'flux-one'),
            data: values,
          },
        ]}
        margin={{ top: 24, bottom: 40, left: 48, right: 12 }}
      />
    </div>
  );
}
