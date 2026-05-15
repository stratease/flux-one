import React from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import { useTheme } from '@mui/material/styles';
import { __, sprintf } from '@wordpress/i18n';
import { formatDurationLong, formatDurationShort } from '../formatDuration';

export type OverviewBarChartProps = {
  counts: Record<string, number>;
  estimatesSeconds: Record<string, number>;
  rootLabels: Record<string, string>;
  totalSecondsSaved: number;
};

type ChartRow = {
  root: string;
  n: number;
  seconds: number;
  label: string;
};

function normalizePositiveInt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function isChartedCommand(count: number, seconds: number): boolean {
  return count > 0 && seconds > 0;
}

function getChartRows(
  counts: Record<string, number>,
  estimatesSeconds: Record<string, number>,
  rootLabels: Record<string, string> = {}
): ChartRow[] {
  return Object.entries(counts)
    .map(([root, c]) => {
      const n = normalizePositiveInt(c);
      const per = normalizePositiveInt(estimatesSeconds[root]);
      const seconds = n * per;
      return { root, n, seconds, label: rootLabels[root] ?? root };
    })
    .filter((r) => isChartedCommand(r.n, r.seconds))
    .sort((a, b) => b.seconds - a.seconds);
}

/**
 * Count distinct command roots represented as bars in the Overview chart.
 *
 * @since 1.6.0
 */
export function countChartedCommands(
  counts: Record<string, number>,
  estimatesSeconds: Record<string, number>
): number {
  return getChartRows(counts, estimatesSeconds).length;
}

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

  const rows = getChartRows(counts, estimatesSeconds, rootLabels);

  if (rows.length === 0) {
    return null;
  }

  const labels = rows.map((r) => r.label);
  const values = rows.map((r) => r.seconds);
  const ariaSummary = sprintf(
    /* translators: %s: Human-readable duration. */
    __('Time saved chart. Total about %s.', 'flux-one-command-bar'),
    formatDurationLong(totalSecondsSaved)
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
        yAxis={[
          {
            valueFormatter: (v: any) => formatDurationShort(Number(v) || 0),
          },
        ]}
        series={[
          {
            id: 'seconds',
            label: __('Time saved', 'flux-one-command-bar'),
            data: values,
            valueFormatter: (v: any) => formatDurationShort(Number(v) || 0),
          },
        ]}
        margin={{ top: 24, bottom: 40, left: 48, right: 12 }}
      />
    </div>
  );
}
