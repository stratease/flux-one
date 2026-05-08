import React from 'react';
import { Box, Button, Link, Paper, Stack, Typography } from '@mui/material';
import { __, sprintf } from '@wordpress/i18n';

export type OverviewWelcomeProps = {
  commandShortcut: string;
  adminUrl: string;
};

/**
 * Getting started onboarding (empty-state Overview).
 *
 * @since 1.6.0
 */
export function OverviewWelcome({ commandShortcut, adminUrl }: OverviewWelcomeProps) {
  const docHref = 'https://fluxplugins.com';

  const steps = [
    sprintf(
      /* translators: %s: Keyboard shortcut such as Ctrl+K or ⌘K. */
      __('Press %s from any wp-admin screen.', 'flux-one'),
      commandShortcut
    ),
    __('Type a command like nav posts, plugin update all, or menu list.', 'flux-one'),
    __('Press Enter to run it.', 'flux-one'),
    __('Track your time saved here on the Overview tab.', 'flux-one'),
  ];

  const openCommandBar = () => {
    window.dispatchEvent(new CustomEvent('flux-one-open'));
  };

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h5" component="h2">
          {__('Welcome to Flux One', 'flux-one')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {__('Drive WordPress admin with commands. Less clicking, more doing.', 'flux-one')}
        </Typography>
        <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
          {steps.map((text, i) => (
            <Typography key={i} component="li" variant="body2" sx={{ mb: 1 }}>
              {text}
            </Typography>
          ))}
        </Box>
        <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
          <Button variant="contained" color="primary" onClick={openCommandBar}>
            {__('Open Command Bar', 'flux-one')}
          </Button>
  
          <Link href={docHref} target="_blank" rel="noopener noreferrer" underline="hover">
            {__('View all commands', 'flux-one')}
          </Link>
        </Stack>
      </Stack>
    </Paper>
  );
}
