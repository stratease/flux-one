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
  - Admin bar node: **Command**
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

- `aggregate email` → shows the email aggregation report (non‑AI)
- `summary email` → requests AI summary for the email aggregate (currently stubbed; gated)

### Alias commands

Flux One supports “forgiving” command inputs by canonicalizing token order/synonyms. User lock/unlock use **`user lock` / `user unlock`** as the canonical form; aliases such as **`lock user`**, **`unlock user`**, and plural **`users lock` / `users unlock`** rewrite to that shape before routing.  
**Important:** history/memory should store the **canonical** command (not the alias) as the source of truth.

### Enter key (Command Central)

**Enter** uses layered intent: a small client ladder (`interpretEnter` + `commandLadder`) completes unique prefixes (e.g. `plugin li` → `plugin list`) and only **POSTs** when the command is runnable or uniquely disambiguated (single plugin/user/site match, terminal list commands, `nav` with a resolved URL, etc.). **Tab** still fills the highlighted suggestion without running. Suggestion **clicks** follow the same run vs. fill rules where possible.

### Dashboard widget layout

For users who have **never** saved a dashboard layout, Flux One applies a **one-time** default that places **Flux One — Command Central** first in the **normal** column (via `meta-box-order_dashboard` and a guard meta). After that, only WordPress’s normal drag-and-drop / Screen Options behavior applies.

### Recent navigation memory

The dashboard widget shows up to **five** **recent admin pages** you have opened (tracked on each wp-admin screen load for users who can access Command Central), plus entries from **`nav`** via **`POST /command`** or client-side redirects. Each item includes a **`url`** (when known) and **`label`**; **`command`** is kept when the destination came from a `nav` command. Data lives in user meta (`recent_navigations` inside `_flux_one_command_memory`) and is returned on **`GET /flux-one/v1/bootstrap`** as **`commandMemory.recentNavigations`**. Client-side nav may also call **`POST /flux-one/v1/memory/recent-navigation`** with **`url`** and/or **`command`** before redirect.

### Flux Suite — License & Settings

Flux One registers the shared **Flux Suite → License** page. **Flux Suite → Flux One** opens the plugin admin React app (`plugin-app.bundle.js`): **Overview** and **Settings** (HashRouter + shared `PageLayout` / `FluxAppProvider` from `flux-plugins-common`, same pattern as Flux Media Optimizer). Email aggregation options (capture on/off, suppress mail to self, default report window) live on the **Settings** tab and via **`GET` / `PUT /flux-one/v1/settings`**. **Recent admin pages** in the dashboard widget use plain `<a href>` links; destinations are de-duplicated by normalized admin URL (including dashboard aliases). Suppress-to-self runs on **`pre_wp_mail`** **after** logging on **`wp_mail`**, so aggregates stay complete.

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
    - `AiSummaryService` (feature-gated; currently stubbed)

### Data layer

- **Events table:** `{wpdb->prefix}flux_one_events`
  - Created via `dbDelta()` in `app/Services/Database.php`
  - Retention: **7 days** (deleted by daily cron)
- **User memory:** `_flux_one_command_memory` user meta
  - `recent_commands`, `recent_navigations` (max 5 admin URLs and/or `nav` commands with labels), `pinned_commands`, `frequent_entities`, `last_site_context`

### Cron

- Hook: `flux_one_daily_cleanup`
- Schedules on activation; clears on deactivation.

### Multisite

- v1 includes `sites`/`site switch` scaffolding.
- Site context is persisted per-user in memory (`last_site_context`). Applying `switch_to_blog()` per request is a follow-up enhancement.

### Security model

- REST endpoints are protected by WP REST auth + nonce, with capability checks.
- Plugin operations further restrict capabilities (e.g. `update_plugins`, `activate_plugins`, `delete_plugins`, `edit_users`, `edit_theme_options`).

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
  - `GET /aggregate/email?days=7` (non‑AI report)
  - `POST /summary/email` (AI summary request; gated; currently stubbed)
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

- UI primitives are plain HTML + inline/CSS-module-friendly styles in `assets/js/src/admin/style.css` (no WordPress component library in the Command Central tree).
- Data fetching uses **`@tanstack/react-query`** (`QueryClientProvider` in `assets/js/src/admin/index.tsx`).
- HTTP uses **`@wordpress/api-fetch`** (nonce + REST paths only).

### Mount points

Inserted by PHP:

- Overlay root: `#flux-one-command-central-root`
- Dashboard widget root: `#flux-one-dashboard-widget-root`

Entry:

- `assets/js/src/admin/index.tsx`

Current UI implementation (v1 shell):

- Command input with ghost autocomplete and stepwise suggestions (`assets/js/src/command/*`, Fuse.js for entity match)
- **Hierarchical autocomplete**: root commands (“Commands”) and, when a root is chosen (trailing space or exact single-token root like `plugin`), **Next steps** lists subcommands or nav destinations. Deeper paths (e.g. `plugin update {name}`) stay entity-driven as before.
- **Client-side `nav`**: destination rows from `GET /index/destinations` include **`url`**. Choosing a destination suggestion uses **`window.location.assign(url)`** and **does not** call `POST /command`. Typed `nav …` with an **unambiguous** match against the cached index also redirects client-side; otherwise execution falls back to `POST /command` (same as `NavigationHandler`).
- **Read-only list fast path**: `plugin list` / `user list` / `site list` / `menu list` (and `show` variants) can render the structured panel from **React Query cache** when the corresponding index is already loaded, skipping `POST /command`. **`aggregate email` and `summary email` always use the backend** (no client shortcut for aggregates or AI).
- **`useMutation`** for commands that still need the server: disabled input + “Running…” notice while `POST /command` is in flight
- Success / error notices show **human-readable text only** (no `error_code` in the palette)
- Indices loaded from decoupled **`GET /flux-one/v1/index/*`** endpoints; after successful **`plugin update` / `activate` / `deactivate` / `delete`**, the plugins index query is **invalidated** so autocomplete stays fresh
- **Commands reference** modal (info icon) with filter (`commandDocs.ts`); keep in sync when changing commands (see maintenance rule below)
- **Email aggregate** panel uses a readable table view (`EmailAggregateView`) instead of raw JSON

### Documentation maintenance (commands)

When you add or change commands in **PHP** (`CommandRouter`, handlers) or **JS** (`registry.ts`, `suggest.ts`), update **all** of:

1. **`assets/js/src/command/commandDocs.ts`** (in-app reference copy and `backend` hints)
2. **`README.md`** (this file — command coverage and behavior notes)
3. **User-facing strings** / registry labels as needed

Treat **README + commandDocs + registry** as the operator-facing documentation triangle.

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
  - `role set {email} {role}`
- Menus:
  - `menu list` (optional **client fast path** from cached menus index)
- Navigation:
  - `nav {destination}` (aliases `go`, `open` → `nav`; **client redirect** when URL is known from destinations index)
- Multisite:
  - `site list` / `site show` (optional **client fast path** from cached sites index)
  - `sites` → `site`
  - `site switch {query}`
- Aggregation:
  - `aggregate email` — **always** `POST /command` + follow-up data loads (no client-only shortcut)
  - `summary email` (AI prefix; gated; stubbed)

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

