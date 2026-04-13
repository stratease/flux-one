import { createRoot } from 'react-dom/client';
import React from 'react';
import { PluginApp } from './PluginApp';

const rootEl = document.getElementById('flux-one-plugin-app');
if (rootEl) {
  createRoot(rootEl).render(<PluginApp />);
}
