import React from 'react';

export type SkeletonProps = {
  variant?: 'text' | 'rect' | 'circle';
  width?: string | number;
  height?: string | number;
  radius?: string | number;
  className?: string;
};

/**
 * Theme-token-driven loading block with shimmer animation (CSS).
 *
 * @since 1.4.0
 */
export function Skeleton({ variant = 'rect', width, height, radius, className = '' }: SkeletonProps) {
  const style: React.CSSProperties = {};
  if (width != null) {
    style.width = typeof width === 'number' ? `${width}px` : width;
  }
  if (height != null) {
    style.height = typeof height === 'number' ? `${height}px` : height;
  }
  if (radius != null) {
    style.borderRadius = typeof radius === 'number' ? `${radius}px` : radius;
  }

  const cls = ['flux-one-skeleton', `flux-one-skeleton--${variant}`, className].filter(Boolean).join(' ');

  return <span className={cls} style={style} aria-hidden />;
}
