import React from 'react';
import type { Suggestion } from '../../command/types';

export type StructuredListPanelsProps = {
  structuredPanelRef: React.RefObject<HTMLDivElement | null>;
  panelId: string;
  panelData: unknown;
  adminBase: string;
  executeFromInput: (rawCommand: string, picked?: Suggestion | null) => void;
};

/**
 * Structured panel rendering for plugins, users, sites, menus, suite_config lists.
 *
 * @since 1.3.0
 */
export function StructuredListPanels({
  structuredPanelRef,
  panelId,
  panelData,
  adminBase,
  executeFromInput,
}: StructuredListPanelsProps) {
  if (!Array.isArray(panelData)) {
    return null;
  }

  if (panelId === 'plugins') {
    return (
      <div ref={structuredPanelRef} className="flux-one-structured-results">
        <div className="flux-one-structured-panel">
          <div className="flux-one-structured-panel-title">Plugins</div>
          {(panelData as any[]).map((p) => (
            <div key={p.pluginFile} className="flux-one-structured-row">
              <span className="flux-one-structured-cell-grow">{p.name}</span>
              <span className="flux-one-structured-meta">
                {p.active ? 'Active' : 'Inactive'}
                {p.updateAvailable ? ' · Update available' : ''}
              </span>
              <span className="flux-one-structured-actions">
                {!p.active ? (
                  <button
                    type="button"
                    className="flux-one-btn-small"
                    onClick={() => executeFromInput(`plugin activate ${p.name}`)}
                  >
                    Activate
                  </button>
                ) : null}
                {p.active ? (
                  <button
                    type="button"
                    className="flux-one-btn-small"
                    onClick={() => executeFromInput(`plugin deactivate ${p.name}`)}
                  >
                    Deactivate
                  </button>
                ) : null}
                {p.updateAvailable ? (
                  <button
                    type="button"
                    className="flux-one-btn-small"
                    onClick={() => executeFromInput(`plugin update ${p.name}`)}
                  >
                    Update
                  </button>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (panelId === 'users') {
    return (
      <div ref={structuredPanelRef} className="flux-one-structured-results">
        <div className="flux-one-structured-panel">
          <div className="flux-one-structured-panel-title">Users</div>
          {(panelData as any[]).map((u) => (
            <div key={u.id} className="flux-one-structured-row">
              <span className="flux-one-structured-cell-grow-wide">{u.email}</span>
              <span className="flux-one-structured-meta">{u.displayName || ''}</span>
              <span className="flux-one-structured-actions-tight">
                <button type="button" className="flux-one-btn-small" onClick={() => executeFromInput(`user lock ${u.email}`)}>
                  Lock
                </button>
                <button type="button" className="flux-one-btn-small" onClick={() => executeFromInput(`user unlock ${u.email}`)}>
                  Unlock
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (panelId === 'sites') {
    return (
      <div ref={structuredPanelRef} className="flux-one-structured-results">
        <div className="flux-one-structured-panel">
          <div className="flux-one-structured-panel-title">Sites</div>
          {(panelData as any[]).map((s) => (
            <div key={s.blogId} className="flux-one-structured-row">
              <span className="flux-one-structured-cell-grow-wide">{`${s.domain}${s.path}`}</span>
              <span className="flux-one-structured-meta">#{s.blogId}</span>
              <button type="button" className="flux-one-btn-small" onClick={() => executeFromInput(`site switch ${s.domain}${s.path}`)}>
                Switch
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (panelId === 'menus') {
    return (
      <div ref={structuredPanelRef} className="flux-one-structured-results">
        <div className="flux-one-structured-panel">
          <div className="flux-one-structured-panel-title">Menus</div>
          {(panelData as any[]).map((m) => (
            <div key={m.id} className="flux-one-structured-row">
              <span className="flux-one-structured-cell-grow">{m.name}</span>
              <span className="flux-one-structured-meta">{m.slug || ''}</span>
              <button
                type="button"
                className="flux-one-btn-small"
                onClick={() =>
                  window.open(`${adminBase}nav-menus.php?action=edit&menu=${encodeURIComponent(String(m.id))}`, '_blank')
                }
              >
                Edit in admin
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (panelId === 'suite_config') {
    return (
      <div ref={structuredPanelRef} className="flux-one-structured-results">
        <div className="flux-one-structured-panel flux-one-structured-panel--suite">
          <div className="flux-one-structured-panel-title">Suite configuration</div>
          {(panelData as any[]).map((row) => (
            <div key={row.id} className="flux-one-structured-row flux-one-structured-row--suite">
              <span className="flux-one-structured-cell-2" title={`Config id: ${row.id}`}>
                {row.label}
              </span>
              <span className="flux-one-structured-suite-plugin">{row.plugin}</span>
              <span className="flux-one-structured-suite-type">{row.type}</span>
              <span className="flux-one-structured-suite-value">{row.valueDisplay}</span>
              <span className="flux-one-structured-actions">
                {row.type === 'bool' ? (
                  <>
                    <button type="button" className="flux-one-btn-small" onClick={() => executeFromInput(`config set ${row.id} true`)}>
                      Set true
                    </button>
                    <button type="button" className="flux-one-btn-small" onClick={() => executeFromInput(`config set ${row.id} false`)}>
                      Set false
                    </button>
                  </>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
