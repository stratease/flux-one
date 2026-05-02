import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CommandCentralMount } from '../ui/CommandCentralMount';
import './theme-tokens.css';
import './style.css';

declare global {
  interface Window {
    fluxOneAdmin?: {
      apiUrl: string;
      nonce: string;
      adminUrl: string;
      pluginUrl: string;
      version: string;
      features: Record<string, { enabled: boolean }>;
      bootstrap?: unknown;
    };
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
      gcTime: 10 * 60_000,
    },
  },
});

function mountIfPresent(elementId: string, kind: 'overlay' | 'dashboardWidget' | 'dev') {
  const el = document.getElementById(elementId);
  if (!el) return;

  const root = createRoot(el);
  root.render(
    <QueryClientProvider client={queryClient}>
      <CommandCentralMount kind={kind} />
    </QueryClientProvider>
  );
}

// Dev-only HTML page mount.
mountIfPresent('flux-one-admin-dev-root', 'dev');

// WordPress mounts (added by PHP).
mountIfPresent('flux-one-command-central-root', 'overlay');
mountIfPresent('flux-one-dashboard-widget-root', 'dashboardWidget');

