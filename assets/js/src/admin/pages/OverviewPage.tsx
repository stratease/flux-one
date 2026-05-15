import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Box, Button, Divider, Grid, Paper, Stack, Typography } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { UpsellCard } from '@flux-plugins-common/components';
import { __ } from '@wordpress/i18n';
import { formatAdminBarHotkeyText } from '../commandShortcut';
import { getUsageStoreSnapshot, subscribeUsageStore } from '../usage-store';
import { pickLeastUsedRoots } from '../leastUsedRoots';
import { OverviewBarChart, countChartedCommands } from './OverviewBarChart';
import { OverviewWelcome } from './OverviewWelcome';
import { AnimatedTimeSaved } from './AnimatedTimeSaved';
import { IconBadge } from './IconBadge';
import { OverviewSuggestionChips } from './OverviewSuggestionChips';
import { CommandRootId } from './overviewSuggestionMeta';
import { CommandsReferenceList } from '../../ui/CommandsReferenceList';

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

const SUGGESTION_LIMIT = 3;
const COMMANDS_REFERENCE_ID = 'flux-one-overview-commands-ref';

type OverviewPageLayoutProps = {
  adminUrl: string;
  commandsRefSectionRef: React.RefObject<HTMLDivElement>;
  commandsUsedCount: number;
  estimatesSeconds: Record<string, number>;
  hasUsage: boolean;
  licenseValid: boolean;
  leastUsed: CommandRootId[];
  onViewAllCommands: () => void;
  rootLabels: Record<CommandRootId, string>;
  shortcutLabel: string;
  showCommandsRef: boolean;
  snap: ReturnType<typeof getUsageStoreSnapshot>;
  totalSaved: number;
  upsellBullets: string[];
};

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

  const rootLabels: Record<CommandRootId, string> = useMemo(
    () => ({
      nav: __('Navigate', 'flux-one-command-bar'),
      edit: __('Edit', 'flux-one-command-bar'),
      plugin: __('Plugin', 'flux-one-command-bar'),
      user: __('User', 'flux-one-command-bar'),
      menu: __('Menu', 'flux-one-command-bar'),
      config: __('Config', 'flux-one-command-bar'),
      aggregate: __('Aggregate', 'flux-one-command-bar'),
      summary: __('Summary', 'flux-one-command-bar'),
    }),
    []
  );

  const totalSaved = snap.totalSecondsSaved;
  const hasUsage = totalSaved > 0;
  const commandsUsedCount = useMemo(
    () => countChartedCommands(snap.counts, estimatesSeconds),
    [snap.counts, estimatesSeconds]
  );

  /**
   * @since 1.6.0 Pick the three least-used roots (count ASC, seconds ASC,
   *              original index) so suggestions surface untouched commands first.
   */
  const leastUsed = useMemo(() => {
    const ids = Object.keys(rootLabels) as CommandRootId[];
    return pickLeastUsedRoots(ids, snap.counts, estimatesSeconds, SUGGESTION_LIMIT) as CommandRootId[];
  }, [rootLabels, snap.counts, estimatesSeconds]);

  /**
   * @since 1.6.0 Inline command reference toggle owned by OverviewPage. Replaces
   *              the previous global window event dispatch so welcome and
   *              has-usage CTAs share one piece of scoped React state and the
   *              click is no longer subject to cross-bundle listener races.
   */
  const [showCommandsRef, setShowCommandsRef] = useState<boolean>(false);
  const commandsRefSectionRef = useRef<HTMLDivElement | null>(null);

  const handleViewAllCommands = useCallback(() => {
    setShowCommandsRef((v) => !v);
  }, []);

  useEffect(() => {
    if (!showCommandsRef) return;
    const node = commandsRefSectionRef.current;
    if (!node || typeof node.scrollIntoView !== 'function') return;
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [showCommandsRef]);

  const upsellBullets = useMemo(
    () => [
      __('AI-Powered Email Summaries', 'flux-one-command-bar'),
      __('Advanced Automation and Scheduling', 'flux-one-command-bar'),
      __('CDN Integration for Faster Delivery', 'flux-one-command-bar'),
      __('Premium Features Across All Flux Suite Plugins', 'flux-one-command-bar'),
    ],
    []
  );

  return (
    <OverviewPageLayout
      adminUrl={adminUrl}
      commandsRefSectionRef={commandsRefSectionRef}
      commandsUsedCount={commandsUsedCount}
      estimatesSeconds={estimatesSeconds}
      hasUsage={hasUsage}
      licenseValid={licenseValid}
      leastUsed={leastUsed}
      onViewAllCommands={handleViewAllCommands}
      rootLabels={rootLabels}
      shortcutLabel={shortcutLabel}
      showCommandsRef={showCommandsRef}
      snap={snap}
      totalSaved={totalSaved}
      upsellBullets={upsellBullets}
    />
  );
}

/**
 * Stateless Overview layout for server-rendered structure tests.
 *
 * @since 1.6.0
 */
export function OverviewPageLayout({
  adminUrl,
  commandsRefSectionRef,
  commandsUsedCount,
  estimatesSeconds,
  hasUsage,
  licenseValid,
  leastUsed,
  onViewAllCommands,
  rootLabels,
  shortcutLabel,
  showCommandsRef,
  snap,
  totalSaved,
  upsellBullets,
}: OverviewPageLayoutProps) {
  const mainContent = !hasUsage ? (
    <OverviewWelcome
      commandShortcut={shortcutLabel}
      adminUrl={adminUrl}
      commandsExpanded={showCommandsRef}
      commandsReferenceId={COMMANDS_REFERENCE_ID}
      onViewAllCommands={onViewAllCommands}
    />
  ) : (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <IconBadge>
          <TimerOutlinedIcon />
        </IconBadge>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <AnimatedTimeSaved totalSecondsSaved={totalSaved} commandsUsedCount={commandsUsedCount} />
        </Box>
      </Stack>

      <Divider />

      <OverviewBarChart
        counts={snap.counts}
        estimatesSeconds={estimatesSeconds}
        rootLabels={rootLabels}
        totalSecondsSaved={totalSaved}
      />

      <Divider />

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <IconBadge>
              <LightbulbOutlinedIcon />
            </IconBadge>
            <Typography variant="subtitle2">{__('Don\u2019t forget to try these:', 'flux-one-command-bar')}</Typography>
          </Stack>
          <OverviewSuggestionChips ids={leastUsed} rootLabels={rootLabels} />
        </Box>

        <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-start', sm: 'flex-end' }, flexShrink: 0 }}>
          <Button
            variant="contained"
            size="large"
            endIcon={showCommandsRef ? <ExpandLessIcon /> : <ArrowForwardIcon />}
            onClick={onViewAllCommands}
            aria-expanded={showCommandsRef}
            aria-controls={COMMANDS_REFERENCE_ID}
          >
            {showCommandsRef ? __('Hide commands', 'flux-one-command-bar') : __('View all commands', 'flux-one-command-bar')}
          </Button>
        </Box>
      </Stack>
    </Stack>
  );

  const commandReferenceSection = showCommandsRef ? (
    <>
      <Divider />
      <Box
        ref={commandsRefSectionRef}
        id={COMMANDS_REFERENCE_ID}
        data-flux-one-overview-command-section
      >
        <Stack spacing={2}>
          <Typography variant="h6" component="h2">
            {__('All commands', 'flux-one-command-bar')}
          </Typography>
          <CommandsReferenceList autoFocusSearch />
        </Stack>
      </Box>
    </>
  ) : null;

  const mainColumn = (
    <Paper variant="outlined" sx={{ p: 3 }} data-flux-one-overview-card>
      <Stack spacing={2}>
        {mainContent}
        {commandReferenceSection}
      </Stack>
    </Paper>
  );

  return (
    <Box>
      <Grid container spacing={3} alignItems="flex-start">
        <Grid item xs={12} md={licenseValid ? 12 : 8}>
          {mainColumn}
        </Grid>
        {!licenseValid && (
          <Grid item xs={12} md={4}>
            <UpsellCard intro={__('Unlock Flux One Pro features:', 'flux-one-command-bar')} bullets={upsellBullets} />
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
