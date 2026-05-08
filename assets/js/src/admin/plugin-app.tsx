import { createRoot } from 'react-dom/client';
import React, { useEffect } from 'react';
import { PluginApp } from './PluginApp';
import { startHeartbeat } from './heartbeat';
import { initUsageStoreFromWindow } from './usage-store';

function PluginAppWithHeartbeat() {
  useEffect(() => {
    initUsageStoreFromWindow();
    return startHeartbeat();
  }, []);
  return <PluginApp />;
}

const rootEl = document.getElementById('flux-one-plugin-app');
if (rootEl) {
  createRoot(rootEl).render(<PluginAppWithHeartbeat />);
}
