import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Box, Tab, Tabs } from '@mui/material';
import { __ } from '@wordpress/i18n';
import { FluxAppProvider, PageLayout } from '@flux-plugins-common/components';
import { OverviewPage } from './pages/OverviewPage';
import { SettingsPage } from './pages/SettingsPage';

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

  const tabIndex =
    location.pathname === '/settings' ? 1 : 0;

  const handleChange = (_: React.SyntheticEvent, newValue: number) => {
    navigate(newValue === 0 ? '/overview' : '/settings');
  };

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
      <Tabs value={tabIndex} onChange={handleChange} aria-label={__('Flux One navigation', 'flux-one')}>
        <Tab label={__('Overview', 'flux-one')} />
        <Tab label={__('Settings', 'flux-one')} />
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
