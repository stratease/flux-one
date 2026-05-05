import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api } from '../utils/api';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getGhostRemainder } from '../command/ghost';
import { getRouteTokens, getSuggestions, resolveNavDestinationUrl, type IndexData } from '../command/suggest';
import { canonicalizeInput, parseInput } from '../command/normalize';
import type { Suggestion } from '../command/types';
import { filterCommandDocs } from '../command/commandDocs';
import { interpretEnter, interpretSuggestionPick } from '../command/interpretEnter';
import { getIntent } from '../command/intent';
import { EmailAggregateView, type EmailAggregatePayload, type EmailSummaryMap } from './EmailAggregateView';
import { FluxOneModal } from './FluxOneModal';
import { CommandCentralHeader } from './command-central/CommandCentralHeader';
import { RecentAdminPages } from './command-central/RecentAdminPages';
import { StructuredListPanels } from './command-central/StructuredListPanels';
import Fuse from 'fuse.js';
import { parseShortcut } from '../admin/commandShortcut';

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

const MAX_EMAIL_SUMMARY_EVENT_IDS = 25;

function summaryMapFromByEventId(by: unknown): EmailSummaryMap {
  const map: EmailSummaryMap = {};
  if (!by || typeof by !== 'object') {
    return map;
  }
  for (const [k, v] of Object.entries(by as Record<string, unknown>)) {
    const id = parseInt(String(k), 10);
    if (!id || !v || typeof v !== 'object') {
      continue;
    }
    const o = v as Record<string, unknown>;
    map[id] = {
      summary: String(o.summary ?? ''),
      action: o.action != null ? String(o.action) : undefined,
      isUrgent: !!(o.isUrgent ?? o.is_urgent),
      summarizedAt:
        o.summarizedAt != null
          ? String(o.summarizedAt)
          : o.summarized_at != null
            ? String(o.summarized_at)
            : undefined,
    };
  }
  return map;
}

function parseEmailSummaryEnvelope(raw: unknown): { inner: any; map: EmailSummaryMap } {
  const r = raw as any;
  const payload = r?.data ?? r;
  const inner = payload?.ai ?? payload;
  const by = inner?.summaries?.by_event_id ?? {};
  return { inner, map: summaryMapFromByEventId(by) };
}

/** Cached summaries embedded on GET aggregate/email (no AI). */
function parseCachedSummariesFromAggregatePayload(data: unknown): EmailSummaryMap {
  const d = data as { summaries?: { by_event_id?: unknown } } | null | undefined;
  return summaryMapFromByEventId(d?.summaries?.by_event_id);
}

function getVisibleEmailEventIdsForSummary(data: EmailAggregatePayload | null | undefined): number[] {
  const events = Array.isArray(data?.events) ? data!.events! : [];
  return events
    .map((e) => Number(e.id))
    .filter((n) => n > 0)
    .slice(0, MAX_EMAIL_SUMMARY_EVENT_IDS);
}

function formatAggregateEmailModalTitle(meta: EmailAggregatePayload['meta'] | undefined, days: number): string {
  const total = Number(meta?.total ?? 0);
  const d = Number(days);
  const safeDays = d > 0 ? d : 7;
  return `Aggregate email · ${total} email${total === 1 ? '' : 's'} · last ${safeDays} day${safeDays === 1 ? '' : 's'}`;
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
  const aggregateEmailSearchRef = useRef<HTMLInputElement | null>(null);
  const dashboardFocusAppliedRef = useRef(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [commandsModalOpen, setCommandsModalOpen] = useState(false);
  const [commandsHelpQuery, setCommandsHelpQuery] = useState('');
  const [aggregateEmailModalOpen, setAggregateEmailModalOpen] = useState(false);
  const [aggregateEmailDays, setAggregateEmailDays] = useState<number>(7);
  const [aggregateEmailQ, setAggregateEmailQ] = useState<string>('');
  const [aggregateEmailPage, setAggregateEmailPage] = useState<number>(1);
  const [aggregateEmailPerPage, setAggregateEmailPerPage] = useState<number>(20);
  const [aggregateEmailDebouncedQ, setAggregateEmailDebouncedQ] = useState<string>('');
  const [aggregateEmailSummary, setAggregateEmailSummary] = useState<{ status: 'idle' | 'loading' | 'error' | 'pending'; message?: string }>(
    { status: 'idle' }
  );
  const [generatedEmailSummaryMap, setGeneratedEmailSummaryMap] = useState<EmailSummaryMap>({});
  const aggregateEmailFilterCommittedRef = useRef<string>('');
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

  const intent = useMemo(() => getIntent(input), [input]);

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
    const t = window.setTimeout(() => setAggregateEmailDebouncedQ(aggregateEmailQ.trim()), 250);
    return () => window.clearTimeout(t);
  }, [aggregateEmailQ]);

  useEffect(() => {
    setAggregateEmailPage(1);
  }, [aggregateEmailDays, aggregateEmailDebouncedQ, aggregateEmailPerPage]);

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

  const licenseValid = useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    const lic = (window.fluxOneAdmin?.bootstrap as { license?: { valid?: boolean } } | undefined)?.license;
    return !!lic?.valid;
  }, [bootstrapped]);

  useEffect(() => {
    if (!aggregateEmailModalOpen) {
      setGeneratedEmailSummaryMap({});
      setAggregateEmailSummary({ status: 'idle' });
    }
  }, [aggregateEmailModalOpen]);

  const aggregateEmailFilterKey = useMemo(
    () => `${aggregateEmailDays}|${aggregateEmailDebouncedQ}`,
    [aggregateEmailDays, aggregateEmailDebouncedQ]
  );

  const aggregateEmailModalQuery = useQuery({
    queryKey: [
      'flux-one',
      'aggregate',
      'email',
      aggregateEmailDays,
      aggregateEmailDebouncedQ,
      aggregateEmailPage,
      aggregateEmailPerPage,
    ],
    queryFn: async () => {
      const raw = await api.getEmailAggregate({
        days: aggregateEmailDays,
        q: aggregateEmailDebouncedQ,
        page: aggregateEmailPage,
        perPage: aggregateEmailPerPage,
      });
      return (raw as any)?.data ?? raw;
    },
    enabled: bootstrapped && aggregateEmailModalOpen && emailCaptureEnabled,
    staleTime: 5_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (!aggregateEmailModalOpen) {
      aggregateEmailFilterCommittedRef.current = '';
      return;
    }
    if (aggregateEmailModalQuery.isFetching) {
      return;
    }
    if (aggregateEmailModalQuery.isSuccess && aggregateEmailModalQuery.data != null) {
      aggregateEmailFilterCommittedRef.current = aggregateEmailFilterKey;
    }
  }, [
    aggregateEmailModalOpen,
    aggregateEmailModalQuery.isFetching,
    aggregateEmailModalQuery.isSuccess,
    aggregateEmailModalQuery.data,
    aggregateEmailFilterKey,
  ]);

  const showAggregateEmailSkeleton = useMemo(() => {
    if (!emailCaptureEnabled || !aggregateEmailModalOpen || !aggregateEmailModalQuery.isFetching) {
      return false;
    }
    if (!aggregateEmailModalQuery.data) {
      return true;
    }
    return aggregateEmailFilterKey !== aggregateEmailFilterCommittedRef.current;
  }, [
    emailCaptureEnabled,
    aggregateEmailModalOpen,
    aggregateEmailModalQuery.isFetching,
    aggregateEmailModalQuery.data,
    aggregateEmailFilterKey,
  ]);

  const cachedEmailSummaryMap = useMemo(
    () => parseCachedSummariesFromAggregatePayload(aggregateEmailModalQuery.data),
    [aggregateEmailModalQuery.data]
  );

  const effectiveEmailSummaryMap = useMemo(
    () => ({ ...cachedEmailSummaryMap, ...generatedEmailSummaryMap }),
    [cachedEmailSummaryMap, generatedEmailSummaryMap]
  );

  const hasSummaryTextOnVisiblePage = useMemo(() => {
    const d = aggregateEmailModalQuery.data as EmailAggregatePayload | null | undefined;
    const events = Array.isArray(d?.events) ? d.events : [];
    for (const e of events) {
      const ent = effectiveEmailSummaryMap[e.id];
      if (ent && String(ent.summary || '').trim() !== '') {
        return true;
      }
    }
    return false;
  }, [aggregateEmailModalQuery.data, effectiveEmailSummaryMap]);

  async function summarizeVisibleEmailPage(data: EmailAggregatePayload | null | undefined): Promise<void> {
    const ids = getVisibleEmailEventIdsForSummary(data);
    if (ids.length === 0) {
      setAggregateEmailSummary({ status: 'pending', message: 'No email events to summarize.' });
      return;
    }
    setAggregateEmailSummary({ status: 'loading' });
    try {
      const raw = await api.getEmailSummary(ids);
      const { inner, map } = parseEmailSummaryEnvelope(raw);
      setGeneratedEmailSummaryMap((prev) => ({ ...prev, ...map }));
      const msg = String(inner?.message || '');
      const st = String(inner?.status || '');
      const en = inner?.enabled !== false;
      if (!en) {
        setAggregateEmailSummary({ status: 'error', message: msg || 'Summary unavailable.' });
      } else if (st === 'empty') {
        setAggregateEmailSummary({ status: 'pending', message: msg });
      } else {
        setAggregateEmailSummary({ status: 'pending', message: msg || 'Summaries loaded.' });
      }
      setAiData((raw as any)?.data ?? raw);
      void queryClient.invalidateQueries({ queryKey: ['flux-one', 'aggregate', 'email'] });
    } catch (e: any) {
      setAggregateEmailSummary({
        status: 'error',
        message: String(e?.message || e?.data?.message || 'Summary failed.'),
      });
    }
  }

  const summaryEligibleEventCount = getVisibleEmailEventIdsForSummary(
    aggregateEmailModalQuery.data as EmailAggregatePayload | undefined
  ).length;

  const aggregateEmailSummarizeDisabled =
    showAggregateEmailSkeleton ||
    !licenseValid ||
    !aggregateEmailModalQuery.data ||
    aggregateEmailSummary.status === 'loading' ||
    !Array.isArray((aggregateEmailModalQuery.data as any)?.events) ||
    (aggregateEmailModalQuery.data as any).events.length === 0;

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
          const aiRequested = !!result?.data?.aiRequested;
          if (!aiRequested) {
            setAggregateEmailSummary({ status: 'idle' });
          }
          setAggregateEmailModalOpen(true);
          if (!emailCaptureEnabledRef.current) {
            setPanelData(null);
          } else {
            if (aiRequested) {
              setAggregateEmailDays(7);
              setAggregateEmailQ('');
              setAggregateEmailPage(1);
              setAggregateEmailPerPage(20);
            }
            if (aiRequested) {
              setAggregateEmailSummary({ status: 'loading' });
              void (async () => {
                try {
                  const data = await queryClient.fetchQuery({
                    queryKey: ['flux-one', 'aggregate', 'email', 7, '', 1, 20],
                    queryFn: async () => {
                      const rawAgg = await api.getEmailAggregate({ days: 7, q: '', page: 1, perPage: 20 });
                      return (rawAgg as any)?.data ?? rawAgg;
                    },
                  });
                  await summarizeVisibleEmailPage(data as EmailAggregatePayload);
                } catch (e: any) {
                  setAggregateEmailSummary({
                    status: 'error',
                    message: String(e?.message || e?.data?.message || 'Summary failed.'),
                  });
                }
              })();
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
    <div className={`flux-one-theme flux-one-mount flux-one-mount--${kind}`}>
      <div>
        <CommandCentralHeader
          label={label}
          kind={kind}
          commandsModalTriggerRef={commandsModalTriggerRef}
          onOpenCommandReference={() => setCommandsModalOpen(true)}
          onCloseOverlay={closeOverlay}
        />

        <div className="flux-one-body">
        {kind === 'dashboardWidget' && recentNavigations.length > 0 ? (
          <RecentAdminPages items={recentNavigations} />
        ) : null}
        {bootstrapping ? (
          <div className="flux-one-flex-center-gap">
            <span>Loading…</span>
          </div>
        ) : null}

        <div className="flux-one-command-input-wrap">
          <label className="flux-one-field-label">Command</label>
          <div className="flux-one-input-stack">
            <div aria-hidden="true" className="flux-one-ghost-layer">
              <span className="flux-one-ghost-transparent">{input}</span>
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
              className="flux-one-command-input"
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
                        [
                          'flux-one-suggest-dropdown__row',
                          'flux-one-suggest-dropdown__row--interactive',
                          idx === activeSuggestion ? 'flux-one-suggest-dropdown__row--active' : '',
                          isExecuting ? 'flux-one-suggest-dropdown__row--disabled' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')
                      }
                    >
                      <span>{s.displayLabel || s.label}</span>
                      <span className="flux-one-suggest-dropdown__meta">{s.kind}</span>
                    </div>
                  );
                })}
                {subcommandRow.length ? (
                  <div
                    className={
                      commandRow.length
                        ? 'flux-one-suggest-dropdown__section flux-one-suggest-dropdown__section--divider'
                        : 'flux-one-suggest-dropdown__section'
                    }
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
                        [
                          'flux-one-suggest-dropdown__row',
                          'flux-one-suggest-dropdown__row--interactive',
                          idx === activeSuggestion ? 'flux-one-suggest-dropdown__row--active' : '',
                          isExecuting ? 'flux-one-suggest-dropdown__row--disabled' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')
                      }
                    >
                      <span>{s.displayLabel || s.label}</span>
                      <span className="flux-one-suggest-dropdown__meta">{s.kind}</span>
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
                  Searching… <span className="flux-one-running-label-muted">{runningLabel}</span>
                </>
              ) : (
                <>
                  Running… <span className="flux-one-running-label-muted">{runningLabel}</span>
                </>
              )}
            </span>
          </div>
        ) : null}

        {/* Preview (single pane below, avoids “two columns” UI) */}
        {showSuggestionChrome && selectedSuggestion ? (
          <div className="flux-one-preview-card">
            <div className="flux-one-preview-title">{selectedSuggestion.label}</div>
            <div className="flux-one-preview-desc">{selectedSuggestion.description || selectedSuggestion.value}</div>

            {/* Proactive previews after-space */}
            {parsed.hasTrailingSpace && rt0 === 'plugin' ? (
              <div>
                <div className="flux-one-preview-section-title">Plugins</div>
                <div className="flux-one-preview-scroll">
                  {(pluginsIndex || []).slice(0, 12).map((p) => (
                    <div key={p.pluginFile} className="flux-one-preview-row">
                      <span>{p.name}</span>
                      <span className="flux-one-preview-meta">
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
                <div className="flux-one-preview-section-title">Users</div>
                <div className="flux-one-preview-scroll">
                  {(usersIndex || []).slice(0, 12).map((u) => (
                    <div key={u.id} className="flux-one-preview-row">
                      <span>{u.email}</span>
                      <span className="flux-one-preview-meta">{u.displayName || ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {parsed.hasTrailingSpace && rt0 === 'menu' ? (
              <div>
                <div className="flux-one-preview-section-title">Menus</div>
                <div className="flux-one-preview-scroll">
                  {(menusIndex || []).slice(0, 12).map((m) => (
                    <div key={m.id} className="flux-one-preview-row">
                      <span>{m.name}</span>
                      <span className="flux-one-preview-meta">{m.slug || ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {parsed.hasTrailingSpace && rt0 === 'site' && rt1 === 'switch' ? (
              <div>
                <div className="flux-one-preview-section-title">Sites</div>
                <div className="flux-one-preview-scroll">
                  {(sitesIndex || []).slice(0, 12).map((s) => (
                    <div key={s.blogId} className="flux-one-preview-row">
                      <span>{`${s.domain}${s.path}`}</span>
                      <span className="flux-one-preview-meta">#{s.blogId}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {selectedSuggestion.value === 'aggregate email' ? (
              <div className="flux-one-preview-stack">
                <div className="flux-one-preview-title">Aggregate email (7d)</div>
                <div className="flux-one-preview-scroll">
                  {!emailCaptureEnabled ? (
                    <div className="flux-one-body-copy">
                      Turn on email capture for your user under{' '}
                      <a href={`${adminBase}admin.php?page=flux-one#/settings`}>Flux One → Settings</a> to load an
                      aggregate here.
                    </div>
                  ) : (
                    <div className="flux-one-preview-aggregate-hint">
                      <div className="flux-one-preview-aggregate-copy">
                        Opens a full list of captured emails in a modal.
                      </div>
                      <button
                        type="button"
                        className="button button-small"
                        onClick={() => {
                          setAggregateEmailModalOpen(true);
                          if (emailCaptureEnabledRef.current) {
                            void aggregateEmailModalQuery.refetch();
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
              <div className="flux-one-preview-stack-inner">
                AI summary will run when executed (feature-gated).
              </div>
            ) : null}
          </div>
        ) : null}

        {lastResult?.type === 'action' && lastResult.status === 'success' ? (
          <div className="flux-one-notice flux-one-notice--success" role="status">
            {getActionDisplayMessage(lastResult) || lastResult.message || 'Done.'}
            {lastDurationMs != null && lastDurationMs >= 2000 ? (
              <span className="flux-one-running-label-muted"> ({(lastDurationMs / 1000).toFixed(1)}s)</span>
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
          <StructuredListPanels
            structuredPanelRef={structuredPanelRef}
            panelId={(lastResult as { panelId: string }).panelId}
            panelData={panelData}
            adminBase={adminBase}
            executeFromInput={executeFromInput}
          />
        ) : null}

        {lastResult?.type === 'panel' && lastResult.panelId === 'aggregate_email' ? (
          <div className="flux-one-aggregate-inline">
            <div className="flux-one-structured-panel-title">Aggregate email (7d)</div>
            {!emailCaptureEnabled ? (
              <div className="flux-one-body-copy">
                Email capture is off for your user. Enable it under{' '}
                <a href={`${adminBase}admin.php?page=flux-one#/settings`}>Flux One → Settings</a>, then run this
                command again to see logged mail.
              </div>
            ) : (
              <div className="flux-one-muted-loading">Loading aggregate…</div>
            )}
          </div>
        ) : null}

      <FluxOneModal
        open={aggregateEmailModalOpen}
        onClose={() => {
          setAggregateEmailModalOpen(false);
          focusAndSelectPrompt();
        }}
        title={formatAggregateEmailModalTitle(
          (aggregateEmailModalQuery.data as EmailAggregatePayload | undefined)?.meta,
          aggregateEmailDays
        )}
        size="wide"
        initialFocusRef={aggregateEmailSearchRef}
      >
        {!emailCaptureEnabled ? (
          <div className="flux-one-body-copy">
            Email capture is off for your user. Enable it under{' '}
            <a href={`${adminBase}admin.php?page=flux-one#/settings`}>Flux One → Settings</a>, then run this command again.
          </div>
        ) : (
          <>
            <div className="flux-one-email-toolbar">
              <label className="flux-one-email-toolbar-label">
                <span>Days</span>
                <select
                  value={aggregateEmailDays}
                  onChange={(e) => setAggregateEmailDays(parseInt(e.currentTarget.value || '7', 10) || 7)}
                >
                  {[7, 14, 30, 60, 90, 180, 365].map((d) => (
                    <option key={d} value={d}>
                      {d}d
                    </option>
                  ))}
                </select>
              </label>

              <input
                type="search"
                ref={aggregateEmailSearchRef}
                value={aggregateEmailQ}
                onChange={(e) => setAggregateEmailQ(e.currentTarget.value)}
                placeholder="Search subject + content…"
                className="flux-one-email-search-input"
              />

              <label className="flux-one-email-toolbar-label">
                <span>Per page</span>
                <select
                  value={aggregateEmailPerPage}
                  onChange={(e) => setAggregateEmailPerPage(parseInt(e.currentTarget.value || '20', 10) || 20)}
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {aggregateEmailModalQuery.data ? (
              <div className="flux-one-email-pagination">
                <div className="flux-one-email-pagination-meta">
                  {(() => {
                    const m = (aggregateEmailModalQuery.data as any)?.meta || {};
                    const page = Number(m.page || 1);
                    const totalPages = Number(m.totalPages || 0);
                    const total = Number(m.total || 0);
                    return `Total: ${isFinite(total) ? total : '—'} · Page: ${page}${totalPages ? `/${totalPages}` : ''}`;
                  })()}
                </div>
                <div className="flux-one-flex-row-gap">
                  <button
                    type="button"
                    className="button button-small"
                    onClick={() => setAggregateEmailPage((p) => Math.max(1, p - 1))}
                    disabled={aggregateEmailPage <= 1}
                    aria-disabled={aggregateEmailPage <= 1}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    className="button button-small"
                    onClick={() => setAggregateEmailPage((p) => p + 1)}
                    disabled={
                      Number((aggregateEmailModalQuery.data as any)?.meta?.totalPages || 0) > 0 &&
                      aggregateEmailPage >= Number((aggregateEmailModalQuery.data as any)?.meta?.totalPages || 0)
                    }
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
            <EmailAggregateView
              data={(aggregateEmailModalQuery.data as EmailAggregatePayload | null) ?? null}
              mode="flat_all"
              emailSummaries={effectiveEmailSummaryMap}
              listHeader={
                <>
                  {aggregateEmailSummary.status === 'loading' ? (
                    <div
                      className="flux-one-notice flux-one-notice--running flux-one-email-list-header__running"
                      role="status"
                      aria-live="polite"
                    >
                      <span className="flux-one-spinner" aria-hidden />
                      <span>
                        Summarizing…{' '}
                        <span className="flux-one-running-label-muted">
                          {summaryEligibleEventCount} email{summaryEligibleEventCount === 1 ? '' : 's'}
                        </span>
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="button button-small flux-one-email-summarize-btn"
                      data-testid="flux-one-email-summarize"
                      disabled={aggregateEmailSummarizeDisabled}
                      aria-disabled={aggregateEmailSummarizeDisabled}
                      title={
                        !licenseValid
                          ? 'Requires active Flux Suite license.'
                          : 'Summarize emails on this page (may use API quota).'
                      }
                      onClick={() => {
                        void summarizeVisibleEmailPage(aggregateEmailModalQuery.data as EmailAggregatePayload);
                      }}
                    >
                      Summarize
                    </button>
                  )}

                  {aggregateEmailModalQuery.data &&
                  Array.isArray((aggregateEmailModalQuery.data as any)?.events) &&
                  (aggregateEmailModalQuery.data as any).events.length > 0 &&
                  aggregateEmailSummary.status === 'idle' &&
                  !hasSummaryTextOnVisiblePage ? (
                    <span className="flux-one-email-hint" data-testid="flux-one-summary-empty-hint">
                      Summary: none generated yet.
                    </span>
                  ) : null}

                  {aggregateEmailSummary.status !== 'idle' && aggregateEmailSummary.status !== 'loading' ? (
                    <span className="flux-one-email-hint">
                      {aggregateEmailSummary.message
                        ? `Summary: ${aggregateEmailSummary.message}`
                        : 'Summary: unavailable.'}
                    </span>
                  ) : null}
                </>
              }
              showListDetailSkeleton={showAggregateEmailSkeleton}
            />
          </>
        )}
      </FluxOneModal>

        {lastResult?.type === 'panel' && lastResult.panelId === 'user' && panelData && typeof panelData === 'object' && !Array.isArray(panelData) ? (
          <div className="flux-one-user-panel">
            <strong>User</strong> {(panelData as { email?: string }).email || ''}
          </div>
        ) : null}

        {lastResult?.type === 'panel' && panelData && !isStructuredListPanel && lastResult.panelId !== 'aggregate_email' && lastResult.panelId !== 'user' ? (
          <div className="flux-one-result-block">
            {kind !== 'dev' ? <div className="flux-one-result-heading">Result</div> : null}
            <pre className="flux-one-pre">{JSON.stringify(panelData, null, 2)}</pre>
          </div>
        ) : null}

        {aiData ? (
          <pre className="flux-one-pre flux-one-pre--short">{JSON.stringify(aiData, null, 2)}</pre>
        ) : null}

        {kind === 'dev' && lastResult ? (
          <pre className="flux-one-pre flux-one-pre--short">{JSON.stringify(lastResult, null, 2)}</pre>
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
          className="flux-one-command-ref-search"
        />
        <div className="flux-one-modal-doc-list">
          {filteredCommandDocs.map((row) => (
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
          {filteredCommandDocs.length === 0 ? <div className="flux-one-command-ref-empty">No matches.</div> : null}
        </div>
      </FluxOneModal>
    </div>
  );
}

