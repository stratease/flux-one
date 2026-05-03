import React, { useEffect, useId, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

type FluxOneModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Panel width preset; `wide` matches aggregate email layout. */
  size?: 'default' | 'wide';
  /** Optional extra class on dialog panel. */
  className?: string;
  /** Optional: focus this element when opening (e.g. close button ref from parent). */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
};

/**
 * Shared modal shell matching Command Central command reference (backdrop + panel + header).
 */
export function FluxOneModal({
  open,
  onClose,
  title,
  children,
  size = 'default',
  className,
  initialFocusRef,
}: FluxOneModalProps) {
  const titleId = useId();
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const portalTarget = useMemo(() => (typeof document !== 'undefined' ? document.body : null), []);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const panelClassName = useMemo(
    () => ['flux-one-modal', size === 'wide' ? 'flux-one-modal--wide' : '', className].filter(Boolean).join(' '),
    [size, className]
  );

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = (typeof document !== 'undefined' ? (document.activeElement as any) : null) as
      | HTMLElement
      | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    requestAnimationFrame(() => {
      (initialFocusRef?.current ?? closeBtnRef.current)?.focus();
    });
    return () => {
      window.removeEventListener('keydown', onKey, true);
      requestAnimationFrame(() => {
        restoreFocusRef.current?.focus?.();
      });
    };
  }, [open, onClose, initialFocusRef]);

  if (!open) {
    return null;
  }

  const modal = (
    <div
      className="flux-one-theme flux-one-modal-backdrop"
      role="presentation"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={panelClassName}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flux-one-modal-header">
          <h2 id={titleId} className="flux-one-modal-title">
            {title}
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="flux-one-modal-close"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <span className="dashicons dashicons-no" aria-hidden />
          </button>
        </div>
        <div className="flux-one-modal-body">{children}</div>
      </div>
    </div>
  );

  // Portal to <body> so fixed backdrop isn't trapped by wp-admin stacking contexts/transforms.
  return portalTarget ? createPortal(modal, portalTarget) : modal;
}
