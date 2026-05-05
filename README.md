# Flux One — Command Central (v1)

**Plugin Name (wp-admin):** Flux One - Command Central by Flux Plugins  
**Slug / folder / text-domain:** `flux-one`  
**Primary goal:** Provide a command-driven control layer in wp-admin (admin bar command palette + dashboard widget) to run common operational tasks quickly.

This README is intentionally “prompt-friendly”: it contains the current v1 spec decisions, architecture notes, and the local dev workflow so future prompts and contributors have a single source of truth.

---

## Product spec (v1 summary)

### Surfaces

- **Dashboard widget** on `/wp-admin/index.php`
  - Command bar
  - Recent commands / pinned actions (planned)
  - Lightweight indicators (planned)
- **Global command toggle**
  - Admin bar node: **Flux One** with hotkey hint (server renders **Ctrl** for the mod key first; admin-loader async-refines **Cmd** on Apple-like clients via User-Agent Client Hints + fallback, matching localized `uiPrefs.commandShortcut`).
  - Keyboard shortcut: **Ctrl+K** / **⌘K**
  - Opens an overlay and focuses the input

### Command model

All commands produce a typed response:

- **Action**: executes immediately and returns a short **human-readable** message for the UI
- **Panel**: opens/returns inline panel payload (may allow inline editing)
- **Navigation**: provides a target admin URL (used by non-UI clients and typed `nav` fallback; palette picks use preloaded URLs — see below)

### Command execution & errors (API vs UI)

- **`POST /flux-one/v1/command`** returns the normal REST success envelope (`success`, `message`, `data`). The **`data`** object is the command result (`type`: `action` | `panel` | `error`, plus handler fields).
- For **`type: action`** failures, handler payloads may include:
  - **`userMessage`** / **`message`**: plain language for operators (this is what Command Central shows).
  - **`error_code`**: stable machine id for logs, tests, or future integrations (e.g. `flux_one_plugin_no_update`). **Command Central does not display these keys**—only the human-readable line.
  - **`debug`**: optional structured detail; included only when **`WP_DEBUG`** is on (not shown in the default UI).
- Plugin upgrade failures are classified in **`PluginsHandler`** using `WP_Error`, `Automatic_Upgrader_Skin::get_upgrade_messages()`, pre-flight update transient checks, and `WP_Filesystem` readiness; unknown outcomes are logged via the suite logger when appropriate.

### Aggregate vs Summary (AI prefix)

Flux One treats `summary` as a **prefix** that requests an AI-enhanced summary for a supported aggregate. It is **not** a 1:1 alias for `aggregate`.

- **`aggregate {thing}`**: always works without AI (deterministic aggregation + grouping + counts).
- **`summary {thing}`**: requests AI summarization for that aggregate only (feature-gated by license).

Current implemented examples:

- `aggregate email` → opens unified email modal (non‑AI aggregate load). Response includes **cached** AI summaries for visible page events when rows exist in `flux_one_email_summaries`; **does not** call AI for missing summaries.
- `summary email` → opens same modal and **explicitly** requests AI summaries for the visible page (uses `POST /flux-one/v1/summary/email` with current page `event_ids`, max 25; gated by license). Same behavior as the modal **Summarize** button.

### Alias commands

Flux One supports “forgiving” command inputs by canonicalizing token order/synonyms. User lock/unlock use **`user lock` / `user unlock`** as the canonical form; aliases such as **`lock user`**, **`unlock user`**, and plural **`users lock` / `users unlock`** rewrite to that shape before routing.  
**Important:** history/memory should store the **canonical** command (not the alias) as the source of truth.

### Enter key (Command Central)

**Enter** uses layered intent: a small client ladder (`interpretEnter` + `commandLadder`) completes unique prefixes (e.g. `plugin li` → `plugin list`, `menu li` → `menu list`) and only **POSTs** when the command is runnable or uniquely disambiguated (single plugin/user/site match, terminal list commands, `nav` with a resolved URL, etc.). **Tab** still fills the highlighted suggestion without running. Suggestion **clicks** follow the same run vs. fill rules where possible. When a command **runs** (Enter or click), the input is filled with the **canonical** executed string (except `config …`, where raw casing is preserved for values). **Autocomplete** shows **top-level** commands only on an empty field; after a root and space (e.g. `user `), **Next steps** lists subcommands such as lock, unlock, add, and role set. **Aliases** (e.g. `role set …`) never appear as their own suggestion rows; typing them still canonicalizes, and the field shows the canonical command after run.

### Dashboard widget layout

For users who have **never** saved a dashboard layout, Flux One applies a **one-time** default that places **Flux One — Command Central** first in the **normal** column (via `meta-box-order_dashboard` and a guard meta). After that, only WordPress’s normal drag-and-drop / Screen Options behavior applies.

### Recent navigation memory

The dashboard widget shows up to **five** **recent admin pages** you have opened (tracked on each wp-admin screen load for users who can access Command Central), plus entries from **`nav`** via **`POST /command`** or client-side redirects. Each item includes a **`url`** (when known) and **`label`**; **`command`** is kept when the destination came from a `nav` command. **Labels** prefer real admin titles (`$GLOBALS['title']`, safe `get_admin_page_title()`, submenu titles for `admin.php?page=…`, then post type names or a short humanized screen id) instead of raw screen slugs when possible. Data lives in user meta (`recent_navigations` inside `_flux_one_command_memory`) and is returned on **`GET /flux-one/v1/bootstrap`** as **`commandMemory.recentNavigations`**. Client-side nav may also call **`POST /flux-one/v1/memory/recent-navigation`** with **`url`** and/or **`command`** before redirect.

### Flux Suite — License & Settings

Flux One registers the shared **Flux Suite → License** page. **Flux Suite → Flux One** opens the plugin admin React app (`plugin-app.bundle.js`): **Overview** and **Settings** (HashRouter + shared `PageLayout` / `FluxAppProvider` from `flux-plugins-common`, same pattern as Flux Media Optimizer). Email aggregation options (capture on/off, suppress mail to self, default report window) are **per-user** where implemented: **`GET` / `PUT /flux-one/v1/settings`** reads and writes user meta (with legacy site options migrated on read). **Recent admin pages** in the dashboard widget use plain `<a href>` links; destinations are de-duplicated by normalized admin URL (including dashboard aliases). Outbound mail is logged via the **`wp_mail`** filter (`EmailEventLogger`); users who enable suppress-to-self have their addresses **stripped from To/Cc/Bcc** on a later **`wp_mail`** pass (`EmailMailPolicy`) so logs still reflect intended recipients while they skip receiving copies.

---

## Architecture

### Bootstrap (suite-integrated)

This plugin follows the shared suite contract:

1. Load autoloaders:
   - `vendor/autoload.php`
   - `vendor-prefixed/autoload.php`
2. Initialize Flux suite common library:
   - `FluxPlugins::init( $slug, $version, $text_domain, $common_assets_url )`
3. Initialize plugin app orchestrator:
   - `( new FluxOne\\App\\Plugin() )->init()`

Main file: `flux-one.php`

### PHP layout

- `app/Plugin.php`
  - Registers admin hooks, REST routes, cron, auth lock filter, wp_mail capture.
- `app/Http/Controllers/*`
  - REST controllers
  - `BaseController` provides success/error envelopes
- `app/Services/*`
  - `CommandRouter` parses/normalizes commands and dispatches to handlers
  - Command handlers (e.g. `PluginsHandler`) return structured action payloads (`userMessage`, `error_code`, optional `debug`)
  - `IndexCacheService` provides cached indices for autocomplete (plugins/users/roles/menus/sites)
  - `Database` owns table creation/drop
  - `CleanupService` daily cleanup job for event retention
  - Email aggregation services:
    - `EmailEventLogger`
    - `EmailAggregationService`
    - `AiSummaryService` / `EmailSummaryService` (feature-gated; Flux API `/api/v1/fo/email-summaries`)
    - `EmailSummaryRepository` / `{prefix}flux_one_email_summaries` table

### Data layer

- **Events table:** `{wpdb->prefix}flux_one_events`
  - Created via `dbDelta()` in `app/Services/Database.php`
  - Retention: **indefinite** (retained until explicitly deleted)
- **User memory:** `_flux_one_command_memory` user meta
  - `recent_commands`, `recent_navigations` (max 5 admin URLs and/or `nav` commands with labels), `pinned_commands`, `frequent_entities`, `last_site_context`

### Cron

- (No default retention cleanup cron; events are retained until explicitly deleted.)

### Multisite

- v1 includes `sites`/`site switch` scaffolding.
- Site context is persisted per-user in memory (`last_site_context`). Applying `switch_to_blog()` per request is a follow-up enhancement.

### Security model

- REST endpoints are protected by WP REST auth + nonce, with capability checks.
- Plugin operations further restrict capabilities (e.g. `update_plugins`, `activate_plugins`, `delete_plugins`, `edit_users`, `edit_theme_options`).

### Command Central client bundle (React)

- Command Central admin UI source lives under **`assets/js/src/admin/`** (shell, styles, tokens), **`assets/js/src/ui/`** (components, modals, skeleton primitives), and **`assets/js/src/command/`** (palette / routing); production bundle output is **`assets/js/dist/admin.bundle.js`**.
- **Loading UX split:** use **skeleton loaders** for larger or multi-region content areas (lists, panels, substantial modal bodies); use the centralized **Running…** spinner notice for global busy state and short-lived operations. Details and implementation paths are under **Admin UI → Loading states (skeleton vs. spinner)** below.

---

## REST API (v1)

Namespace: `flux-one/v1`

- **Bootstrap**
  - `GET /bootstrap` → feature flags + slim bootstrap (indices are loaded via `/index/*` below); includes **`commandMemory.recentNavigations`**
- **Command execution**
  - `POST /command` body: `{ input: string }`
- **Index** (cached JSON for Command Central autocomplete; optional `q` where noted)
  - `GET /index/plugins?q=`
  - `GET /index/users?q=`
  - `GET /index/menus`
  - `GET /index/sites?q=`
  - `GET /index/destinations?q=` → rows `{ id, label, value, url }` where **`url`** is an absolute same-origin `admin_url()` for trusted in-app navigation only
- **Menus**
  - `GET /menus`
  - `GET /menus/{id}`
  - `POST /menus/{id}` body: `{ items: [{ id, parentId, order }] }`
- **Email aggregation**
  - `GET /aggregate/email?days=7` (non‑AI report; includes `summaries.by_event_id` + `summaries.urgent_event_ids` for **visible page** events only—DB cache read, no AI). The `events` page is always ordered **summarized matches first** (non-empty cached summary), then other rows, each bucket **newest first** (`created_at DESC`), with or without search **`q`**.
  - `POST /summary/email` body `{ event_ids: number[] }` (1..25); AI summary + cache in `flux_one_email_summaries`; gated by license
- **Settings**
  - `GET /settings` → `{ emailCaptureEnabled, suppressMailToSelf, aggregateDefaultDays }`
  - `PUT /settings` → partial update of the same keys (days clamped 1–30)
- **Memory**
  - `POST /memory/recent-navigation` body: `{ url?: string, command?: string, label?: string }` (requires **`url`** and/or **`command`**; **`url`** must be same-origin wp-admin)

### Plugin updates via REST

Commands such as **`plugin update`** and **`plugin update all`** run WordPress’s `Plugin_Upgrader` from a REST request. There is **no** interactive FTP/SSH credentials form in the API response—the filesystem must be available **non-interactively** (typical on local environments using the `direct` transport). If Command Central reports that the filesystem could not be accessed, configure `FS_METHOD` and any required credential constants in `wp-config.php`, or adjust server permissions so PHP can write under `wp-content/plugins`.

---

## Admin UI (React + TypeScript, no MUI)

### Key constraint: one React runtime in the bundle

Command Central is built as a **standalone admin bundle** using **`react` / `react-dom`** from npm (not `wp.element`). Mixing that bundle with **`@wordpress/components`** (which resolves hooks through WordPress’s React) causes **“Invalid hook call”** errors.

Current approach:

- UI primitives are plain HTML + class-based CSS in `assets/js/src/admin/style.css` (no WordPress component library in the Command Central tree).
- **Theming contract:** design tokens live in `assets/js/src/admin/theme-tokens.css` as `--flux-one-*` CSS custom properties on `.flux-one-theme`. Command Central mount and portaled modal backdrops both use `flux-one-theme` so tokens inherit inside `FluxOneModal` (portaled to `body`). Future themes override variables via an extra class or data attribute on those same roots—avoid duplicating component selectors per theme.
- Data fetching uses **`@tanstack/react-query`** (`QueryClientProvider` in `assets/js/src/admin/index.tsx`).
- HTTP uses **`@wordpress/api-fetch`** (nonce + REST paths only).

### Loading states (skeleton vs. spinner)

- **Skeleton loaders** — Prefer for **larger content areas** or anywhere the layout should stay stable while data loads: multi-pane modals, master–detail lists, tall panels, or other regions where a single line of text would feel wrong or jump the chrome. Implement with **`Skeleton`** / **`SkeletonText`** from **`assets/js/src/ui/skeleton/`**, shimmer styles in **`assets/js/src/admin/style.css`**, and **`--flux-one-color-skeleton-*`** tokens in **`assets/js/src/admin/theme-tokens.css`**. Honor **`prefers-reduced-motion`** (animation falls back to static blocks).
- **Spinner + Running… notice** — Keep for **global Command Central busy** (`flux-one-notice--running` + `flux-one-spinner`): `POST /command`, client-side `nav` redirect, edit index search, and similar **transient** operations. Do not rely on that pattern alone to fill large empty panes; pair or replace with skeletons when the visible surface is big.

### UX must-haves (Command Central)

- **Next step focus**: when an overlay or modal opens, it must focus the next-step control (usually the primary input) and select text where appropriate. No extra click required.
- **Standard modal close**: modals should have an X close affordance, close on outside click, and close on Escape; focus should return to the trigger/input that opened the modal.
- **Running/busy operations**: show a single, consistent spinner notice whenever Command Central is “busy” so operators always get feedback and the input can be safely disabled.
  - **Server commands**: `POST /command` uses React Query `useMutation` and drives the busy state via `commandMutation.isPending`; the label comes from the canonical executed command.
  - **Client-side navigation** (`nav` destinations + `edit` picks): set a client-nav busy flag and label **before** calling `window.location.assign(...)`, and schedule the redirect on the next frame so the spinner can paint.
  - **Edit search**: while the `edit` XHR index query is fetching (and the debounced query is non-empty), show a lightweight “Searching…” spinner notice.
  - **Pattern**: keep this centralized (one `isBusy` flag + one `runningLabel` string) so new commands don’t re-implement loading UX ad hoc.

### Mount points

Inserted by PHP:

- Overlay root: `#flux-one-command-central-root`
- Dashboard widget root: `#flux-one-dashboard-widget-root`
- **Flux Suite → Flux One** (Overview / Settings React app): `AdminController::render_settings_page()` outputs `<div class="wrap">` → **`<span class="wp-header-end"></span>`** → `#flux-one-plugin-app`. The `wp-header-end` marker is required so WordPress places admin notices (including Flux Suite license warnings) **above** the app shell; without it, notices can render inside the React `PageLayout` card.


Entry:

- `assets/js/src/admin/index.tsx`

Current UI implementation (v1 shell):

- Command input with ghost autocomplete and stepwise suggestions (`assets/js/src/command/*`, Fuse.js for entity match)
- **Hierarchical autocomplete**: an empty field lists **true root** commands only (`plugin`, `user`, `menu`, …). After **`user `** (trailing space or typing the root), **Next steps** includes `user list`, `user lock`, `user unlock`, `user add`, `user role set`, etc. Deeper paths (e.g. `plugin update {name}`) stay entity-driven as before.

### Multi-step command UX pattern (iterative field prompts)

Flux One supports **iterative, field-by-field command completion** for open-ended commands. The canonical example is:

- `user add {login} {email} {role}`

As the operator types, Command Central should adapt suggestions and helper copy in real time so the next expected field is obvious (e.g. “then email and role”, then “then role”). This avoids dumping full syntax up front and gives a guided, low-friction flow.

#### Example: `user add` progressive UX

1. User types: `user add`
   - Next-step helper: “Enter username, then email and role.”
   - Suggestions: none yet (free-text username expected).

2. User types: `user add jane`
   - Next-step helper: “Great — now add email, then role.”
   - Suggestions: none yet (free-text email expected).

3. User types: `user add jane jane@site.com`
   - Next-step helper: “Now choose a role.”
   - Suggestions: role entities from user/role index (autocomplete list).

4. User types: `user add jane jane@site.com editor`
   - Command becomes runnable; Enter executes.

This same interaction pattern should be reused for any multi-input command where fields are open-ended or mixed (free text + entity picks).

#### Systemizing this as a command type in registry

Define a dedicated **multi-step command type** in the command registry layer (parallel to existing registry patterns), with explicit step metadata. Each step declares:

- `field`: semantic field id (e.g. `login`, `email`, `role`)
- `kind`: input type (`text`, `email`, `entity`, `enum`)
- `prompt`: helper message shown while this step is active
- `source` (optional): entity source mapping for autocomplete (`users`, `roles`, `plugins`, `sites`, etc.)
- `validate` (optional): lightweight client validation hint/gate for enabling run state

Suggested shape (documentation-level example):

```ts
{
  id: 'cmd.user.add',
  canonical: 'user add',
  type: 'multistep',
  steps: [
    { field: 'login', kind: 'text',  prompt: 'Enter username, then email and role.' },
    { field: 'email', kind: 'email', prompt: 'Now add email, then role.' },
    { field: 'role',  kind: 'entity', source: 'roles', prompt: 'Choose a role.' }
  ]
}
```

Implementation intent:

- Keep this in the **command registry** so step behavior is declarative.
- Keep entity-source mappings **field-specific** (not command-global).
- Keep router canonicalization unchanged (`CommandRouter` remains source of truth for execution forms).
- Keep docs synchronized across README + `commandDocs.ts` + registry definitions.

- **Client-side `nav`**: destination rows from `GET /index/destinations` include **`url`**. Choosing a destination suggestion uses **`window.location.assign(url)`** and **does not** call `POST /command`. Typed `nav …` with an **unambiguous** match against the cached index also redirects client-side; otherwise execution falls back to `POST /command` (same as `NavigationHandler`).
- **Read-only list fast path**: `plugin list` / `user list` / `site list` / `menu list` (and `show` variants) can render the structured panel from **React Query cache** when the corresponding index is already loaded, skipping `POST /command`. **`aggregate email` and `summary email` always use the backend** (no client shortcut for aggregates or AI).
- **`useMutation`** for commands that still need the server: disabled input + “Running…” notice while `POST /command` is in flight
- Success / error notices show **human-readable text only** (no `error_code` in the palette)
- Indices loaded from decoupled **`GET /flux-one/v1/index/*`** endpoints; after successful **`plugin update` / `activate` / `deactivate` / `delete`**, the plugins index query is **invalidated** so autocomplete stays fresh
- **Commands reference** modal (info icon) with filter (`commandDocs.ts`); keep in sync when changing commands (see maintenance rule below)
- **Email aggregate** modal (`EmailAggregateView` + `FluxOneModal`): unified view for `aggregate email` and `summary email`. Master-detail layout: list pane + detail (`aggregate email` modal stacks to a single column below ~782px viewport width). Two sections (**Summarized** first, then **Not summarized**); the API returns events in that order for each page (newest first within summarized, then newest first within not summarized). Summarized rows show AI summary plus optional suggested action and timestamp (subject stays in the detail pane only). Detail pane shows subject, timestamp, recipient, body, and actions. Cached summaries load with `GET /aggregate/email`; AI runs only via `summary email` or **Summarize**. Initial open and **Days** / **search** changes show **shimmer skeletons** in the list + detail panes (reusable primitives in `assets/js/src/ui/skeleton/`); **page** changes keep prior rows visible (`placeholderData: keepPreviousData`). **Summarize** sits in a **sticky list-pane header** above the list; while AI runs it uses the same **Running…**-style notice as Command Central (`flux-one-notice--running` + `flux-one-spinner`). Toolbar **search** width is capped (`flex: 0 1 320px`, `max-width: 360px`) so it does not span the full toolbar.

### Documentation maintenance (commands)

When you add or change commands in **PHP** (`CommandRouter`, handlers) or **JS** (`registry.ts`, `suggest.ts`), update **all** of:

1. **`assets/js/src/command/commandDocs.ts`** (in-app reference copy and `backend` hints)
2. **`README.md`** (this file — command coverage and behavior notes)
3. **User-facing strings** / registry labels as needed

Treat **README + commandDocs + registry** as the operator-facing documentation triangle.

### Bugfix + cleanup priorities (P0/P1/P2)

Use this as a running “intent alignment” checklist when changing Command Central.

- **P0**
  - **Client-nav UX consistency**: any suggestion that redirects (`clientAction: 'nav'`) must set centralized busy state + label before `window.location.assign` (spinner paints on next frame).
  - **Nav destination correctness**: destination indexer must avoid unloadable `admin.php?page=slug` targets and preserve SPA/query-style slugs for modern admin apps (WooCommerce, etc.).
- **P1**
  - **Docs drift prevention**: keep `registry.ts` and `commandDocs.ts` in sync. Run `npm run validate:docs` (part of `npm run build`).
  - **Modal focus/close regressions**: ensure all modal open flows provide predictable initial focus and all close paths restore focus to opener.
- **P2**
  - **Entity adapter reuse**: add new entity suggestion flows by extending adapters (`entityAdapters.ts`) rather than ad-hoc inline ranking rules in `suggest.ts`.
  - **Intent reuse**: use `getIntent()` (`assets/js/src/command/intent.ts`) for query gating and other UI intent decisions (single source of truth).

---

## Development setup

### PHP dependencies

From `wp-content/plugins/flux-one/`:

```bash
composer install
```

This also runs Strauss prefixing and copies common assets:

- Common assets copied to `src/assets/common/`
- Prefixed dependencies to `vendor-prefixed/`

### JS dependencies

From `wp-content/plugins/flux-one/`:

```bash
npm install
```

### JS dev server

```bash
npm run start
```

- Dev server port: **3004**
- In WP, dev URL is used when `WP_DEBUG` and `SCRIPT_DEBUG` are enabled:
  - `http://localhost:3004/admin.bundle.js`

### Production build

```bash
npm run build
```

Outputs to:

- `assets/js/dist/admin.bundle.js`
- `assets/js/dist/plugin-app.bundle.js` (Flux Suite → Flux One submenu: Overview + Settings)

### Repo note: `wporg/` is artifact-only

This repository may include a `wporg/` folder used as a distribution/build artifact snapshot. Treat `wporg/` as **read-only** and do not make functional changes there—make changes in the primary plugin source tree (this directory) and rebuild.

---

## Current command coverage (v1)

- Plugins:
  - `plugin list` / `plugin show` (optional **client fast path** from cached plugins index)
  - `plugins` → `plugin` (alias)
  - `plugin update {query}` (alias: `plugins update {query}`)
  - `plugin update all`
  - `plugin activate {query}`
  - `plugin deactivate {query}`
  - `plugin delete {query}`
  - `plugin install`
- Users:
  - `user list` / `user show` (optional **client fast path** from cached users index)
  - **`user lock {email}`** / **`user unlock {email}`** (canonical)
  - Aliases: `lock user …`, `unlock user …`, `users lock|unlock …` → same routing
  - **`user role set {email} {role}`** (alias typed as **`role set …`** canonicalizes to this form)
- Menus:
  - `menu list` / `menu show` (optional **client fast path** from cached menus index; requires **`edit_theme_options`** on the server when not using the fast path)
- Edit:
  - `edit p {query}` — search posts + pages by title/slug (XHR), labeled results, opens wp-admin editor
  - `edit post {query}` — posts only
  - `edit page {query}` — pages only
- Navigation:
  - `nav {destination}` (aliases `go`, `open` → `nav`; **client redirect** when URL is known from destinations index)
- Multisite:
  - `site list` / `site show` (optional **client fast path** from cached sites index)
  - `sites` → `site`
  - `site switch {query}`
- Aggregation:
  - `aggregate email` — **always** `POST /command` + follow-up `GET /aggregate/email` (no client-only shortcut); shows cached summaries when present
  - `summary email` (AI prefix; gated; opens same modal and runs AI for visible page, max 25 events)

---

## Uninstall / cleanup

- `uninstall.php` drops the events table and removes:
  - `flux_one_db_version`
  - `_flux_one_command_memory` user meta (all users)

---

## Contributor notes / next build targets

- Replace remaining JSON panel renderers with real wp-admin-native UIs:
  - Plugins table (with bulk actions and update status)
  - Menu editor (DnD + save)
  - Async AI summary section for email
- Expand `UserCommandMemory` usage for recent commands / pins.
- Expand navigation coverage and non-React clients consuming `POST /command` navigation payloads.

