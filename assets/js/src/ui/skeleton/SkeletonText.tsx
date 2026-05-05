import React from 'react';
import { Skeleton } from './Skeleton';

export type SkeletonTextProps = {
  lines?: number;
  className?: string;
};

const WIDTH_CYCLE = ['100%', '92%', '78%', '88%', '64%'];

/**
 * Stacked text-line skeleton placeholders with varied widths.
 *
 * @since 1.4.0
 */
export function SkeletonText({ lines = 3, className = '' }: SkeletonTextProps) {
  const count = Math.max(1, Math.min(lines, 12));
  return (
    <span className={['flux-one-skeleton-text-lines', className].filter(Boolean).join(' ')} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} variant="text" width={WIDTH_CYCLE[i % WIDTH_CYCLE.length]} height={10} />
      ))}
    </span>
  );
}
