import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Box, Tab, Tabs } from '@mui/material';
import { __ } from '@wordpress/i18n';
import { FluxAppProvider, PageLayout } from '@flux-plugins-common/components';
import { OverviewPage } from './pages/OverviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { DevUiPage } from './dev-ui/DevUiPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();

  const isDev =
    typeof window !== 'undefined' && (window as any).fluxOneAdmin?.isDev === true;

  const tabIndex = (() => {
    if (location.pathname === '/settings') return 1;
    if (location.pathname === '/dev-ui' && isDev) return 2;
    return 0;
  })();

  const handleChange = (_: React.SyntheticEvent, newValue: number) => {
    if (newValue === 0) {
      navigate('/overview');
      return;
    }
    if (newValue === 1) {
      navigate('/settings');
      return;
    }
    if (newValue === 2 && isDev) {
      navigate('/dev-ui');
    }
  };

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
      <Tabs value={tabIndex} onChange={handleChange} aria-label={__('Flux One navigation', 'flux-one')}>
        <Tab label={__('Overview', 'flux-one')} />
        <Tab label={__('Settings', 'flux-one')} />
        {isDev ? <Tab label={__('Dev UI', 'flux-one')} /> : null}
      </Tabs>
    </Box>
  );
}

function AppRoutes() {
  return (
    <>
      <Navigation />
      <Routes>
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/dev-ui" element={<DevUiPage />} />
        <Route path="/" element={<Navigate to="/overview" replace />} />
      </Routes>
    </>
  );
}

/**
 * Flux One plugin admin (Flux Suite submenu): HashRouter + shared PageLayout, aligned with flux-media-optimizer.
 */
export function PluginApp() {
  React.useEffect(() => {
    const el = document.getElementById('flux-one-plugin-app');
    const initialHash = el?.dataset.initialHash;
    if (!initialHash) {
      return;
    }
    const hash = initialHash.startsWith('#') ? initialHash.slice(1) : initialHash;
    if (window.location.hash.replace(/^#/, '') !== hash) {
      window.location.hash = hash;
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <FluxAppProvider>
        <HashRouter>
          <PageLayout title={__('Flux One', 'flux-one')} maxWidth="lg">
            <AppRoutes />
          </PageLayout>
        </HashRouter>
      </FluxAppProvider>
    </QueryClientProvider>
  );
}
