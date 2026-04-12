import React, { useCallback, useEffect, useState } from 'react';
import { EmailAggregateView, type EmailAggregatePayload } from '../ui/EmailAggregateView';

type SettingsShape = {
  emailCaptureEnabled: boolean;
  suppressMailToSelf: boolean;
  aggregateDefaultDays: number;
};

declare global {
  interface Window {
    fluxOneSuiteSettings?: {
      tabs: { component: string; label: string }[];
      apiUrl: string;
      nonce: string;
    };
  }
}

async function restJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cfg = window.fluxOneSuiteSettings;
  if (!cfg?.apiUrl || !cfg?.nonce) {
    throw new Error('Missing Flux One suite settings bootstrap');
  }
  const base = cfg.apiUrl.replace(/\/?$/, '/');
  const url = base + path.replace(/^\//, '');
  const res = await fetch(url, {
    ...init,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce': cfg.nonce,
      ...(init.headers || {}),
    },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.message || res.statusText);
  }
  return (json?.data ?? json) as T;
}

export function FluxOneSettingsTab() {
  const [settings, setSettings] = useState<SettingsShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<EmailAggregatePayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await restJson<SettingsShape>('settings', { method: 'GET' });
      setSettings(data);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
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
    try {
      const data = await restJson<SettingsShape>('settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      setSettings(data);
      setMessage('Saved.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const loadPreview = async () => {
    const days = settings?.aggregateDefaultDays ?? 7;
    try {
      const raw = await restJson<unknown>(`aggregate/email?days=${encodeURIComponent(String(days))}`, {
        method: 'GET',
      });
      setPreview((raw as EmailAggregatePayload) || null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading || !settings) {
    return <p style={{ fontSize: 13 }}>Loading…</p>;
  }

  return (
    <div className="flux-one-flux-one-settings-tab" style={{ maxWidth: 720 }}>
      <h2 style={{ fontSize: 16, marginTop: 0 }}>Flux One</h2>
      <p style={{ fontSize: 13, opacity: 0.85 }}>
        Email capture logs outbound <code>wp_mail</code> for the Command Central aggregate. Retention follows the plugin cleanup schedule (see README).
      </p>

      <fieldset style={{ border: '1px solid #c3c4c7', padding: 12, marginBottom: 16 }}>
        <legend style={{ fontWeight: 600, padding: '0 6px' }}>Email aggregation</legend>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={settings.emailCaptureEnabled}
            onChange={(e) => setSettings({ ...settings, emailCaptureEnabled: e.target.checked })}
          />
          Log outbound email events (disable to skip database logging)
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={settings.suppressMailToSelf}
            onChange={(e) => setSettings({ ...settings, suppressMailToSelf: e.target.checked })}
          />
          Suppress delivery when the message is addressed to the current admin user (still logged for the aggregate)
        </label>
        <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
          Default report window (days, 1–30)
          <input
            type="number"
            min={1}
            max={30}
            value={settings.aggregateDefaultDays}
            onChange={(e) =>
              setSettings({ ...settings, aggregateDefaultDays: Math.min(30, Math.max(1, Number(e.target.value) || 7)) })
            }
            style={{ marginLeft: 8, width: 64 }}
          />
        </label>
      </fieldset>

      <p style={{ fontSize: 12, opacity: 0.75 }}>
        “Suppress delivery to current user” uses <code>pre_wp_mail</code> after logging; it affects all matching messages site-wide while enabled, not only Command Central.
      </p>

      <p>
        <button type="button" className="button button-primary" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </p>

      {message ? (
        <p style={{ fontSize: 13 }} role="status">
          {message}
        </p>
      ) : null}

      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 14 }}>Preview aggregate</h3>
        <p>
          <button type="button" className="button" onClick={() => void loadPreview()}>
            Load preview
          </button>
        </p>
        {preview ? <EmailAggregateView data={preview} /> : null}
      </div>
    </div>
  );
}
