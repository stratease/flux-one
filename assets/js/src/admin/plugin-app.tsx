import { createRoot } from 'react-dom/client';
import React, { useEffect } from 'react';
import { PluginApp } from './PluginApp';
import { startHeartbeat } from './heartbeat';
import { initUsageStoreFromWindow } from './usage-store';
import './theme-tokens.css';
import './style.css';

function PluginAppWithHeartbeat() {
  useEffect(() => {
    initUsageStoreFromWindow();
    return startHeartbeat();
  }, []);
  return (
    <div className="flux-one-theme">
      <PluginApp />
    </div>
  );
}

const rootEl = document.getElementById('flux-one-plugin-app');
if (rootEl) {
  createRoot(rootEl).render(<PluginAppWithHeartbeat />);
}
