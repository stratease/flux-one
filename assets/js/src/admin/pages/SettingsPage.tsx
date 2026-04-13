import React, { useCallback, useEffect, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { Alert, Box, Button, CircularProgress, FormControlLabel, FormHelperText, Stack, Switch, TextField, Typography } from '@mui/material';

type SettingsShape = {
  emailCaptureEnabled: boolean;
  suppressMailToSelf: boolean;
  aggregateDefaultDays: number;
};

function unwrapData<T>(raw: unknown): T {
  if (raw && typeof raw === 'object' && 'data' in raw && (raw as { data: unknown }).data !== undefined) {
    return (raw as { data: T }).data;
  }
  return raw as T;
}

export function SettingsPage() {
  const [settings, setSettings] = useState<SettingsShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const adminUrl =
    typeof window !== 'undefined' && window.fluxOneAdmin?.adminUrl
      ? String(window.fluxOneAdmin.adminUrl).replace(/\/?$/, '/')
      : '/wp-admin/';
  const licenseUrl = `${adminUrl}admin.php?page=flux-suite-license`;
  const fluxSettingsHash = `${adminUrl}admin.php?page=flux-one#/settings`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await apiFetch({ path: '/flux-one/v1/settings', method: 'GET' });
      setSettings(unwrapData<SettingsShape>(raw));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const raw = await apiFetch({
        path: '/flux-one/v1/settings',
        method: 'PUT',
        data: settings,
      });
      setSettings(unwrapData<SettingsShape>(raw));
      setMessage(__('Saved.', 'flux-one'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" alignItems="center" gap={2} py={2}>
        <CircularProgress size={24} />
        <Typography variant="body2">{__('Loading…', 'flux-one')}</Typography>
      </Box>
    );
  }

  if (!settings) {
    return <Alert severity="error">{error || __('Could not load settings.', 'flux-one')}</Alert>;
  }

  return (
    <Stack spacing={3}>
      {error ? (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <Typography variant="body2" color="text.secondary">
        {__('Manage your Flux Plugins license from the suite license page.', 'flux-one')}{' '}
        <a href={licenseUrl}>{__('Open License', 'flux-one')}</a>
      </Typography>

      <Box>
        <Typography variant="h6" gutterBottom>
          {__('Email aggregation', 'flux-one')}
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          {__(
            'These options apply to your WordPress user only. Email capture logs outbound mail you trigger while logged in, for your Command Central aggregate. Retention follows the plugin cleanup schedule (see README).',
            'flux-one'
          )}
        </Typography>
        <Stack spacing={2} maxWidth={560}>
          <FormControlLabel
            control={
              <Switch
                checked={!!settings.emailCaptureEnabled}
                onChange={(e) => setSettings({ ...settings, emailCaptureEnabled: e.target.checked })}
              />
            }
            label={__('Log outbound email events for my user (off by default)', 'flux-one')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={!!settings.suppressMailToSelf}
                onChange={(e) => setSettings({ ...settings, suppressMailToSelf: e.target.checked })}
              />
            }
            label={__(
              'Remove my account email from To, Cc, and Bcc on outbound messages (others still receive copies)',
              'flux-one'
            )}
          />
          <TextField
            label={__('Default report window (days, 1–30)', 'flux-one')}
            type="number"
            inputProps={{ min: 1, max: 30 }}
            value={settings.aggregateDefaultDays}
            onChange={(e) =>
              setSettings({
                ...settings,
                aggregateDefaultDays: Math.min(30, Math.max(1, Number(e.target.value) || 7)),
              })
            }
            size="small"
            sx={{ maxWidth: 200 }}
          />
        </Stack>
        <FormHelperText sx={{ mt: 1, maxWidth: 640 }}>
          {__(
            'Suppress runs after logging: your addresses are stripped from recipients so you do not receive a copy; the message still goes to everyone else. Use Command Central “aggregate email” to review captured mail.',
            'flux-one'
          )}
        </FormHelperText>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 640 }}>
          {__('This page:', 'flux-one')}{' '}
          <a href={fluxSettingsHash}>{fluxSettingsHash}</a>
        </Typography>
      </Box>

      <Box>
        <Button variant="contained" onClick={() => void save()} disabled={saving}>
          {saving ? __('Saving…', 'flux-one') : __('Save settings', 'flux-one')}
        </Button>
        {message ? (
          <Typography variant="body2" sx={{ mt: 1 }} role="status">
            {message}
          </Typography>
        ) : null}
      </Box>
    </Stack>
  );
}
