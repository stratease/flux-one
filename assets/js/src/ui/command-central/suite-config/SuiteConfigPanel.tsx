import React, { useLayoutEffect, useMemo } from 'react';
import type { Suggestion } from '../../../command/types';
import type { SuiteConfigRow } from './types';
import { SuiteConfigField } from './SuiteConfigField';

export type SuiteConfigPanelProps = {
  structuredPanelRef: React.RefObject<HTMLDivElement | null>;
  rows: SuiteConfigRow[];
  executeFromInput: (rawCommand: string, picked?: Suggestion | null) => void;
  /** Focus primary control for this config id after mount / data merge (hybrid entity pick). */
  focusedRowId?: string | null;
};

/**
 * Grouped, grid-aligned suite configuration list for Command Bar panel.
 *
 * @since 1.6.4
 * @since 1.5.0 Supports focusedRowId for accessibility after entity pick.
 */
export function SuiteConfigPanel({
  structuredPanelRef,
  rows,
  executeFromInput,
  focusedRowId,
}: SuiteConfigPanelProps) {
  useLayoutEffect(() => {
    if (!focusedRowId || typeof window === 'undefined') {
      return;
    }
    const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(focusedRowId) : focusedRowId.replace(/"/g, '\\"');
    requestAnimationFrame(() => {
      const root = structuredPanelRef.current;
      if (!root) {
        return;
      }
      const scope = root.querySelector(`[data-flux-config-row="${esc}"]`);
      if (!scope) {
        return;
      }
      const focusable = scope.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), select:not([disabled]), button:not([disabled])'
      );
      focusable?.focus();
    });
  }, [focusedRowId, rows, structuredPanelRef]);

  const sections = useMemo(() => {
    const out: { groupLabel: string; groupOrder: number; items: SuiteConfigRow[] }[] = [];
    let cur = '';
    for (const row of rows) {
      const gl = row.groupLabel || 'Configuration';
      const go = typeof row.groupOrder === 'number' ? row.groupOrder : 0;
      if (gl !== cur) {
        cur = gl;
        out.push({ groupLabel: gl, groupOrder: go, items: [] });
      }
      out[out.length - 1].items.push(row);
    }
    return out;
  }, [rows]);

  return (
    <div ref={structuredPanelRef} className="flux-one-structured-results">
      <div className="flux-one-structured-panel flux-one-structured-panel--suite">
        <div className="flux-one-structured-panel-title">Suite configuration</div>
        <div className="flux-one-suite-config-scroll">
          <div className="flux-one-suite-config-grid-root">
            <div className="flux-one-suite-config-head flux-one-suite-config-head--sticky" aria-hidden="true">
              Setting
            </div>
            <div className="flux-one-suite-config-head flux-one-suite-config-head--sticky" aria-hidden="true">
              Source
            </div>
            <div className="flux-one-suite-config-head flux-one-suite-config-head--sticky" aria-hidden="true">
              Type
            </div>
            <div className="flux-one-suite-config-head flux-one-suite-config-head--sticky" aria-hidden="true">
              Value
            </div>
            <div className="flux-one-suite-config-head flux-one-suite-config-head--sticky" aria-hidden="true">
              Actions
            </div>
            {sections.map((sec) => (
              <React.Fragment key={`${sec.groupLabel}-${sec.groupOrder}`}>
                <div
                  className="flux-one-suite-config-section-label flux-one-email-list-section-label"
                  style={{ gridColumn: '1 / -1' }}
                >
                  {sec.groupLabel}
                </div>
                {sec.items.map((row) => (
                  <React.Fragment key={row.id}>
                    <div className="flux-one-suite-config-cell flux-one-suite-config-cell--label" title={`Config id: ${row.id}`}>
                      <span className="flux-one-suite-config-label-text">{row.label}</span>
                    </div>
                    <div className="flux-one-suite-config-cell flux-one-suite-config-cell--meta">{row.plugin}</div>
                    <div className="flux-one-suite-config-cell flux-one-suite-config-cell--type">{row.type}</div>
                    <div className="flux-one-suite-config-cell flux-one-suite-config-cell--value">
                      {row.valuePending ? (
                        <span className="flux-one-muted-loading">Loading current value…</span>
                      ) : (
                        row.valueDisplay
                      )}
                    </div>
                    <div className="flux-one-suite-config-cell flux-one-suite-config-cell--actions">
                      <span className="flux-one-structured-actions">
                        <SuiteConfigField row={row} executeFromInput={executeFromInput} />
                      </span>
                    </div>
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
