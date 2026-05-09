import React, { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { DEV_UI_REGISTRY } from './registry';

function isDevEnabled(): boolean {
  return typeof window !== 'undefined' && (window as any).fluxOneAdmin?.isDev === true;
}

function ComponentCard({
  name,
  file,
  children,
}: {
  name: string;
  file: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: 16, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{name}</div>
        <code style={{ fontSize: 12, opacity: 0.85 }}>{file}</code>
      </div>
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  );
}

/**
 * Dev-only UI design guide / component demo page.
 *
 * @since 1.8.0
 */
export function DevUiPage() {
  const enabled = isDevEnabled();

  const items = useMemo(() => DEV_UI_REGISTRY, []);

  if (!enabled) {
    return <Navigate to="/overview" replace />;
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="notice notice-info inline" style={{ margin: 0 }}>
        <p style={{ margin: 0 }}>
          Dev-only UI design guide. Visible only when WP_DEBUG and SCRIPT_DEBUG are enabled.
        </p>
      </div>
      <div style={{ display: 'grid', gap: 16 }}>
        {items.map((it) => (
          <ComponentCard key={`${it.name}-${it.file}`} name={it.name} file={it.file}>
            {it.render()}
          </ComponentCard>
        ))}
      </div>
    </div>
  );
}

export { isDevEnabled };

