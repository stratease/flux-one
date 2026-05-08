import React, { useMemo, useSyncExternalStore } from 'react';
import { Box, Grid, Link, Paper, Stack, Typography } from '@mui/material';
import { UpsellCard } from '@flux-plugins-common/components';
import { __, sprintf } from '@wordpress/i18n';
import { formatAdminBarHotkeyText } from '../commandShortcut';
import { formatDuration } from '../formatDuration';
import { getUsageStoreSnapshot, subscribeUsageStore } from '../usage-store';
import { OverviewBarChart } from './OverviewBarChart';
import { OverviewWelcome } from './OverviewWelcome';

type Bootstrap = {
  license?: { valid?: boolean };
  uiPrefs?: { commandShortcut?: string };
  commandUsage?: {
    counts?: Record<string, number>;
    estimatesSeconds?: Record<string, number>;
    totalSecondsSaved?: number;
  };
};

function readBootstrap(): Bootstrap {
  return (window.fluxOneAdmin?.bootstrap as Bootstrap) || {};
}

function commandShortcutLabel(raw: string | undefined): string {
  const shortcutRaw = raw && raw.trim() !== '' ? raw : 'mod+k';
  const isApple =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
  return formatAdminBarHotkeyText(shortcutRaw, isApple ? 'cmd' : 'ctrl');
}

/**
 * Flux One plugin app landing tab.
 *
 * @since 1.6.0
 */
export function OverviewPage() {
  const snap = useSyncExternalStore(subscribeUsageStore, getUsageStoreSnapshot, getUsageStoreSnapshot);

  const adminUrl =
    typeof window !== 'undefined' && window.fluxOneAdmin?.adminUrl
      ? String(window.fluxOneAdmin.adminUrl).replace(/\/?$/, '/')
      : '/wp-admin/';

  const boot = readBootstrap();
  const licenseValid = boot.license?.valid === true;
  const shortcutLabel = commandShortcutLabel(boot.uiPrefs?.commandShortcut);
  const estimatesSeconds = boot.commandUsage?.estimatesSeconds ?? {};

  const rootLabels: Record<string, string> = useMemo(
    () => ({
      nav: __('Navigate', 'flux-one'),
      edit: __('Edit', 'flux-one'),
      plugin: __('Plugin', 'flux-one'),
      user: __('User', 'flux-one'),
      menu: __('Menu', 'flux-one'),
      config: __('Config', 'flux-one'),
      aggregate: __('Aggregate', 'flux-one'),
      summary: __('Summary', 'flux-one'),
    }),
    []
  );

  const totalSaved = snap.totalSecondsSaved;
  const hasUsage = totalSaved > 0;

  const upsellBullets = useMemo(
    () => [
      __('AI-Powered Email Summaries', 'flux-one'),
      __('Advanced Automation and Scheduling', 'flux-one'),
      __('CDN Integration for Faster Delivery', 'flux-one'),
      __('Premium Features Across All Flux Suite Plugins', 'flux-one'),
    ],
    []
  );

  const mainColumn = !hasUsage ? (
    <OverviewWelcome commandShortcut={shortcutLabel} adminUrl={adminUrl} />
  ) : (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h5" component="h2">
          {sprintf(
            /* translators: %s: Duration such as 2h 15m. */
            __("You've saved %s", 'flux-one'),
            formatDuration(totalSaved)
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {sprintf(
            /* translators: %d: Total command invocations counted. */
            __('Across %d commands', 'flux-one'),
            snap.totalCommandRuns
          )}
        </Typography>
      </Paper>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <OverviewBarChart
          counts={snap.counts}
          estimatesSeconds={estimatesSeconds}
          rootLabels={rootLabels}
          totalSecondsSaved={totalSaved}
        />
      </Paper>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2">
          {sprintf(
            /* translators: %s: Keyboard shortcut. */
            __('Tip: Press %s to open Command Bar anytime.', 'flux-one'),
            shortcutLabel
          )}
        </Typography>
      </Paper>
    </Stack>
  );

  return (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12} md={licenseValid ? 12 : 8}>
          {mainColumn}
        </Grid>
        {!licenseValid && (
          <Grid item xs={12} md={4}>
            <UpsellCard intro={__('Unlock Flux One Pro features:', 'flux-one')} bullets={upsellBullets} />
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
