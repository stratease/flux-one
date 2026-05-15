import React, { useCallback, useEffect, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { Alert, Box, Button, CircularProgress, FormControlLabel, FormHelperText, Stack, Switch, TextField, Typography } from '@mui/material';

type SettingsShape = {
  emailCaptureEnabled: boolean;
  suppressMailToSelf: boolean;
  commandShortcut?: string;
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
  const [recordingShortcut, setRecordingShortcut] = useState(false);

  const isMac = typeof navigator !== 'undefined' ? /Mac|iPhone|iPad|iPod/i.test(navigator.platform) : false;

  const normalizeShortcut = (raw: string): string => {
    const s = String(raw || '').toLowerCase().trim();
    if (!s) return 'mod+.';
    const parts = s.split('+').map((p) => p.trim()).filter(Boolean);
    const mods: string[] = [];
    let key = '';
    for (const p of parts) {
      if (['mod', 'shift', 'alt', 'option'].includes(p)) {
        mods.push(p === 'option' ? 'alt' : p);
        continue;
      }
      if (!key) key = p;
    }
    if (!key) key = '.';
    const uniq = Array.from(new Set(mods));
    uniq.sort();
    let out = [...uniq, key].join('+');
    if (!out.includes('mod+')) out = `mod+${out}`;
    return out;
  };

  const shortcutLabel = (raw: string): string => {
    const s = normalizeShortcut(raw);
    const parts = s.split('+').map((p) => p.trim()).filter(Boolean);
    const hasMod = parts.includes('mod');
    const hasShift = parts.includes('shift');
    const hasAlt = parts.includes('alt');
    const key = parts.find((p) => !['mod', 'shift', 'alt'].includes(p)) || '.';
    const mod = hasMod ? (isMac ? '⌘' : 'Ctrl') : '';
    const shift = hasShift ? (isMac ? '⇧' : 'Shift') : '';
    const alt = hasAlt ? (isMac ? '⌥' : 'Alt') : '';
    const k = key.length === 1 ? key.toUpperCase() : key;
    const chunks = [mod, shift, alt, k].filter(Boolean);
    return isMac ? chunks.join('') : chunks.join('+');
  };

  const captureShortcutFromEvent = (e: React.KeyboardEvent<HTMLElement>): string | null => {
    const k = String(e.key || '').toLowerCase();
    if (['shift', 'alt', 'meta', 'control'].includes(k)) {
      return null;
    }
    if (!(e.ctrlKey || e.metaKey)) {
      return null;
    }
    const mods: string[] = ['mod'];
    if (e.shiftKey) mods.push('shift');
    if (e.altKey) mods.push('alt');
    const key = k === ' ' ? 'space' : k;
    return normalizeShortcut([...mods, key].join('+'));
  };

  const adminUrl =
    typeof window !== 'undefined' && window.fluxOneAdmin?.adminUrl
      ? String(window.fluxOneAdmin.adminUrl).replace(/\/?$/, '/')
      : '/wp-admin/';
  const licenseUrl = `${adminUrl}admin.php?page=flux-suite-license`;

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
      setMessage(__('Saved.', 'flux-one-command-bar'));
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
        <Typography variant="body2">{__('Loading…', 'flux-one-command-bar')}</Typography>
      </Box>
    );
  }

  if (!settings) {
    return <Alert severity="error">{error || __('Could not load settings.', 'flux-one-command-bar')}</Alert>;
  }

  return (
    <Stack spacing={3}>
      {error ? (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <Typography variant="body2" color="text.secondary">
        {__('Manage your Flux Plugins license from the', 'flux-one-command-bar')}{' '}
        <a href={licenseUrl}>{__('suite license page', 'flux-one-command-bar')}</a>.
      </Typography>
 

      <Box>
        <Typography variant="h6" gutterBottom>
          {__('Email aggregation', 'flux-one-command-bar')}
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          {__(
            'These options apply to your user only. Review captured mail from the Command Bar with command:',
            'flux-one-command-bar'
          )}{' '}
          <Box
            component="code"
            sx={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: '0.9em',
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              bgcolor: 'action.hover',
            }}
          >
            {__('aggregate email', 'flux-one-command-bar')}
          </Box>
          .
        </Typography>
        <Stack spacing={2} maxWidth={560}>
          <FormControlLabel
            control={
              <Switch
                checked={!!settings.emailCaptureEnabled}
                onChange={(e) => setSettings({ ...settings, emailCaptureEnabled: e.target.checked })}
              />
            }
            label={__('Log outbound email events', 'flux-one-command-bar')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={!!settings.suppressMailToSelf}
                onChange={(e) => setSettings({ ...settings, suppressMailToSelf: e.target.checked })}
              />
            }
            label={__(
              'Suppress all outbound emails to my user',
              'flux-one-command-bar'
            )}
          />
        </Stack>
        <FormHelperText sx={{ mt: 1, maxWidth: 640 }}>
          {__(
            'Suppress runs after logging: your addresses are stripped from recipients so you do not receive a copy; the message still goes to everyone else. Use Command Bar “aggregate email” to review captured mail.',
            'flux-one-command-bar'
          )}
        </FormHelperText>
      </Box>

      <Box>
        <Typography variant="h6" gutterBottom>
          {__('Command widget', 'flux-one-command-bar')}
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          {__(
            'Configure the keyboard shortcut for the Flux One Command widget (overlay). Default is Ctrl/Cmd+.',
            'flux-one-command-bar'
          )}
        </Typography>
        <Stack spacing={2} maxWidth={560}>
          <TextField
            label={__('Record shortcut', 'flux-one-command-bar')}
            value={recordingShortcut ? __('Press keys…', 'flux-one-command-bar') : shortcutLabel(settings.commandShortcut || 'mod+.')}
            size="small"
            helperText={`${__(
              'Format: mod+key',
              'flux-one-command-bar'
            )}`}
            onFocus={() => setRecordingShortcut(true)}
            onBlur={() => setRecordingShortcut(false)}
            onKeyDown={(e) => {
              if (!recordingShortcut) return;
              const s = captureShortcutFromEvent(e);
              if (!s) return;
              e.preventDefault();
              setSettings({ ...settings, commandShortcut: s });
              setRecordingShortcut(false);
            }}
            inputProps={{ readOnly: true }}
          />
        </Stack>
      </Box>

      <Box>
        <Button variant="contained" onClick={() => void save()} disabled={saving}>
          {saving ? __('Saving…', 'flux-one-command-bar') : __('Save settings', 'flux-one-command-bar')}
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
