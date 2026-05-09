import React, { useEffect, useMemo, useRef, useState } from 'react';
import { filterCommandDocs } from '../command/commandDocs';
import './CommandsReferenceList.css';

export type CommandsReferenceListProps = {
  /** Focus the search input on mount. */
  autoFocusSearch?: boolean;
  /** Initial filter query (uncontrolled). */
  defaultQuery?: string;
  /** Optional id forwarded to the search input for label association. */
  searchInputId?: string;
};

/**
 * Reusable command reference list (search + filtered rows).
 *
 * SSOT for filter logic stays in `commandDocs.ts`; this component owns only
 * presentation + local query state. Plain HTML + class-based CSS so it can
 * render inside both the Command Bar overlay (no MUI) and the plugin app.
 *
 * @since 1.6.0
 */
export function CommandsReferenceList({
  autoFocusSearch = false,
  defaultQuery = '',
  searchInputId,
}: CommandsReferenceListProps) {
  const [query, setQuery] = useState<string>(defaultQuery);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => filterCommandDocs(query), [query]);

  useEffect(() => {
    if (!autoFocusSearch) return;
    const el = inputRef.current;
    if (!el) return;
    const raf = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame(() => el.focus())
      : (setTimeout(() => el.focus(), 0) as unknown as number);
    return () => {
      if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(raf);
      } else {
        clearTimeout(raf as unknown as ReturnType<typeof setTimeout>);
      }
    };
  }, [autoFocusSearch]);

  return (
    <>
      <input
        ref={inputRef}
        id={searchInputId}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        placeholder="Filter…"
        className="flux-one-command-ref-search"
        aria-label="Filter commands"
      />
      <div className="flux-one-modal-doc-list">
        {filtered.map((row) => (
          <div key={row.canonical} className="flux-one-command-ref-row">
            <div
              className={
                row.kind === 'root'
                  ? 'flux-one-command-ref-canonical flux-one-command-ref-canonical--root'
                  : 'flux-one-command-ref-canonical'
              }
            >
              {row.canonical}
            </div>
            <div className="flux-one-command-ref-summary">{row.summary}</div>
            {row.details ? <div className="flux-one-command-ref-details">{row.details}</div> : null}
            {row.aliases?.length ? (
              <div className="flux-one-command-ref-aliases">Aliases: {row.aliases.join(', ')}</div>
            ) : null}
          </div>
        ))}
        {filtered.length === 0 ? <div className="flux-one-command-ref-empty">No matches.</div> : null}
      </div>
    </>
  );
}
