import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api } from '../utils/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getGhostRemainder } from '../command/ghost';
import { getRouteTokens, getSuggestions, resolveNavDestinationUrl, type IndexData } from '../command/suggest';
import { canonicalizeInput, parseInput } from '../command/normalize';
import type { Suggestion } from '../command/types';
import { filterCommandDocs } from '../command/commandDocs';
import { interpretEnter, interpretSuggestionPick } from '../command/interpretEnter';
import { EmailAggregateView, type EmailAggregatePayload } from './EmailAggregateView';

type CommandResponse =
  | { type: 'panel'; panelId: string; command: string; data?: any }
  | { type: 'action'; command: string; status?: 'success' | 'error'; message?: string; data?: any }
  | { type: 'navigation'; command: string; data?: { url?: string; label?: string } }
  | { type: 'error'; command: string; message?: string; data?: any };

function unwrapCommandEnvelope(res: any): CommandResponse | null {
  const raw = res?.data ?? res;
  if (raw && (raw.type === 'panel' || raw.type === 'action' || raw.type === 'error' || raw.type === 'navigation')) {
    return raw as CommandResponse;
  }
  return null;
}

function getActionDisplayMessage(result: CommandResponse & { type: 'action' }): string {
  const d = result.data;
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    const um = (d as { userMessage?: string; message?: string }).userMessage ?? (d as { message?: string }).message;
    if (typeof um === 'string' && um.trim() !== '') {
      return um;
    }
  }
  return (result.message && result.message.trim()) || '';
}

function shouldInvalidatePluginsIndex(canonical: string): boolean {
  return /^plugin\s+(update|activate|deactivate|delete)\b/.test(canonical);
}

export function CommandCentralMount({ kind }: { kind: 'overlay' | 'dashboardWidget' | 'dev' }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(kind !== 'overlay' ? true : false);
  const [input, setInput] = useState('');
  const [bootstrapped, setBootstrapped] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [lastResult, setLastResult] = useState<CommandResponse | null>(null);
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);
  const [panelData, setPanelData] = useState<any>(null);
  const [aiData, setAiData] = useState<any>(null);
  const [mergedSuggestions, setMergedSuggestions] = useState<Suggestion[]>([]);
  const [commandRow, setCommandRow] = useState<Suggestion[]>([]);
  const [subcommandRow, setSubcommandRow] = useState<Suggestion[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const commandsModalTriggerRef = useRef<HTMLButtonElement | null>(null);
  const commandsModalCloseRef = useRef<HTMLButtonElement | null>(null);
  const commandsModalSearchRef = useRef<HTMLInputElement | null>(null);
  const dashboardFocusAppliedRef = useRef(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [commandsModalOpen, setCommandsModalOpen] = useState(false);
  const [commandsHelpQuery, setCommandsHelpQuery] = useState('');
  const [recentNavigations, setRecentNavigations] = useState<
    Array<{ label: string; url?: string; command?: string }>
  >([]);
  const [inputFocused, setInputFocused] = useState(false);
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  const structuredPanelRef = useRef<HTMLDivElement | null>(null);
  const blurDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      .then((inner: any) => {
        const navs = inner?.commandMemory?.recentNavigations;
        if (Array.isArray(navs)) {
          setRecentNavigations(navs);
        }
        setBootstrapped(true);
      })
      .finally(() => setBootstrapping(false));
  }, [isOpen, bootstrapped, bootstrapping]);

  useEffect(() => {
    if (kind !== 'dashboardWidget' || !bootstrapped || bootstrapping) {
      return;
    }
    if (dashboardFocusAppliedRef.current) {
      return;
    }
    dashboardFocusAppliedRef.current = true;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [kind, bootstrapped, bootstrapping]);

  const commandsModalWasOpenRef = useRef(false);
  useEffect(() => {
    if (!commandsModalOpen) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setCommandsModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    requestAnimationFrame(() => {
      commandsModalSearchRef.current?.focus();
    });
    return () => window.removeEventListener('keydown', onKey);
  }, [commandsModalOpen]);

  useEffect(() => {
    if (commandsModalWasOpenRef.current && !commandsModalOpen) {
      commandsModalTriggerRef.current?.focus();
    }
    commandsModalWasOpenRef.current = commandsModalOpen;
  }, [commandsModalOpen]);

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
  const suiteConfigQuery = useQuery({
    queryKey: ['flux-one', 'index', 'suite-config'],
    queryFn: () => api.getSuiteConfigIndex(),
    enabled: bootstrapped,
    staleTime: 60_000,
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
      suiteConfig: (suiteConfigQuery.data as any)?.data ?? suiteConfigQuery.data ?? [],
    };
    const split = getSuggestions(input, indices);
    setMergedSuggestions(split.merged);
    setCommandRow(split.commandRow);
    setSubcommandRow(split.subcommandRow);
    setActiveSuggestion(0);
    setSelectedSuggestion(split.merged[0] ?? null);
  }, [
    input,
    pluginsQuery.data,
    usersQuery.data,
    menusQuery.data,
    sitesQuery.data,
    destinationsQuery.data,
    suiteConfigQuery.data,
  ]);

  useEffect(() => {
    setSelectedSuggestion(mergedSuggestions[activeSuggestion] ?? null);
  }, [activeSuggestion, mergedSuggestions]);

  const commandMutation = useMutation({
    mutationFn: async (rawCommand: string) => {
      const trimmed = rawCommand.trim();
      const { canonical } = canonicalizeInput(trimmed);
      const toServer = /^config(\s|$)/i.test(trimmed) ? trimmed : canonical;
      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const res = await api.executeCommand(toServer);
      const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const durationMs = Math.round(t1 - t0);
      return { res, durationMs, canonical: toServer, original: trimmed };
    },
    onSuccess: (ctx) => {
      const result = unwrapCommandEnvelope(ctx.res);
      if (!result) {
        setLastResult({ type: 'error', command: ctx.canonical, message: 'Unexpected response from server.' });
        setLastDurationMs(ctx.durationMs);
        return;
      }
      if (result.type === 'navigation') {
        const url = result.data?.url;
        if (typeof url === 'string' && url.length > 0) {
          window.location.assign(url);
        }
        return;
      }

      setLastResult(result);
      setLastDurationMs(ctx.durationMs);

      if (result.type === 'panel') {
        if (result.panelId === 'aggregate_email') {
          api.getEmailAggregate(7).then((agg: any) => setPanelData(agg?.data ?? agg));
          const aiRequested = !!result?.data?.aiRequested;
          if (aiRequested) {
            api.getEmailSummary().then((ai: any) => setAiData(ai?.data ?? ai));
          }
        } else {
          setPanelData(result.data ?? null);
        }
      }

      if (
        result.type === 'action' &&
        result.status === 'success' &&
        shouldInvalidatePluginsIndex(ctx.canonical)
      ) {
        queryClient.invalidateQueries({ queryKey: ['flux-one', 'index', 'plugins'] });
      }

      if (result.type === 'action' && result.status === 'success' && /^config\s+set\b/i.test(ctx.canonical)) {
        queryClient.invalidateQueries({ queryKey: ['flux-one', 'index', 'suite-config'] });
      }
    },
    onError: (err: unknown, rawCommand: string) => {
      const cmd = rawCommand.trim();
      const message =
        err instanceof Error && typeof err.message === 'string' ? err.message : String(err);
      setLastResult({ type: 'error', command: cmd, message });
      setLastDurationMs(null);
    },
  });

  const buildIndices = (): IndexData => ({
    plugins: ((pluginsQuery.data as any)?.data ?? pluginsQuery.data ?? []) as IndexData['plugins'],
    users: ((usersQuery.data as any)?.data ?? usersQuery.data ?? []) as IndexData['users'],
    menus: ((menusQuery.data as any)?.data ?? menusQuery.data ?? []) as IndexData['menus'],
    sites: ((sitesQuery.data as any)?.data ?? sitesQuery.data ?? []) as IndexData['sites'],
    destinations: ((destinationsQuery.data as any)?.data ?? destinationsQuery.data ?? []) as IndexData['destinations'],
    suiteConfig: ((suiteConfigQuery.data as any)?.data ?? suiteConfigQuery.data ?? []) as IndexData['suiteConfig'],
  });

  const recordClientNavMemory = (opts: { url?: string; command?: string; label?: string }) => {
    if (!opts.url && !opts.command) {
      return;
    }
    void api.recordRecentNavigation(opts).catch(() => {});
  };

  const tryReadOnlyFastPath = (canonical: string): boolean => {
    const rows: Array<{ keys: string[]; panelId: string; queryKey: readonly unknown[] }> = [
      { keys: ['plugin list', 'plugin show'], panelId: 'plugins', queryKey: ['flux-one', 'index', 'plugins'] },
      { keys: ['user list', 'user show'], panelId: 'users', queryKey: ['flux-one', 'index', 'users'] },
      { keys: ['site list', 'site show'], panelId: 'sites', queryKey: ['flux-one', 'index', 'sites'] },
      { keys: ['menu list', 'menu show'], panelId: 'menus', queryKey: ['flux-one', 'index', 'menus'] },
    ];
    for (const row of rows) {
      if (!row.keys.includes(canonical)) {
        continue;
      }
      const raw = queryClient.getQueryData(row.queryKey as any);
      if (raw == null) {
        return false;
      }
      const data = (raw as any)?.data ?? raw;
      if (!Array.isArray(data)) {
        return false;
      }
      setLastResult({ type: 'panel', panelId: row.panelId, command: canonical });
      setPanelData(data);
      setAiData(null);
      setLastDurationMs(0);
      return true;
    }
    return false;
  };

  const executeFromInput = (rawCommand: string, picked?: Suggestion | null) => {
    const cmd = rawCommand.trim();
    if (!cmd || commandMutation.isPending) {
      return;
    }
    setSuggestionsDismissed(true);
    const { canonical } = canonicalizeInput(cmd);

    setPanelData(null);
    setAiData(null);
    setLastResult(null);
    setLastDurationMs(null);

    const destinationsList: Array<{ id: string; label: string; value: string; url: string }> =
      ((destinationsQuery.data as any)?.data ?? destinationsQuery.data ?? []) as any[];

    const effectivePick = picked ?? mergedSuggestions[activeSuggestion] ?? null;

    if (effectivePick?.clientAction === 'nav' && effectivePick.navUrl) {
      const { canonical: navCanon } = canonicalizeInput(effectivePick.value.trim());
      recordClientNavMemory({
        url: effectivePick.navUrl,
        command: navCanon,
        label: effectivePick.label,
      });
      window.location.assign(effectivePick.navUrl);
      return;
    }

    if (canonical.startsWith('nav ')) {
      const rest = canonical.slice(4).trim();
      const url = resolveNavDestinationUrl(rest, destinationsList);
      if (url) {
        const hit = destinationsList.find((d) => d.url === url);
        recordClientNavMemory({ url, command: canonical, label: hit?.label });
        window.location.assign(url);
        return;
      }
    }

    if (tryReadOnlyFastPath(canonical)) {
      return;
    }

    commandMutation.mutate(cmd);
  };

  const isExecuting = commandMutation.isPending;
  const runningLabel =
    commandMutation.variables != null
      ? canonicalizeInput(String(commandMutation.variables)).canonical
      : '';

  if (kind === 'overlay' && !isOpen) {
    return null;
  }

  const ghost = getGhostRemainder(input, mergedSuggestions[activeSuggestion] ?? null);
  const parsed = parseInput(input);
  const routeTok = getRouteTokens(parsed);
  const rt0 = routeTok[0] || '';
  const rt1 = routeTok[1] || '';
  const pluginsIndex: any[] = ((pluginsQuery.data as any)?.data ?? pluginsQuery.data ?? []) as any[];
  const usersIndex: any[] = ((usersQuery.data as any)?.data ?? usersQuery.data ?? []) as any[];
  const menusIndex: any[] = ((menusQuery.data as any)?.data ?? menusQuery.data ?? []) as any[];
  const sitesIndex: any[] = ((sitesQuery.data as any)?.data ?? sitesQuery.data ?? []) as any[];

  const adminBase =
    typeof window !== 'undefined' && window.fluxOneAdmin?.adminUrl
      ? String(window.fluxOneAdmin.adminUrl).replace(/\/?$/, '/')
      : '/wp-admin/';

  const btnSmall: React.CSSProperties = {
    fontSize: 12,
    padding: '4px 8px',
    borderRadius: 4,
    border: '1px solid rgba(0,0,0,0.2)',
    background: '#fff',
    cursor: 'pointer',
  };

  const isStructuredListPanel =
    lastResult?.type === 'panel' &&
    lastResult.panelId &&
    ['plugins', 'users', 'sites', 'menus', 'suite_config'].includes(lastResult.panelId) &&
    Array.isArray(panelData);

  useLayoutEffect(() => {
    if (!isStructuredListPanel || !structuredPanelRef.current) {
      return;
    }
    structuredPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [isStructuredListPanel, lastResult?.panelId, panelData]);

  const showSuggestionOverlay =
    inputFocused &&
    !suggestionsDismissed &&
    !isExecuting &&
    !bootstrapping &&
    (commandRow.length > 0 || subcommandRow.length > 0);

  const showSuggestionChrome =
    inputFocused &&
    !suggestionsDismissed &&
    !isExecuting &&
    !bootstrapping &&
    !!selectedSuggestion &&
    (commandRow.length > 0 || subcommandRow.length > 0);

  const filteredCommandDocs = useMemo(() => filterCommandDocs(commandsHelpQuery), [commandsHelpQuery]);

  return (
    <div className={`flux-one-mount flux-one-mount--${kind}`}>
      <div>
        <div className="flux-one-header">
          <strong>{label}</strong>
          <span className="flux-one-header-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              ref={commandsModalTriggerRef}
              type="button"
              className="flux-one-command-reference-trigger"
              onClick={() => setCommandsModalOpen(true)}
              aria-label="Command reference"
              title="Command reference"
              style={{
                border: 'none',
                background: 'transparent',
                padding: 4,
                margin: 0,
                cursor: 'pointer',
                lineHeight: 1,
                borderRadius: 4,
                color: 'inherit',
                opacity: 0.75,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.75';
              }}
            >
              <span className="dashicons dashicons-info" aria-hidden style={{ width: 18, height: 18, fontSize: 18 }} />
            </button>
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
          </span>
        </div>

        <div className="flux-one-body">
        {kind === 'dashboardWidget' && recentNavigations.length > 0 ? (
          <div className="flux-one-recent-nav" style={{ marginBottom: 4 }}>
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>Recent admin pages</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {recentNavigations.map((item, i) => {
                const href = item.url && typeof item.url === 'string' ? item.url : '';
                if (!href) {
                  return null;
                }
                return (
                  <a
                    key={`${href}-${item.label}-${i}`}
                    href={href}
                    className="button button-small"
                  >
                    {item.label}
                  </a>
                );
              })}
            </div>
          </div>
        ) : null}
        {bootstrapping ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>Loading…</span>
          </div>
        ) : null}

        <div className="flux-one-command-input-wrap" style={{ position: 'relative', zIndex: 5 }}>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 6, opacity: 0.8 }}>Command</label>
          <div style={{ position: 'relative' }}>
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 10,
                right: 10,
                top: 8,
                pointerEvents: 'none',
                color: 'rgba(0,0,0,0.35)',
                whiteSpace: 'pre',
                fontFamily: 'inherit',
                fontSize: 13,
                zIndex: 0,
              }}
            >
              <span style={{ color: 'transparent' }}>{input}</span>
              <span>{ghost}</span>
            </div>
            <input
              type="text"
              value={input}
              onChange={(e) => {
                setSuggestionsDismissed(false);
                setInput(e.currentTarget.value);
              }}
              onFocus={() => {
                if (blurDismissTimerRef.current) {
                  clearTimeout(blurDismissTimerRef.current);
                  blurDismissTimerRef.current = null;
                }
                setInputFocused(true);
                setSuggestionsDismissed(false);
              }}
              onBlur={() => {
                blurDismissTimerRef.current = window.setTimeout(() => {
                  setInputFocused(false);
                  blurDismissTimerRef.current = null;
                }, 120);
              }}
              placeholder={'Try “plugin list”, “nav plugins”, or “user list”'}
              ref={inputRef}
              disabled={isExecuting || bootstrapping}
              aria-busy={isExecuting}
              aria-expanded={showSuggestionOverlay}
              aria-controls={showSuggestionOverlay ? 'flux-one-command-suggest-listbox' : undefined}
              role="combobox"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid rgba(0,0,0,0.2)',
                fontSize: 13,
                opacity: isExecuting || bootstrapping ? 0.75 : 1,
                position: 'relative',
                zIndex: 1,
                background: '#fff',
              }}
              onKeyDown={(e: any) => {
                if (isExecuting) return;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActiveSuggestion((i) =>
                    Math.min(i + 1, Math.max(0, mergedSuggestions.length - 1))
                  );
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActiveSuggestion((i) => Math.max(0, i - 1));
                  return;
                }
                if (e.key === 'Tab' && !e.shiftKey) {
                  if (!mergedSuggestions[activeSuggestion]) return;
                  e.preventDefault();
                  setInput(mergedSuggestions[activeSuggestion].value);
                  return;
                }
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const indices = buildIndices();
                const outcome = interpretEnter(input, {
                  indices,
                  mergedSuggestions,
                  activeIndex: activeSuggestion,
                });
                if (outcome.kind === 'complete') {
                  setInput(outcome.value);
                  return;
                }
                if (outcome.kind === 'complete_and_run' || outcome.kind === 'run') {
                  const active = mergedSuggestions[activeSuggestion] ?? null;
                  const sameCanon =
                    active &&
                    canonicalizeInput(active.value.trim()).canonical ===
                      canonicalizeInput(outcome.value.trim()).canonical;
                  executeFromInput(outcome.value, sameCanon ? active : null);
                  return;
                }
              }}
            />
          </div>

          {showSuggestionOverlay ? (
            <div
              id="flux-one-command-suggest-listbox"
              className="flux-one-suggest-dropdown"
              role="listbox"
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="flux-one-suggest-dropdown__scroll">
                {commandRow.length ? (
                  <div className="flux-one-suggest-dropdown__section">Commands</div>
                ) : null}
                {commandRow.map((s, i) => {
                  const idx = i;
                  return (
                    <div
                      key={`cmd-${s.id}-${idx}`}
                      role="option"
                      aria-selected={idx === activeSuggestion}
                      onMouseEnter={() => !isExecuting && setActiveSuggestion(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (isExecuting) return;
                        const indices = buildIndices();
                        const outcome = interpretSuggestionPick(s, indices);
                        if (outcome.kind === 'complete') {
                          setInput(outcome.value);
                          return;
                        }
                        executeFromInput(outcome.value, s);
                      }}
                      className={
                        idx === activeSuggestion
                          ? 'flux-one-suggest-dropdown__row flux-one-suggest-dropdown__row--active'
                          : 'flux-one-suggest-dropdown__row'
                      }
                      style={{
                        cursor: isExecuting ? 'default' : 'pointer',
                        opacity: isExecuting ? 0.55 : 1,
                      }}
                    >
                      <span>{s.label}</span>
                      <span style={{ opacity: 0.6, fontSize: 12 }}>{s.kind}</span>
                    </div>
                  );
                })}
                {subcommandRow.length ? (
                  <div
                    className="flux-one-suggest-dropdown__section"
                    style={{ borderTop: commandRow.length ? '1px solid rgba(0,0,0,0.08)' : undefined }}
                  >
                    Next steps
                  </div>
                ) : null}
                {subcommandRow.map((s, j) => {
                  const idx = commandRow.length + j;
                  return (
                    <div
                      key={`sub-${s.id}-${idx}`}
                      role="option"
                      aria-selected={idx === activeSuggestion}
                      onMouseEnter={() => !isExecuting && setActiveSuggestion(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (isExecuting) return;
                        const indices = buildIndices();
                        const outcome = interpretSuggestionPick(s, indices);
                        if (outcome.kind === 'complete') {
                          setInput(outcome.value);
                          return;
                        }
                        executeFromInput(outcome.value, s);
                      }}
                      className={
                        idx === activeSuggestion
                          ? 'flux-one-suggest-dropdown__row flux-one-suggest-dropdown__row--active'
                          : 'flux-one-suggest-dropdown__row'
                      }
                      style={{
                        cursor: isExecuting ? 'default' : 'pointer',
                        opacity: isExecuting ? 0.55 : 1,
                      }}
                    >
                      <span>{s.label}</span>
                      <span style={{ opacity: 0.6, fontSize: 12 }}>{s.kind}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {isExecuting ? (
          <div className="flux-one-notice flux-one-notice--running" role="status" aria-live="polite">
            <span className="flux-one-spinner" aria-hidden />
            <span>
              Running… <span style={{ opacity: 0.75 }}>{runningLabel}</span>
            </span>
          </div>
        ) : null}

        {/* Preview (single pane below, avoids “two columns” UI) */}
        {showSuggestionChrome && selectedSuggestion ? (
          <div style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, padding: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{selectedSuggestion.label}</div>
            <div style={{ opacity: 0.7, marginBottom: 8 }}>{selectedSuggestion.description || selectedSuggestion.value}</div>

            {/* Proactive previews after-space */}
            {parsed.hasTrailingSpace && rt0 === 'plugin' ? (
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

            {parsed.hasTrailingSpace && parsed.tokens[0] === 'user' && parsed.tokens[1] === 'lock' ? (
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

            {parsed.hasTrailingSpace && rt0 === 'menu' ? (
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

            {parsed.hasTrailingSpace && rt0 === 'site' && rt1 === 'switch' ? (
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
                  <EmailAggregateView
                    data={
                      ((aggregateEmailQuery.data as any)?.data ?? aggregateEmailQuery.data) as EmailAggregatePayload | null
                    }
                  />
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

        {lastResult?.type === 'action' && lastResult.status === 'success' ? (
          <div className="flux-one-notice flux-one-notice--success" role="status">
            {getActionDisplayMessage(lastResult) || lastResult.message || 'Done.'}
            {lastDurationMs != null && lastDurationMs >= 2000 ? (
              <span style={{ opacity: 0.75 }}> ({(lastDurationMs / 1000).toFixed(1)}s)</span>
            ) : null}
          </div>
        ) : null}

        {lastResult?.type === 'action' && lastResult.status === 'error' ? (
          <div className="flux-one-notice flux-one-notice--error" role="alert">
            {getActionDisplayMessage(lastResult) || lastResult.message || 'Command failed.'}
          </div>
        ) : null}

        {lastResult?.type === 'error' ? (
          <div className="flux-one-notice flux-one-notice--error" role="alert">
            {lastResult.message || 'Unknown error'}
          </div>
        ) : null}

        {isStructuredListPanel && lastResult?.type === 'panel' ? (
          <div ref={structuredPanelRef} className="flux-one-structured-results">
            {lastResult.panelId === 'plugins' ? (
              <div
                style={{
                  marginTop: 8,
                  maxHeight: 320,
                  overflow: 'auto',
                  background: '#f6f7f7',
                  padding: 10,
                  borderRadius: 6,
                  border: '1px solid rgba(0,0,0,0.08)',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Plugins</div>
                {(panelData as any[]).map((p) => (
                  <div
                    key={p.pluginFile}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 0',
                      borderBottom: '1px solid rgba(0,0,0,0.06)',
                    }}
                  >
                    <span style={{ flex: '1 1 160px', fontSize: 13 }}>{p.name}</span>
                    <span style={{ fontSize: 12, opacity: 0.65 }}>
                      {p.active ? 'Active' : 'Inactive'}
                      {p.updateAvailable ? ' · Update available' : ''}
                    </span>
                    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {!p.active ? (
                        <button type="button" style={btnSmall} onClick={() => executeFromInput(`plugin activate ${p.name}`)}>
                          Activate
                        </button>
                      ) : null}
                      {p.active ? (
                        <button type="button" style={btnSmall} onClick={() => executeFromInput(`plugin deactivate ${p.name}`)}>
                          Deactivate
                        </button>
                      ) : null}
                      {p.updateAvailable ? (
                        <button type="button" style={btnSmall} onClick={() => executeFromInput(`plugin update ${p.name}`)}>
                          Update
                        </button>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            {lastResult.panelId === 'users' ? (
              <div
                style={{
                  marginTop: 8,
                  maxHeight: 320,
                  overflow: 'auto',
                  background: '#f6f7f7',
                  padding: 10,
                  borderRadius: 6,
                  border: '1px solid rgba(0,0,0,0.08)',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Users</div>
                {(panelData as any[]).map((u) => (
                  <div
                    key={u.id}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 0',
                      borderBottom: '1px solid rgba(0,0,0,0.06)',
                    }}
                  >
                    <span style={{ flex: '1 1 200px', fontSize: 13 }}>{u.email}</span>
                    <span style={{ fontSize: 12, opacity: 0.65 }}>{u.displayName || ''}</span>
                    <span style={{ display: 'flex', gap: 6 }}>
                      <button type="button" style={btnSmall} onClick={() => executeFromInput(`user lock ${u.email}`)}>
                        Lock
                      </button>
                      <button type="button" style={btnSmall} onClick={() => executeFromInput(`user unlock ${u.email}`)}>
                        Unlock
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            {lastResult.panelId === 'sites' ? (
              <div
                style={{
                  marginTop: 8,
                  maxHeight: 320,
                  overflow: 'auto',
                  background: '#f6f7f7',
                  padding: 10,
                  borderRadius: 6,
                  border: '1px solid rgba(0,0,0,0.08)',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Sites</div>
                {(panelData as any[]).map((s) => (
                  <div
                    key={s.blogId}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 0',
                      borderBottom: '1px solid rgba(0,0,0,0.06)',
                    }}
                  >
                    <span style={{ flex: '1 1 200px', fontSize: 13 }}>{`${s.domain}${s.path}`}</span>
                    <span style={{ fontSize: 12, opacity: 0.65 }}>#{s.blogId}</span>
                    <button
                      type="button"
                      style={btnSmall}
                      onClick={() => executeFromInput(`site switch ${s.domain}${s.path}`)}
                    >
                      Switch
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {lastResult.panelId === 'menus' ? (
              <div
                style={{
                  marginTop: 8,
                  maxHeight: 320,
                  overflow: 'auto',
                  background: '#f6f7f7',
                  padding: 10,
                  borderRadius: 6,
                  border: '1px solid rgba(0,0,0,0.08)',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Menus</div>
                {(panelData as any[]).map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 0',
                      borderBottom: '1px solid rgba(0,0,0,0.06)',
                    }}
                  >
                    <span style={{ flex: '1 1 160px', fontSize: 13 }}>{m.name}</span>
                    <span style={{ fontSize: 12, opacity: 0.65 }}>{m.slug || ''}</span>
                    <button
                      type="button"
                      style={btnSmall}
                      onClick={() =>
                        window.open(
                          `${adminBase}nav-menus.php?action=edit&menu=${encodeURIComponent(String(m.id))}`,
                          '_blank'
                        )
                      }
                    >
                      Edit in admin
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {lastResult.panelId === 'suite_config' ? (
              <div
                style={{
                  marginTop: 8,
                  maxHeight: 360,
                  overflow: 'auto',
                  background: '#f6f7f7',
                  padding: 10,
                  borderRadius: 6,
                  border: '1px solid rgba(0,0,0,0.08)',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Suite configuration</div>
                {(panelData as any[]).map((row) => (
                  <div
                    key={row.id}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'flex-start',
                      gap: 8,
                      padding: '8px 0',
                      borderBottom: '1px solid rgba(0,0,0,0.06)',
                      fontSize: 13,
                    }}
                  >
                    <span style={{ flex: '1 1 200px', fontFamily: 'monospace', fontSize: 12 }}>{row.id}</span>
                    <span style={{ flex: '1 1 140px', opacity: 0.75, fontSize: 12 }}>{row.plugin}</span>
                    <span style={{ flex: '1 1 120px', fontSize: 12, opacity: 0.65 }}>{row.type}</span>
                    <span style={{ flex: '2 1 220px' }}>{row.label}</span>
                    <span style={{ flex: '1 1 120px', fontWeight: 600 }}>{row.valueDisplay}</span>
                    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <button type="button" style={btnSmall} onClick={() => executeFromInput(`config get ${row.id}`)}>
                        Get
                      </button>
                      {row.type === 'bool' ? (
                        <>
                          <button type="button" style={btnSmall} onClick={() => executeFromInput(`config set ${row.id} true`)}>
                            Set true
                          </button>
                          <button type="button" style={btnSmall} onClick={() => executeFromInput(`config set ${row.id} false`)}>
                            Set false
                          </button>
                        </>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {lastResult?.type === 'panel' && lastResult.panelId === 'aggregate_email' && panelData ? (
          <div
            style={{
              margin: '8px 0 0',
              maxHeight: 320,
              overflow: 'auto',
              background: '#f6f7f7',
              padding: 10,
              borderRadius: 6,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Aggregate email (7d)</div>
            <EmailAggregateView data={panelData} />
          </div>
        ) : null}

        {lastResult?.type === 'panel' && lastResult.panelId === 'user' && panelData && typeof panelData === 'object' && !Array.isArray(panelData) ? (
          <div
            style={{
              marginTop: 8,
              padding: 10,
              borderRadius: 6,
              background: '#f6f7f7',
              border: '1px solid rgba(0,0,0,0.08)',
              fontSize: 13,
            }}
          >
            <strong>User</strong> {(panelData as { email?: string }).email || ''}
          </div>
        ) : null}

        {lastResult?.type === 'panel' && panelData && !isStructuredListPanel && lastResult.panelId !== 'aggregate_email' && lastResult.panelId !== 'user' ? (
          <div style={{ margin: '8px 0 0' }}>
            {kind !== 'dev' ? <div style={{ fontWeight: 600, marginBottom: 8 }}>Result</div> : null}
            <pre style={{ margin: 0, maxHeight: 260, overflow: 'auto', background: '#f6f7f7', padding: 10, borderRadius: 6 }}>
              {JSON.stringify(panelData, null, 2)}
            </pre>
          </div>
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

      {commandsModalOpen ? (
        <div
          className="flux-one-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setCommandsModalOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="flux-one-command-reference-title"
            className="flux-one-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flux-one-modal-header">
              <h2 id="flux-one-command-reference-title" style={{ margin: 0, fontSize: 16 }}>
                Command reference
              </h2>
              <button
                ref={commandsModalCloseRef}
                type="button"
                className="button"
                onClick={() => setCommandsModalOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="flux-one-modal-body">
              <input
                ref={commandsModalSearchRef}
                type="search"
                value={commandsHelpQuery}
                onChange={(e) => setCommandsHelpQuery(e.currentTarget.value)}
                placeholder="Filter…"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  marginBottom: 8,
                  padding: '8px 10px',
                  borderRadius: 4,
                  border: '1px solid rgba(0,0,0,0.2)',
                  fontSize: 13,
                }}
              />
              <div className="flux-one-modal-doc-list">
                {filteredCommandDocs.map((row) => (
                  <div
                    key={row.canonical}
                    style={{
                      padding: '8px 0',
                      borderBottom: '1px solid rgba(0,0,0,0.06)',
                      fontSize: 13,
                    }}
                  >
                    <div style={{ fontWeight: row.kind === 'root' ? 600 : 400 }}>{row.canonical}</div>
                    <div style={{ opacity: 0.82, fontSize: 12, lineHeight: 1.45 }}>{row.summary}</div>
                    {row.details ? (
                      <div style={{ opacity: 0.72, fontSize: 12, lineHeight: 1.45, marginTop: 4 }}>{row.details}</div>
                    ) : null}
                    <div style={{ opacity: 0.6, fontSize: 11, marginTop: 4 }}>
                      {row.aliases?.length ? `Aliases: ${row.aliases.join(', ')} · ` : ''}
                      Data: {row.backend === 'none' ? 'client index or inline' : row.backend === 'command' ? 'POST /command' : 'POST /command + GET'}
                    </div>
                  </div>
                ))}
                {filteredCommandDocs.length === 0 ? (
                  <div style={{ opacity: 0.7, fontSize: 13 }}>No matches.</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

