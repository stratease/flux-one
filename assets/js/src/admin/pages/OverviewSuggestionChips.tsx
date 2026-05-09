import React, { useCallback } from 'react';
import { Chip, Stack } from '@mui/material';
import {
  CommandRootId,
  OVERVIEW_SUGGESTION_META_BY_ID,
  buildSuggestionPrefillEvent,
} from './overviewSuggestionMeta';

export type OverviewSuggestionChipsProps = {
  ids: readonly CommandRootId[];
  rootLabels: Readonly<Record<string, string>>;
};

declare global {
  interface Window {
    fluxOneOpenOverlay?: (opts?: { input?: string }) => Promise<void>;
  }
}

/**
 * Render the "Don't forget to try these" chip row.
 *
 * Each chip dispatches `flux-one-open` with `detail.input` set to the
 * canonical root + trailing space so Command Bar opens prefilled and lands on
 * Next-step suggestions for that root.
 *
 * @since 1.6.0
 */
export function OverviewSuggestionChips({ ids, rootLabels }: OverviewSuggestionChipsProps) {
  const handleClick = useCallback((canonical: string) => {
    if (typeof window === 'undefined') return;
    const evt = buildSuggestionPrefillEvent(canonical);
    const input = evt.detail.input;
    if (typeof window.fluxOneOpenOverlay === 'function') {
      void window.fluxOneOpenOverlay({ input });
      return;
    }
    window.dispatchEvent(evt);
  }, []);

  if (!ids || ids.length === 0) {
    return null;
  }

  return (
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
      {ids.map((id) => {
        const meta = OVERVIEW_SUGGESTION_META_BY_ID[id];
        if (!meta) return null;
        const Icon = meta.Icon;
        const label = rootLabels[id] ?? id;
        return (
          <Chip
            key={id}
            variant="outlined"
            clickable
            label={label}
            icon={<Icon aria-hidden="true" />}
            onClick={() => handleClick(meta.canonical)}
            sx={{
              borderRadius: 999,
              px: 0.5,
              '& .MuiChip-icon': { color: 'text.secondary' },
              '&:hover': { borderColor: 'primary.main' },
              '&:hover .MuiChip-icon': { color: 'primary.main' },
            }}
          />
        );
      })}
    </Stack>
  );
}
