import React from 'react';
import type { Suggestion } from '../../command/types';
import { MenuListPanel } from './MenuListPanel';
import { SuiteConfigPanel } from './suite-config/SuiteConfigPanel';

export type StructuredListPanelsProps = {
  structuredPanelRef: React.RefObject<HTMLDivElement | null>;
  panelId: string;
  panelData: unknown;
  adminBase: string;
  executeFromInput: (rawCommand: string, picked?: Suggestion | null) => void;
  /** When set, Lock is hidden for this user id (cannot lock own account). */
  currentUserId?: number;
  /** Suite config row id to focus after open (entity pick). */
  focusedSuiteConfigRowId?: string | null;
};

/**
 * Structured panel rendering for plugins, users, menus, suite_config lists.
 *
 * @since 1.3.0
 * @since 1.4.0 Menus panel delegates to MenuListPanel (tree editor).
 * @since 1.4.0 Users panel omits Lock for currentUserId.
 * @since 1.6.4 Suite config delegates to SuiteConfigPanel (grouped grid + field widgets).
 * @since 1.5.0 Optional focusedSuiteConfigRowId for hybrid entity pick.
 * @since 1.6.3 Removed `sites` structured panel.
 */
export function StructuredListPanels({
  structuredPanelRef,
  panelId,
  panelData,
  adminBase,
  executeFromInput,
  currentUserId,
  focusedSuiteConfigRowId,
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
                    onClick={() => executeFromInput(`plugin activate ${p.pluginFile}`)}
                  >
                    Activate
                  </button>
                ) : null}
                {p.active ? (
                  <button
                    type="button"
                    className="flux-one-btn-small"
                    onClick={() => executeFromInput(`plugin deactivate ${p.pluginFile}`)}
                  >
                    Deactivate
                  </button>
                ) : null}
                {p.updateAvailable ? (
                  <button
                    type="button"
                    className="flux-one-btn-small"
                    onClick={() => executeFromInput(`plugin update ${p.pluginFile}`)}
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
                {currentUserId == null || u.id !== currentUserId ? (
                  <button type="button" className="flux-one-btn-small" onClick={() => executeFromInput(`user lock ${u.email}`)}>
                    Lock
                  </button>
                ) : null}
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

  if (panelId === 'menus') {
    return <MenuListPanel structuredPanelRef={structuredPanelRef} menus={panelData as any[]} adminBase={adminBase} />;
  }

  if (panelId === 'suite_config') {
    return (
      <SuiteConfigPanel
        structuredPanelRef={structuredPanelRef}
        rows={panelData as any[]}
        executeFromInput={executeFromInput}
        focusedRowId={focusedSuiteConfigRowId}
      />
    );
  }

  return null;
}
