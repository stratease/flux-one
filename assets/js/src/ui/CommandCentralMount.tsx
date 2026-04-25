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
import { FluxOneModal } from './FluxOneModal';
import Fuse from 'fuse.js';

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

type FluxIndexQueryKey = readonly ['flux-one', 'index', 'plugins' | 'users' | 'menus' | 'sites' | 'destinations' | 'suite-config'];

/** After successful command actions, invalidate matching TanStack index queries (server has no index transients). */
function getInvalidatedIndexKeys(canonical: string): FluxIndexQueryKey[] {
  const c = canonical.toLowerCase();
  const keys: FluxIndexQueryKey[] = [];
  if (/^plugin\s+(update|activate|deactivate|delete)\b/.test(c)) {
    keys.push(['flux-one', 'index', 'plugins']);
  }
  if (/^user\s+add\b/.test(c) || /^user\s+lock\b/.test(c) || /^user\s+unlock\b/.test(c) || /^user\s+role\s+set\b/.test(c)) {
    keys.push(['flux-one', 'index', 'users']);
  }
  if (/^config\s+set\b/.test(c)) {
    keys.push(['flux-one', 'index', 'suite-config']);
  }
  return keys;
}

export function CommandCentralMount({ kind }: { kind: 'overlay' | 'dashboardWidget' | 'dev' }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(() => {
    if (kind !== 'overlay') return true;
    const wantsOpen = typeof window !== 'undefined' && (window as any).__fluxOneOpenOnLoad === true;
    return wantsOpen;
  });
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
  const commandsModalSearchRef = useRef<HTMLInputElement | null>(null);
  const dashboardFocusAppliedRef = useRef(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [commandsModalOpen, setCommandsModalOpen] = useState(false);
  const [commandsHelpQuery, setCommandsHelpQuery] = useState('');
  const [aggregateEmailModalOpen, setAggregateEmailModalOpen] = useState(false);
  const aggregateEmailDays = 7;
  const emailCaptureEnabledRef = useRef(false);
  const [emailCaptureEnabled, setEmailCaptureEnabled] = useState(false);
  const [recentNavigations, setRecentNavigations] = useState<
    Array<{ label: string; url?: string; command?: string }>
  >([]);
  const [inputFocused, setInputFocused] = useState(false);
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  const [fastPathLoading, setFastPathLoading] = useState(false);
  const structuredPanelRef = useRef<HTMLDivElement | null>(null);
  const blurDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const uiShortcutRaw =
    typeof window !== 'undefined' && (window.fluxOneAdmin?.bootstrap as any)?.uiPrefs?.commandShortcut
      ? String((window.fluxOneAdmin?.bootstrap as any).uiPrefs.commandShortcut)
      : '';

  const parseShortcut = (raw: string) => {
    const s = String(raw || '').toLowerCase().trim();
    const parts = s ? s.split('+').map((p) => p.trim()).filter(Boolean) : [];
    const hasMod = parts.includes('mod');
    const hasShift = parts.includes('shift');
    const hasAlt = parts.includes('alt') || parts.includes('option');
    const key = parts.find((p) => !['mod', 'shift', 'alt', 'option', 'ctrl', 'cmd', 'meta'].includes(p)) || '';
    return { hasMod, hasShift, hasAlt, key };
  };

  const isMac = typeof navigator !== 'undefined' ? /Mac|iPhone|iPad|iPod/i.test(navigator.platform) : false;

  const formatShortcutLabel = (raw: string) => {
    const { hasMod, hasShift, hasAlt, key } = parseShortcut(raw);
    const mod = hasMod ? (isMac ? '⌘' : 'Ctrl') : '';
    const shift = hasShift ? (isMac ? '⇧' : 'Shift') : '';
    const alt = hasAlt ? (isMac ? '⌥' : 'Alt') : '';
    const k = key ? (key.length === 1 ? key.toUpperCase() : key) : '.';
    const chunks = [mod, shift, alt, k].filter(Boolean);
    return isMac ? chunks.join('') : chunks.join('+');
  };

  const effectiveShortcut = uiShortcutRaw && uiShortcutRaw.includes('mod+') ? uiShortcutRaw : 'mod+.';
  const shortcutLabel = formatShortcutLabel(effectiveShortcut);

  const label = useMemo(() => {
    if (kind === 'dashboardWidget') return 'Command Central';
    if (kind === 'overlay') return `Flux One (${shortcutLabel})`;
    return `Flux One (Dev) (${shortcutLabel})`;
  }, [kind, shortcutLabel]);

  const focusAndSelectPrompt = () => {
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const openOverlay = () => {
    setIsOpen(true);
    setSuggestionsDismissed(false);
    focusAndSelectPrompt();
  };

  useEffect(() => {
    if (kind !== 'overlay') return;
    if (!isOpen) return;
    // Make focus reliable even if open was triggered before input mounted.
    requestAnimationFrame(() => {
      focusAndSelectPrompt();
    });
  }, [kind, isOpen]);

  const closeOverlay = () => {
    setIsOpen(false);
    setInputFocused(false);
    setSuggestionsDismissed(true);
  };

  const seedBootstrapFromWindow = () => {
    const boot = typeof window !== 'undefined' ? (window.fluxOneAdmin?.bootstrap as any) : null;
    if (!boot || typeof boot !== 'object') return false;

    const navs = boot?.commandMemory?.recentNavigations;
    if (Array.isArray(navs)) {
      setRecentNavigations(navs);
    }
    const cap = !!(boot?.emailPrefs && boot.emailPrefs.emailCaptureEnabled === true);
    emailCaptureEnabledRef.current = cap;
    setEmailCaptureEnabled(cap);
    setBootstrapped(true);
    return true;
  };

  useEffect(() => {
    // If PHP already embedded bootstrap data, avoid an initial REST call.
    if (bootstrapped) return;
    if (kind === 'dashboardWidget' || kind === 'dev') {
      seedBootstrapFromWindow();
    }
  }, [bootstrapped, kind]);

  useEffect(() => {
    // Seed pre-serialized destinations into React Query cache (instant nav suggestions).
    const dests =
      typeof window !== 'undefined' ? ((window.fluxOneAdmin as any)?.indices?.destinations as any) : null;
    if (!Array.isArray(dests) || dests.length === 0) return;
    queryClient.setQueryData(['flux-one', 'index', 'destinations'], dests as any);
  }, [queryClient]);

  const intent = useMemo(() => {
    const p = parseInput(input);
    const rt = getRouteTokens(p);
    const rt0 = rt[0] || '';
    const rt1 = rt[1] || '';
    const root = rt0 === 'summary' ? rt1 : rt0;
    return {
      root,
      wantsPlugins: root === 'plugin',
      wantsUsers: root === 'user',
      wantsMenus: root === 'menu',
      wantsSites: root === 'site',
      wantsDestinations: root === 'nav',
      wantsSuiteConfig: root === 'config',
      wantsEdit: root === 'edit',
    };
  }, [input]);

  const canFetchIndices = bootstrapped && (kind !== 'overlay' || isOpen);

  const [editDebouncedQ, setEditDebouncedQ] = useState('');
  const [editKind, setEditKind] = useState<'any' | 'post' | 'page'>('any');
  useEffect(() => {
    if (intent.root !== 'edit') {
      setEditDebouncedQ('');
      setEditKind('any');
      return;
    }
    const rawLower = input.toLowerCase();
    const kindFromInput = rawLower.startsWith('edit page') ? 'page' : rawLower.startsWith('edit post') ? 'post' : 'any';
    setEditKind(kindFromInput);
    const rest = rawLower.replace(/^edit\s+(p|post|page)\s*/i, '').trim();
    const t = window.setTimeout(() => {
      setEditDebouncedQ(rest);
    }, 160);
    return () => window.clearTimeout(t);
  }, [input, intent.root]);

  useEffect(() => {
    if (kind !== 'overlay') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const { hasMod, hasShift, hasAlt, key } = parseShortcut(effectiveShortcut);
      const wantsMod = hasMod ? (e.ctrlKey || e.metaKey) : true;
      const wantsShift = hasShift ? e.shiftKey : !e.shiftKey;
      const wantsAlt = hasAlt ? e.altKey : !e.altKey;
      const wantsKey = key ? e.key.toLowerCase() === key.toLowerCase() : e.key === '.';
      const wantsToggle = wantsMod && wantsShift && wantsAlt && wantsKey;
      if (!wantsToggle) return;
      e.preventDefault();
      if (!isOpen) {
        openOverlay();
      } else {
        closeOverlay();
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true } as any);
  }, [kind, effectiveShortcut, isOpen]);

  useEffect(() => {
    if (kind !== 'overlay') return;

    const open = () => openOverlay();

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
    if (kind !== 'overlay') return;
    const node = document.getElementById('wp-admin-bar-flux-one-command');
    const anchor = node?.querySelector('a');
    if (!anchor) return;
    // Admin bar label is rendered by PHP for immediate, stable UX.
  }, [kind, shortcutLabel]);

  useEffect(() => {
    if (!isOpen || bootstrapped || bootstrapping) return;
    if (seedBootstrapFromWindow()) {
      try {
        (window as any).__fluxOneOpenOnLoad = false;
      } catch {
        /* ignore */
      }
      return;
    }
    setBootstrapping(true);
    api
      .getBootstrap()
      .then((inner: any) => {
        const navs = inner?.commandMemory?.recentNavigations;
        if (Array.isArray(navs)) {
          setRecentNavigations(navs);
        }
        const cap = !!(inner?.emailPrefs && inner.emailPrefs.emailCaptureEnabled === true);
        emailCaptureEnabledRef.current = cap;
        setEmailCaptureEnabled(cap);
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
      inputRef.current?.select();
    });
  }, [kind, bootstrapped, bootstrapping]);

  const commandsModalWasOpenRef = useRef(false);
  useEffect(() => {
    if (commandsModalWasOpenRef.current && !commandsModalOpen) {
      commandsModalTriggerRef.current?.focus();
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    commandsModalWasOpenRef.current = commandsModalOpen;
  }, [commandsModalOpen]);

  // Indices (decoupled endpoints + React Query caching).
  const pluginsQuery = useQuery({
    queryKey: ['flux-one', 'index', 'plugins'],
    queryFn: () => api.getPluginsIndex(),
    enabled: canFetchIndices && intent.wantsPlugins,
  });
  const usersQuery = useQuery({
    queryKey: ['flux-one', 'index', 'users'],
    queryFn: () => api.getUsersIndex(),
    enabled: canFetchIndices && intent.wantsUsers,
  });
  const menusQuery = useQuery({
    queryKey: ['flux-one', 'index', 'menus'],
    queryFn: () => api.getMenusIndex(),
    enabled: canFetchIndices && intent.wantsMenus,
  });
  const sitesQuery = useQuery({
    queryKey: ['flux-one', 'index', 'sites'],
    queryFn: () => api.getSitesIndex(),
    enabled: canFetchIndices && intent.wantsSites,
  });
  const destinationsQuery = useQuery({
    queryKey: ['flux-one', 'index', 'destinations'],
    queryFn: () => api.getDestinationsIndex(),
    enabled: canFetchIndices && intent.wantsDestinations,
  });
  const suiteConfigQuery = useQuery({
    queryKey: ['flux-one', 'index', 'suite-config'],
    queryFn: () => api.getSuiteConfigIndex(),
    enabled: canFetchIndices && intent.wantsSuiteConfig,
    staleTime: 60_000,
  });

  const contentQuery = useQuery({
    queryKey: ['flux-one', 'index', 'content', editKind, editDebouncedQ],
    queryFn: () => api.getContentIndex(editDebouncedQ, editKind),
    enabled: canFetchIndices && intent.wantsEdit && editDebouncedQ.length > 0,
    staleTime: 10_000,
  });

  const aggregateEmailQuery = useQuery({
    queryKey: ['flux-one', 'aggregate', 'email', 7],
    queryFn: () => api.getEmailAggregate(7),
    enabled:
      bootstrapped &&
      !!selectedSuggestion &&
      selectedSuggestion.value === 'aggregate email' &&
      emailCaptureEnabled,
    staleTime: 60_000,
  });

  useEffect(() => {
    const boot = (typeof window !== 'undefined' && window.fluxOneAdmin?.bootstrap) as
      | { editableRoles?: string[] }
      | undefined;
    const editableRoles = Array.isArray(boot?.editableRoles) ? boot.editableRoles : [];
    const indices = {
      plugins: (pluginsQuery.data as any)?.data ?? pluginsQuery.data ?? [],
      users: (usersQuery.data as any)?.data ?? usersQuery.data ?? [],
      menus: (menusQuery.data as any)?.data ?? menusQuery.data ?? [],
      sites: (sitesQuery.data as any)?.data ?? sitesQuery.data ?? [],
      destinations: (destinationsQuery.data as any)?.data ?? destinationsQuery.data ?? [],
      suiteConfig: (suiteConfigQuery.data as any)?.data ?? suiteConfigQuery.data ?? [],
      content: (contentQuery.data as any)?.data ?? contentQuery.data ?? [],
      editableRoles,
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
    contentQuery.data,
    bootstrapped,
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
          if (/^plugin\s+(upload|add|install)\b/i.test(ctx.canonical)) {
            try {
              sessionStorage.setItem('fluxOneReturnAfterPluginFlow', window.location.href);
            } catch {
              /* private mode */
            }
          }
          window.location.assign(url);
        }
        return;
      }

      setLastResult(result);
      setLastDurationMs(ctx.durationMs);

      if (result.type === 'panel') {
        if (result.panelId === 'aggregate_email') {
          setAiData(null);
          setAggregateEmailModalOpen(true);
          if (!emailCaptureEnabledRef.current) {
            setPanelData(null);
          } else {
            api.getEmailAggregate(aggregateEmailDays).then((agg: any) => setPanelData(agg?.data ?? agg));
            const aiRequested = !!result?.data?.aiRequested;
            if (aiRequested) {
              api.getEmailSummary().then((ai: any) => setAiData(ai?.data ?? ai));
            }
          }
        } else {
          setPanelData(result.data ?? null);
        }
      }

      if (result.type === 'action' && result.status === 'success') {
        const seen = new Set<string>();
        for (const key of getInvalidatedIndexKeys(ctx.canonical)) {
          const sig = key.join(':');
          if (seen.has(sig)) continue;
          seen.add(sig);
          queryClient.invalidateQueries({ queryKey: [...key] });
        }
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

  /**
   * Central "busy/running" UX.
   *
   * - Server-backed commands use `commandMutation.isPending` (+ `variables` for label)
   * - Read-only fast path uses `fastPathLoading`
   * - Client-side navigation (nav + edit picks) sets `clientNavPending` so the spinner can paint before redirect
   * - Edit search (XHR suggestions) shows a lightweight spinner notice while `contentQuery` is fetching
   */
  const [clientNavPending, setClientNavPending] = useState(false);
  const [clientNavLabel, setClientNavLabel] = useState('');

  const buildIndices = (): IndexData => ({
    plugins: ((pluginsQuery.data as any)?.data ?? pluginsQuery.data ?? []) as IndexData['plugins'],
    users: ((usersQuery.data as any)?.data ?? usersQuery.data ?? []) as IndexData['users'],
    menus: ((menusQuery.data as any)?.data ?? menusQuery.data ?? []) as IndexData['menus'],
    sites: ((sitesQuery.data as any)?.data ?? sitesQuery.data ?? []) as IndexData['sites'],
    destinations: ((destinationsQuery.data as any)?.data ?? destinationsQuery.data ?? []) as IndexData['destinations'],
    suiteConfig: ((suiteConfigQuery.data as any)?.data ?? suiteConfigQuery.data ?? []) as IndexData['suiteConfig'],
  });

  const beginClientNav = (label: string) => {
    setClientNavLabel(label);
    setClientNavPending(true);
  };

  const recordClientNavMemory = (opts: { url?: string; command?: string; label?: string }) => {
    if (!opts.url && !opts.command) {
      return;
    }
    void api.recordRecentNavigation(opts).catch(() => {});
  };

  const tryReadOnlyFastPathAsync = async (canonical: string): Promise<boolean> => {
    const rows: Array<{
      keys: string[];
      panelId: string;
      queryKey: readonly ['flux-one', 'index', string];
      queryFn: () => Promise<unknown>;
    }> = [
      {
        keys: ['plugin list', 'plugin show'],
        panelId: 'plugins',
        queryKey: ['flux-one', 'index', 'plugins'],
        queryFn: () => api.getPluginsIndex(),
      },
      {
        keys: ['user list', 'user show'],
        panelId: 'users',
        queryKey: ['flux-one', 'index', 'users'],
        queryFn: () => api.getUsersIndex(),
      },
      {
        keys: ['site list', 'site show'],
        panelId: 'sites',
        queryKey: ['flux-one', 'index', 'sites'],
        queryFn: () => api.getSitesIndex(),
      },
      {
        keys: ['menu list', 'menu show'],
        panelId: 'menus',
        queryKey: ['flux-one', 'index', 'menus'],
        queryFn: () => api.getMenusIndex(),
      },
    ];
    for (const row of rows) {
      if (!row.keys.includes(canonical)) {
        continue;
      }
      try {
        const raw = await queryClient.fetchQuery({
          queryKey: row.queryKey,
          queryFn: row.queryFn,
        });
        const data = (raw as any)?.data ?? raw;
        if (!Array.isArray(data)) {
          return false;
        }
        setLastResult({ type: 'panel', panelId: row.panelId, command: canonical });
        setPanelData(data);
        setAiData(null);
        setLastDurationMs(0);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  };

  const executeFromInput = (rawCommand: string, picked?: Suggestion | null) => {
    const cmd = rawCommand.trim();
    if (!cmd || commandMutation.isPending || fastPathLoading || clientNavPending) {
      return;
    }
    const displayCmd = /^config(\s|$)/i.test(cmd) ? cmd : canonicalizeInput(cmd).canonical;
    setInput(displayCmd);
    setSuggestionsDismissed(true);
    const { canonical } = canonicalizeInput(cmd);

    setPanelData(null);
    setAiData(null);
    setLastResult(null);
    setLastDurationMs(null);

    const destinationsList: any[] = ((destinationsQuery.data as any)?.data ?? destinationsQuery.data ?? []) as any[];

    const effectivePick = picked ?? mergedSuggestions[activeSuggestion] ?? null;

    if (effectivePick?.clientAction === 'nav' && effectivePick.navUrl) {
      const { canonical: navCanon } = canonicalizeInput(effectivePick.value.trim());
      const navUrl = String(effectivePick.navUrl);
      recordClientNavMemory({
        url: navUrl,
        command: navCanon,
        label: effectivePick.label,
      });
      beginClientNav(navCanon);
      requestAnimationFrame(() => window.location.assign(navUrl));
      return;
    }

    if (canonical.startsWith('nav ')) {
      const rest = canonical.slice(4).trim();
      const url = resolveNavDestinationUrl(rest, destinationsList);
      if (url) {
        const hit = destinationsList.find((d) => d.url === url);
        recordClientNavMemory({ url, command: canonical, label: hit?.label });
        beginClientNav(canonical);
        requestAnimationFrame(() => window.location.assign(url));
        return;
      }
    }

    if (canonical.startsWith('menu show')) {
      const rest = canonical.replace(/^menu\s+show\s*/i, '').trim();
      const list = menusIndex || [];
      if (list.length) {
        const q = rest.toLowerCase();
        const strong = q
          ? list.filter(
              (m: any) => q === String(m.name || '').toLowerCase() || q === String(m.slug || '').toLowerCase()
            )
          : [];
        const strongHit = strong.length === 1 ? strong[0] : null;
        if (strongHit) {
          window.open(
            `${adminBase}nav-menus.php?action=edit&menu=${encodeURIComponent(String(strongHit.id))}`,
            '_blank'
          );
          return;
        }
        if (q) {
          const fuse = new Fuse(list, { keys: ['name', 'slug'], threshold: 0.35, ignoreLocation: true });
          const r = fuse.search(q);
          if (r.length === 1) {
            const m = r[0]?.item as any;
            if (m) {
              window.open(
                `${adminBase}nav-menus.php?action=edit&menu=${encodeURIComponent(String(m.id))}`,
                '_blank'
              );
              return;
            }
          }
        }
      }
    }

    void (async () => {
      setFastPathLoading(true);
      let usedFastPath = false;
      try {
        usedFastPath = await tryReadOnlyFastPathAsync(canonical);
      } catch {
        usedFastPath = false;
      } finally {
        setFastPathLoading(false);
      }
      if (usedFastPath) {
        return;
      }
      commandMutation.mutate(cmd);
    })();
  };

  const isEditSearching = intent.wantsEdit && editDebouncedQ.length > 0 && contentQuery.isFetching;

  const isExecuting = commandMutation.isPending || fastPathLoading || clientNavPending;
  const isBusy = isExecuting || isEditSearching;

  const runningLabel = (() => {
    if (clientNavPending) return clientNavLabel;
    if (commandMutation.variables != null) return canonicalizeInput(String(commandMutation.variables)).canonical;
    if (isEditSearching) {
      const kindLabel = editKind === 'page' ? 'page' : editKind === 'post' ? 'post' : 'p';
      return `edit ${kindLabel} ${editDebouncedQ}`.trim();
    }
    return '';
  })();

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
    !!(lastResult as any).panelId &&
    ['plugins', 'users', 'sites', 'menus', 'suite_config'].includes((lastResult as any).panelId) &&
    Array.isArray(panelData);

  useLayoutEffect(() => {
    if (!isStructuredListPanel || !structuredPanelRef.current) {
      return;
    }
    structuredPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [isStructuredListPanel, (lastResult as any)?.panelId, panelData]);

  const isInputReallyFocused =
    typeof document !== 'undefined' && inputRef.current ? document.activeElement === inputRef.current : false;

  const intentLoadingLabel = (() => {
    if (intent.root === 'nav' && destinationsQuery.isFetching && destinationsQuery.data == null) return 'Loading destinations…';
    if (intent.root === 'plugin' && pluginsQuery.isFetching && pluginsQuery.data == null) return 'Loading plugins…';
    if (intent.root === 'user' && usersQuery.isFetching && usersQuery.data == null) return 'Loading users…';
    if (intent.root === 'menu' && menusQuery.isFetching && menusQuery.data == null) return 'Loading menus…';
    if (intent.root === 'site' && sitesQuery.isFetching && sitesQuery.data == null) return 'Loading sites…';
    if (intent.root === 'config' && suiteConfigQuery.isFetching && suiteConfigQuery.data == null) return 'Loading configuration…';
    if (intent.root === 'edit' && contentQuery.isFetching && contentQuery.data == null) return 'Searching…';
    return '';
  })();

  const showSuggestionOverlay =
    isInputReallyFocused &&
    !suggestionsDismissed &&
    !isBusy &&
    (commandRow.length > 0 || subcommandRow.length > 0);

  const showSuggestionChrome =
    isInputReallyFocused &&
    !suggestionsDismissed &&
    !isBusy &&
    !!selectedSuggestion &&
    (commandRow.length > 0 || subcommandRow.length > 0);

  const filteredCommandDocs = useMemo(() => filterCommandDocs(commandsHelpQuery), [commandsHelpQuery]);

  if (kind === 'overlay' && !isOpen) {
    return null;
  }

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
                onClick={() => closeOverlay()}
                style={{
                  border: '1px solid rgba(0,0,0,0.16)',
                  background: '#fff',
                  borderRadius: 6,
                  padding: 6,
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
                aria-label="Close"
                title="Close"
              >
                <span className="dashicons dashicons-no" aria-hidden style={{ width: 18, height: 18, fontSize: 18 }} />
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
              disabled={isExecuting}
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
                opacity: isExecuting ? 0.75 : 1,
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
                {intentLoadingLabel ? (
                  <div className="flux-one-suggest-dropdown__section">{intentLoadingLabel}</div>
                ) : null}
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
                        if (outcome.kind === 'complete_and_run' || outcome.kind === 'run') {
                          executeFromInput(outcome.value, s);
                        }
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
                      <span>{s.displayLabel || s.label}</span>
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
                        if (outcome.kind === 'complete_and_run' || outcome.kind === 'run') {
                          executeFromInput(outcome.value, s);
                        }
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
                      <span>{s.displayLabel || s.label}</span>
                      <span style={{ opacity: 0.6, fontSize: 12 }}>{s.kind}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {isBusy ? (
          <div className="flux-one-notice flux-one-notice--running" role="status" aria-live="polite">
            <span className="flux-one-spinner" aria-hidden />
            <span>
              {isEditSearching && !isExecuting ? (
                <>
                  Searching… <span style={{ opacity: 0.75 }}>{runningLabel}</span>
                </>
              ) : (
                <>
                  Running… <span style={{ opacity: 0.75 }}>{runningLabel}</span>
                </>
              )}
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
                  {!emailCaptureEnabled ? (
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                      Turn on email capture for your user under{' '}
                      <a href={`${adminBase}admin.php?page=flux-one#/settings`}>Flux One → Settings</a> to load an
                      aggregate here.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 13, opacity: 0.85 }}>
                        Opens a full list of captured emails in a modal.
                      </div>
                      <button
                        type="button"
                        className="button button-small"
                        onClick={() => {
                          setAggregateEmailModalOpen(true);
                          if (emailCaptureEnabledRef.current) {
                            setPanelData(null);
                            api.getEmailAggregate(aggregateEmailDays).then((agg: any) => setPanelData(agg?.data ?? agg));
                          }
                        }}
                      >
                        Open aggregate
                      </button>
                    </div>
                  )}
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
                    <span
                      style={{ flex: '2 1 240px', fontWeight: 600 }}
                      title={`Config id: ${row.id}`}
                    >
                      {row.label}
                    </span>
                    <span style={{ flex: '1 1 140px', opacity: 0.75, fontSize: 12 }}>{row.plugin}</span>
                    <span style={{ flex: '1 1 120px', fontSize: 12, opacity: 0.65 }}>{row.type}</span>
                    <span style={{ flex: '1 1 120px', fontWeight: 600 }}>{row.valueDisplay}</span>
                    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
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

        {lastResult?.type === 'panel' && lastResult.panelId === 'aggregate_email' ? (
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
            {!emailCaptureEnabled ? (
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                Email capture is off for your user. Enable it under{' '}
                <a href={`${adminBase}admin.php?page=flux-one#/settings`}>Flux One → Settings</a>, then run this
                command again to see logged mail.
              </div>
            ) : panelData ? (
              <div style={{ fontSize: 13, opacity: 0.9 }}>
                Loaded {Array.isArray((panelData as any)?.events) ? (panelData as any).events.length : '—'} events. Modal opened.
              </div>
            ) : (
              <div style={{ fontSize: 13, opacity: 0.8 }}>Loading aggregate…</div>
            )}
          </div>
        ) : null}

      <FluxOneModal
        open={aggregateEmailModalOpen}
        onClose={() => {
          setAggregateEmailModalOpen(false);
          focusAndSelectPrompt();
        }}
        title={`Aggregate email (${aggregateEmailDays}d)`}
      >
        {!emailCaptureEnabled ? (
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            Email capture is off for your user. Enable it under{' '}
            <a href={`${adminBase}admin.php?page=flux-one#/settings`}>Flux One → Settings</a>, then run this command again.
          </div>
        ) : panelData ? (
          <EmailAggregateView data={panelData as EmailAggregatePayload | null} mode="flat_all" />
        ) : (
          <div style={{ fontSize: 13, opacity: 0.8 }}>Loading aggregate…</div>
        )}
      </FluxOneModal>

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

      <FluxOneModal
        open={commandsModalOpen}
        onClose={() => setCommandsModalOpen(false)}
        title="Command reference"
        initialFocusRef={commandsModalSearchRef}
      >
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
              {row.aliases?.length ? (
                <div style={{ opacity: 0.6, fontSize: 11, marginTop: 4 }}>Aliases: {row.aliases.join(', ')}</div>
              ) : null}
            </div>
          ))}
          {filteredCommandDocs.length === 0 ? <div style={{ opacity: 0.7, fontSize: 13 }}>No matches.</div> : null}
        </div>
      </FluxOneModal>
    </div>
  );
}

