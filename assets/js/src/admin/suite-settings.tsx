import { createRoot } from 'react-dom/client';
import React, { useState } from 'react';
import { FluxOneSettingsTab } from './FluxOneSettingsTab';

type TabDef = { component: string; label: string };

declare global {
  interface Window {
    fluxOneSuiteSettings?: {
      tabs: TabDef[];
      apiUrl: string;
      nonce: string;
    };
  }
}

function SuiteSettingsApp() {
  const cfg = window.fluxOneSuiteSettings;
  const tabs = cfg?.tabs?.length ? cfg.tabs : [];
  const [active, setActive] = useState(0);

  if (!tabs.length) {
    return <p style={{ fontSize: 13 }}>No settings tabs registered.</p>;
  }

  const current = tabs[active];

  return (
    <div className="flux-one-suite-settings" style={{ marginTop: 16 }}>
      <div
        role="tablist"
        aria-label="Flux Suite settings"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, borderBottom: '1px solid #c3c4c7', paddingBottom: 8 }}
      >
        {tabs.map((t, i) => (
          <button
            key={`${t.component}-${i}`}
            type="button"
            role="tab"
            aria-selected={i === active}
            className={i === active ? 'button button-primary' : 'button'}
            onClick={() => setActive(i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {current?.component === 'FluxOneSettingsTab' ? (
          <FluxOneSettingsTab />
        ) : (
          <p style={{ fontSize: 13, opacity: 0.8 }}>Unknown tab: {current?.component}</p>
        )}
      </div>
    </div>
  );
}

const rootEl = document.getElementById('flux-suite-settings-app');
if (rootEl) {
  createRoot(rootEl).render(<SuiteSettingsApp />);
}
