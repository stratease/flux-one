import React from 'react';

export type CommandCentralHeaderProps = {
  label: string;
  kind: 'overlay' | 'dashboardWidget' | 'dev';
  commandsModalTriggerRef: React.RefObject<HTMLButtonElement | null>;
  onOpenCommandReference: () => void;
  onCloseOverlay: () => void;
};

/**
 * Command Central header with reference trigger and overlay close.
 *
 * @since 1.3.0
 */
export function CommandCentralHeader({
  label,
  kind,
  commandsModalTriggerRef,
  onOpenCommandReference,
  onCloseOverlay,
}: CommandCentralHeaderProps) {
  return (
    <div className="flux-one-header">
      <strong>{label}</strong>
      <span className="flux-one-header-actions">
        <button
          ref={commandsModalTriggerRef}
          type="button"
          className="flux-one-command-reference-trigger flux-one-icon-btn"
          onClick={onOpenCommandReference}
          aria-label="Command reference"
          title="Command reference"
        >
          <span className="dashicons dashicons-info" aria-hidden />
        </button>
        {kind === 'overlay' ? (
          <button type="button" className="flux-one-overlay-close-btn" onClick={onCloseOverlay} aria-label="Close" title="Close">
            <span className="dashicons dashicons-no" aria-hidden />
          </button>
        ) : null}
      </span>
    </div>
  );
}
