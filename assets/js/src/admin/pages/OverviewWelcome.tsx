import React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import TerminalIcon from '@mui/icons-material/Terminal';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { __, sprintf } from '@wordpress/i18n';

export type OverviewWelcomeProps = {
  commandShortcut: string;
  adminUrl: string;
  commandsExpanded: boolean;
  commandsReferenceId: string;
  /**
   * Toggle the inline command reference panel on the parent OverviewPage.
   *
   * @since 1.6.0 Replaced the previous global window dispatch path so the
   *              welcome card reuses the parent's scoped state instead of
   *              relying on a cross-bundle event listener.
   */
  onViewAllCommands: () => void;
};

/**
 * Getting started onboarding (empty-state Overview).
 *
 * @since 1.6.0
 */
export function OverviewWelcome({
  commandShortcut,
  adminUrl,
  commandsExpanded,
  commandsReferenceId,
  onViewAllCommands,
}: OverviewWelcomeProps) {
  const openCommandBar = () => {
    const w = window as any;
    if (typeof window !== 'undefined' && typeof w.fluxOneOpenOverlay === 'function') {
      void w.fluxOneOpenOverlay();
      return;
    }
    window.dispatchEvent(new Event('flux-one-open'));
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h5" component="h2">
        {__('Welcome to Flux One', 'flux-one')}
      </Typography>
      <Typography variant="body1" color="text.secondary">
        {__('Drive WordPress admin with commands. Less clicking, more doing.', 'flux-one')}
      </Typography>

      <Stack spacing={2}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Box sx={{ pt: 0.25, color: 'primary.main' }}>
            <TerminalIcon fontSize="medium" />
          </Box>
          <Box>
            <Typography variant="subtitle1">{__('Open the command bar', 'flux-one')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {sprintf(
                /* translators: %s: Keyboard shortcut such as Ctrl+. or ⌘. */
                __('Press %s from any wp-admin screen.', 'flux-one'),
                commandShortcut
              )}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Box sx={{ pt: 0.25, color: 'primary.main' }}>
            <KeyboardIcon fontSize="medium" />
          </Box>
          <Box>
            <Typography variant="subtitle1">{__('Type a command', 'flux-one')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {__('Try: nav posts, plugin update all, or menu list.', 'flux-one')}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Box sx={{ pt: 0.25, color: 'primary.main' }}>
            <PlayArrowIcon fontSize="medium" />
          </Box>
          <Box>
            <Typography variant="subtitle1">{__('Run it', 'flux-one')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {__('Press Enter to execute the command.', 'flux-one')}
            </Typography>
          </Box>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
        <Button variant="contained" color="primary" onClick={openCommandBar}>
          {__('Open Command Bar', 'flux-one')}
        </Button>
        <Button
          variant="text"
          onClick={onViewAllCommands}
          aria-expanded={commandsExpanded}
          aria-controls={commandsReferenceId}
        >
          {commandsExpanded ? __('Hide commands', 'flux-one') : __('View all commands', 'flux-one')}
        </Button>
      </Stack>
    </Stack>
  );
}
