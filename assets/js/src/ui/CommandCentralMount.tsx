import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../utils/api';
import { useQuery } from '@tanstack/react-query';
import { getGhostRemainder } from '../command/ghost';
import { getSuggestions } from '../command/suggest';
import { canonicalizeInput, parseInput } from '../command/normalize';
import type { Suggestion } from '../command/types';

type CommandResponse =
  | { type: 'panel'; panelId: string; command: string; data?: any }
  | { type: 'action'; command: string; status?: 'success' | 'error'; message?: string; data?: any }
  | { type: 'error'; command: string; message?: string; data?: any };

export function CommandCentralMount({ kind }: { kind: 'overlay' | 'dashboardWidget' | 'dev' }) {
  const [isOpen, setIsOpen] = useState(kind !== 'overlay' ? true : false);
  const [input, setInput] = useState('');
  const [bootstrapped, setBootstrapped] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [lastResult, setLastResult] = useState<CommandResponse | null>(null);
  const [panelData, setPanelData] = useState<any>(null);
  const [aiData, setAiData] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);

  const label = useMemo(() => {
    if (kind === 'dashboardWidget') return 'Command Central';
    if (kind === 'overlay') return 'Command';
    return 'Flux One (Dev)';
  }, [kind]);

  useEffect(() => {
    if (kind !== 'overlay') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === 'k';
      const wantsToggle = isK && (e.ctrlKey || e.metaKey);
      if (!wantsToggle) return;
      e.preventDefault();
      setIsOpen((v) => !v);
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true } as any);
  }, [kind]);

  useEffect(() => {
    if (kind !== 'overlay') return;

    const open = () => {
      setIsOpen(true);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          return;
        }
        const el = document.querySelector<HTMLInputElement>('#flux-one-command-central-root input[type="text"]');
        el?.focus();
      }, 0);
    };

    const node = document.getElementById('wp-admin-bar-flux-one-command');
    const anchor = node?.querySelector('a');
    const onClick = (e: Event) => {
      e.preventDefault();
      open();
    };

    anchor?.addEventListener('click', onClick);
    window.addEventListener('flux-one-open', open as EventListener);

    return () => {
      anchor?.removeEventListener('click', onClick);
      window.removeEventListener('flux-one-open', open as EventListener);
    };
  }, [kind]);

  useEffect(() => {
    if (!isOpen || bootstrapped || bootstrapping) return;
    setBootstrapping(true);
    api
      .getBootstrap()
      .then(() => setBootstrapped(true))
      .finally(() => setBootstrapping(false));
  }, [isOpen, bootstrapped, bootstrapping]);

  // Indices (decoupled endpoints + React Query caching).
  const pluginsQuery = useQuery({
    queryKey: ['flux-one', 'index', 'plugins'],
    queryFn: () => api.getPluginsIndex(),
    enabled: bootstrapped,
  });
  const usersQuery = useQuery({
    queryKey: ['flux-one', 'index', 'users'],
    queryFn: () => api.getUsersIndex(),
    enabled: bootstrapped,
  });
  const menusQuery = useQuery({
    queryKey: ['flux-one', 'index', 'menus'],
    queryFn: () => api.getMenusIndex(),
    enabled: bootstrapped,
  });
  const sitesQuery = useQuery({
    queryKey: ['flux-one', 'index', 'sites'],
    queryFn: () => api.getSitesIndex(),
    enabled: bootstrapped,
  });
  const destinationsQuery = useQuery({
    queryKey: ['flux-one', 'index', 'destinations'],
    queryFn: () => api.getDestinationsIndex(),
    enabled: bootstrapped,
  });

  const aggregateEmailQuery = useQuery({
    queryKey: ['flux-one', 'aggregate', 'email', 7],
    queryFn: () => api.getEmailAggregate(7),
    enabled: !!selectedSuggestion && selectedSuggestion.value === 'aggregate email',
    staleTime: 60_000,
  });

  useEffect(() => {
    const indices = {
      plugins: (pluginsQuery.data as any)?.data ?? pluginsQuery.data ?? [],
      users: (usersQuery.data as any)?.data ?? usersQuery.data ?? [],
      menus: (menusQuery.data as any)?.data ?? menusQuery.data ?? [],
      sites: (sitesQuery.data as any)?.data ?? sitesQuery.data ?? [],
      destinations: (destinationsQuery.data as any)?.data ?? destinationsQuery.data ?? [],
    };
    const { suggestions } = getSuggestions(input, indices);
    setSuggestions(suggestions);
    setActiveSuggestion(0);
    setSelectedSuggestion(suggestions[0] ?? null);
  }, [input, pluginsQuery.data, usersQuery.data, menusQuery.data, sitesQuery.data, destinationsQuery.data]);

  useEffect(() => {
    setSelectedSuggestion(suggestions[activeSuggestion] ?? null);
  }, [activeSuggestion, suggestions]);

  const execute = (command: string) => {
    const cmd = command.trim();
    if (!cmd) return;

    const canon = canonicalizeInput(cmd).canonical;
    setPanelData(null);
    setAiData(null);
    setLastResult(null);

    api
      .executeCommand(canon)
      .then((res: any) => {
        const envelope = res?.data ?? res;
        const payload = envelope?.data ?? envelope;
        const result = payload as CommandResponse;
        setLastResult(result);

        if (result.type === 'panel') {
          if (result.panelId === 'aggregate_email') {
            api.getEmailAggregate(7).then((agg: any) => setPanelData(agg?.data ?? agg));
            const aiRequested = !!result?.data?.aiRequested;
            if (aiRequested) {
              api.getEmailSummary().then((ai: any) => setAiData(ai?.data ?? ai));
            }
          } else {
            // Default: render panel payload directly.
            setPanelData(result.data ?? null);
          }
        }
      })
      .catch((err) => {
        setLastResult({ type: 'error', command: cmd, message: String(err) });
      });
  };

  if (kind === 'overlay' && !isOpen) {
    return null;
  }

  const ghost = getGhostRemainder(input, suggestions[activeSuggestion] ?? null);
  const parsed = parseInput(input);
  const pluginsIndex: any[] = ((pluginsQuery.data as any)?.data ?? pluginsQuery.data ?? []) as any[];
  const usersIndex: any[] = ((usersQuery.data as any)?.data ?? usersQuery.data ?? []) as any[];
  const menusIndex: any[] = ((menusQuery.data as any)?.data ?? menusQuery.data ?? []) as any[];
  const sitesIndex: any[] = ((sitesQuery.data as any)?.data ?? sitesQuery.data ?? []) as any[];

  return (
    <div className={`flux-one-mount flux-one-mount--${kind}`}>
      <div>
        <div className="flux-one-header">
          <strong>{label}</strong>
          {kind === 'overlay' ? (
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                border: '1px solid rgba(0,0,0,0.2)',
                background: '#fff',
                borderRadius: 6,
                padding: '6px 10px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          ) : null}
        </div>

        <div className="flux-one-body">
        {bootstrapping ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>Loading…</span>
          </div>
        ) : null}

        <div style={{ position: 'relative' }}>
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 10,
              right: 10,
              top: 33,
              pointerEvents: 'none',
              color: 'rgba(0,0,0,0.35)',
              whiteSpace: 'pre',
              fontFamily: 'inherit',
              fontSize: 13,
            }}
          >
            <span style={{ color: 'transparent' }}>{input}</span>
            <span>{ghost}</span>
          </div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 6, opacity: 0.8 }}>Command</label>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            placeholder={'Try “plugins” or “plugin ”'}
            ref={inputRef}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid rgba(0,0,0,0.2)',
              fontSize: 13,
            }}
            onKeyDown={(e: any) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveSuggestion((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)));
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveSuggestion((i) => Math.max(0, i - 1));
                return;
              }
              if (e.key === 'Tab') {
                if (!suggestions[activeSuggestion]) return;
                e.preventDefault();
                setInput(suggestions[activeSuggestion].value);
                return;
              }
              if (e.key !== 'Enter') return;
              e.preventDefault();
              const chosen = suggestions[activeSuggestion]?.value;
              execute(chosen || input);
            }}
          />
        </div>

        {suggestions.length ? (
          <div style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ maxHeight: 260, overflow: 'auto' }}>
            {suggestions.map((s, idx) => (
              <div
                key={s.id}
                onMouseEnter={() => setActiveSuggestion(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setInput(s.value);
                  execute(s.value);
                }}
                style={{
                  padding: '8px 10px',
                  background: idx === activeSuggestion ? '#f6f7f7' : '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <span>{s.label}</span>
                <span style={{ opacity: 0.6, fontSize: 12 }}>{s.kind}</span>
              </div>
            ))}
          </div>
          </div>
        ) : null}

        {/* Preview (single pane below, avoids “two columns” UI) */}
        {selectedSuggestion ? (
          <div style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, padding: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{selectedSuggestion.label}</div>
            <div style={{ opacity: 0.7, marginBottom: 8 }}>{selectedSuggestion.description || selectedSuggestion.value}</div>

            {/* Proactive previews after-space */}
            {parsed.hasTrailingSpace && parsed.tokens[0] === 'plugin' ? (
              <div>
                <div style={{ fontWeight: 600, margin: '10px 0 6px' }}>Plugins</div>
                <div style={{ maxHeight: 180, overflow: 'auto', background: '#f6f7f7', borderRadius: 6, padding: 8 }}>
                  {(pluginsIndex || []).slice(0, 12).map((p) => (
                    <div key={p.pluginFile} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span>{p.name}</span>
                      <span style={{ opacity: 0.7, fontSize: 12 }}>
                        {p.active ? 'active' : 'inactive'}
                        {p.updateAvailable ? ' • update' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {parsed.hasTrailingSpace && parsed.tokens[0] === 'lock' && parsed.tokens[1] === 'user' ? (
              <div>
                <div style={{ fontWeight: 600, margin: '10px 0 6px' }}>Users</div>
                <div style={{ maxHeight: 180, overflow: 'auto', background: '#f6f7f7', borderRadius: 6, padding: 8 }}>
                  {(usersIndex || []).slice(0, 12).map((u) => (
                    <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span>{u.email}</span>
                      <span style={{ opacity: 0.7, fontSize: 12 }}>{u.displayName || ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {parsed.hasTrailingSpace && parsed.tokens[0] === 'menu' ? (
              <div>
                <div style={{ fontWeight: 600, margin: '10px 0 6px' }}>Menus</div>
                <div style={{ maxHeight: 180, overflow: 'auto', background: '#f6f7f7', borderRadius: 6, padding: 8 }}>
                  {(menusIndex || []).slice(0, 12).map((m) => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span>{m.name}</span>
                      <span style={{ opacity: 0.7, fontSize: 12 }}>{m.slug || ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {parsed.hasTrailingSpace && parsed.tokens[0] === 'site' && parsed.tokens[1] === 'switch' ? (
              <div>
                <div style={{ fontWeight: 600, margin: '10px 0 6px' }}>Sites</div>
                <div style={{ maxHeight: 180, overflow: 'auto', background: '#f6f7f7', borderRadius: 6, padding: 8 }}>
                  {(sitesIndex || []).slice(0, 12).map((s) => (
                    <div key={s.blogId} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span>{`${s.domain}${s.path}`}</span>
                      <span style={{ opacity: 0.7, fontSize: 12 }}>#{s.blogId}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {selectedSuggestion.value === 'aggregate email' ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Aggregate email (7d)</div>
                <div style={{ maxHeight: 180, overflow: 'auto', background: '#f6f7f7', borderRadius: 6, padding: 8 }}>
                  <pre style={{ margin: 0 }}>
                    {JSON.stringify(((aggregateEmailQuery.data as any)?.data ?? aggregateEmailQuery.data) || null, null, 2)}
                  </pre>
                </div>
              </div>
            ) : null}

            {selectedSuggestion.value === 'summary email' ? (
              <div style={{ marginTop: 10, padding: 8, borderRadius: 6, background: '#f6f7f7' }}>
                AI summary will run when executed (feature-gated).
              </div>
            ) : null}
          </div>
        ) : null}

        {lastResult?.type === 'action' ? (
          <div style={{ padding: 10, borderRadius: 6, background: '#f6f7f7' }}>
            <strong>{lastResult.status || 'success'}</strong> {lastResult.message || ''}
          </div>
        ) : null}

        {lastResult?.type === 'error' ? (
          <div style={{ padding: 10, borderRadius: 6, background: '#f6f7f7' }}>
            <strong>Error:</strong> {lastResult.message || 'Unknown error'}
          </div>
        ) : null}

        {panelData ? (
          <pre style={{ margin: 0, maxHeight: 260, overflow: 'auto', background: '#f6f7f7', padding: 10, borderRadius: 6 }}>
            {JSON.stringify(panelData, null, 2)}
          </pre>
        ) : null}

        {aiData ? (
          <pre style={{ margin: 0, maxHeight: 160, overflow: 'auto', background: '#f6f7f7', padding: 10, borderRadius: 6 }}>
            {JSON.stringify(aiData, null, 2)}
          </pre>
        ) : null}

        {kind === 'dev' && lastResult ? (
          <pre style={{ margin: 0, maxHeight: 160, overflow: 'auto', background: '#f6f7f7', padding: 10, borderRadius: 6 }}>
            {JSON.stringify(lastResult, null, 2)}
          </pre>
        ) : null}
      </div>
      </div>
    </div>
  );
}

