import React from 'react';
import { Typography, Box, Link } from '@mui/material';
import { __ } from '@wordpress/i18n';

/**
 * Landing tab for the Flux One plugin admin app (Command Bar remains in overlay / dashboard widget).
 */
export function OverviewPage() {
  const adminUrl =
    typeof window !== 'undefined' && window.fluxOneAdmin?.adminUrl
      ? String(window.fluxOneAdmin.adminUrl).replace(/\/?$/, '/')
      : '/wp-admin/';

  return (
    <Box>
      <Typography variant="body1" paragraph>
        {__(
          'Use Command Bar from the dashboard widget or the admin bar to run commands. Configure email aggregation and related options on the Settings tab.',
          'flux-one'
        )}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        <Link href={`${adminUrl}index.php`}>{__('Go to dashboard', 'flux-one')}</Link>
      </Typography>
    </Box>
  );
}
