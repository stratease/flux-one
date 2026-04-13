import React, { useEffect, useId, useRef } from 'react';

type FluxOneModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Optional: focus this element when opening (e.g. close button ref from parent). */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
};

/**
 * Shared modal shell matching Command Central command reference (backdrop + panel + header).
 */
export function FluxOneModal({ open, onClose, title, children, initialFocusRef }: FluxOneModalProps) {
  const titleId = useId();
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    requestAnimationFrame(() => {
      (initialFocusRef?.current ?? closeBtnRef.current)?.focus();
    });
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose, initialFocusRef]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="flux-one-modal-backdrop"
      role="presentation"
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
        className="flux-one-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flux-one-modal-header">
          <h2 id={titleId} style={{ margin: 0, fontSize: 16 }}>
            {title}
          </h2>
          <button ref={closeBtnRef} type="button" className="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="flux-one-modal-body">{children}</div>
      </div>
    </div>
  );
}
