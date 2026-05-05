import { formatAdminBarHotkeyText, parseShortcut } from './commandShortcut';
import { resolveAdminBarModifierWord } from './keyboardPlatform';

function getAdminBundleUrl(): string {
  const cfg: any = (window as any).fluxOneAdmin || {};
  if (typeof cfg.adminBundleUrl === 'string' && cfg.adminBundleUrl) {
    return String(cfg.adminBundleUrl);
  }
  const pluginUrl = typeof cfg.pluginUrl === 'string' ? String(cfg.pluginUrl) : '';
  if (pluginUrl) {
    const base = pluginUrl.replace(/\/?$/, '/');
    return `${base}assets/js/dist/admin.bundle.js`;
  }
  // Fallback path (should not happen in WP, but keeps dev HTML workable).
  return '/wp-content/plugins/flux-one/assets/js/dist/admin.bundle.js';
}

function shouldToggleForKeydown(e: KeyboardEvent, rawShortcut: string): boolean {
  const { hasMod, hasShift, hasAlt, key } = parseShortcut(rawShortcut);
  const wantsMod = hasMod ? (e.ctrlKey || e.metaKey) : true;
  const wantsShift = hasShift ? e.shiftKey : !e.shiftKey;
  const wantsAlt = hasAlt ? e.altKey : !e.altKey;
  const wantsKey = key ? e.key.toLowerCase() === key.toLowerCase() : e.key === '.';
  return wantsMod && wantsShift && wantsAlt && wantsKey;
}

let mainBundlePromise: Promise<void> | null = null;

function loadMainBundle(): Promise<void> {
  if (mainBundlePromise) return mainBundlePromise;

  mainBundlePromise = new Promise<void>((resolve, reject) => {
    const url = getAdminBundleUrl();
    // If already present, assume loaded.
    const existing = document.querySelector(`script[data-flux-one-admin-bundle="1"]`) as HTMLScriptElement | null;
    if (existing) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.dataset.fluxOneAdminBundle = '1';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load Flux One admin bundle: ${url}`));
    document.head.appendChild(s);
  });

  return mainBundlePromise;
}

function prefetchMainBundle() {
  const url = getAdminBundleUrl();
  const existing = document.querySelector(`link[rel="prefetch"][href="${url}"]`);
  if (existing) return;
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.as = 'script';
  link.href = url;
  document.head.appendChild(link);
}

function requestIdle(cb: () => void) {
  const w: any = window as any;
  if (typeof w.requestIdleCallback === 'function') {
    w.requestIdleCallback(cb, { timeout: 1500 });
    return;
  }
  setTimeout(cb, 250);
}

function scheduleAdminBarHotkeyEnhancement(shortcutRaw: string) {
  const run = () => {
    void (async () => {
      try {
        const modifier = await resolveAdminBarModifierWord();
        const inner = formatAdminBarHotkeyText(shortcutRaw, modifier);
        const paren = `(${inner})`;
        const anchor = document.querySelector(
          '#wp-admin-bar-flux-one-command a.ab-item'
        ) as HTMLAnchorElement | null;
        const innerEl = anchor?.querySelector('.flux-one-admin-bar-hotkey-inner');
        if (innerEl) {
          innerEl.textContent = paren;
        }
        if (anchor) {
          anchor.setAttribute('title', `Open Flux One ${paren}`);
        }
      } catch {
        /* ignore */
      }
    })();
  };
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(run);
    return;
  }
  setTimeout(run, 0);
}

async function openOverlay() {
  // First open: allow the UI to see an “open requested” flag on mount.
  (window as any).__fluxOneOpenOnLoad = true;
  await loadMainBundle();
  // Subsequent opens: nudge already-mounted UI.
  try {
    window.dispatchEvent(new Event('flux-one-open'));
  } catch {
    /* older browsers */
  }
}

function init() {
  const cfg: any = (window as any).fluxOneAdmin || {};
  const shortcutRaw =
    cfg?.bootstrap && typeof cfg.bootstrap === 'object' && (cfg.bootstrap as any).uiPrefs?.commandShortcut
      ? String((cfg.bootstrap as any).uiPrefs.commandShortcut)
      : 'mod+.';
  const effectiveShortcut = shortcutRaw && shortcutRaw.includes('mod+') ? shortcutRaw : 'mod+.';

  // Dashboard: widget needs UI immediately.
  const hasDashboardWidget = !!document.getElementById('flux-one-dashboard-widget-root');
  if (hasDashboardWidget) {
    void loadMainBundle().catch(() => {});
  } else {
    requestIdle(() => prefetchMainBundle());
  }

  window.addEventListener(
    'keydown',
    (e) => {
      if (!shouldToggleForKeydown(e, effectiveShortcut)) return;
      e.preventDefault();
      void openOverlay();
    },
    { capture: true }
  );

  const node = document.getElementById('wp-admin-bar-flux-one-command');
  const anchor = node?.querySelector('a');
  anchor?.addEventListener('click', (e) => {
    e.preventDefault();
    void openOverlay();
  });

  scheduleAdminBarHotkeyEnhancement(effectiveShortcut);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  init();
}

