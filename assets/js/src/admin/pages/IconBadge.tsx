import React from 'react';
import { Box } from '@mui/material';
import { alpha } from '@mui/material/styles';

export type IconBadgeTone = 'primary' | 'subtle';

export type IconBadgeProps = {
  children: React.ReactNode;
  size?: number;
  tone?: IconBadgeTone;
};

const TONE_OPACITY: Record<IconBadgeTone, number> = {
  primary: 0.12,
  subtle: 0.08,
};

/**
 * Decorative tinted circle that hosts a single icon (used by Overview hero
 * and "Don't forget to try these" header to mirror the mockup).
 *
 * @since 1.6.0
 */
export function IconBadge({ children, size = 40, tone = 'primary' }: IconBadgeProps) {
  const iconSize = Math.max(16, Math.round(size * 0.55));
  return (
    <Box
      aria-hidden="true"
      data-flux-one-icon-badge=""
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: 'primary.main',
        bgcolor: (theme) => alpha(theme.palette.primary.main, TONE_OPACITY[tone]),
        '& > svg': {
          fontSize: iconSize,
        },
      }}
    >
      {children}
    </Box>
  );
}
