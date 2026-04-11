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

- **Action**: executes immediately and returns a short message
- **Panel**: opens/returns inline panel payload (may allow inline editing)
- **Navigation**: provides a target admin URL (future)

### Aggregate vs Summary (AI prefix)

Flux One treats `summary` as a **prefix** that requests an AI-enhanced summary for a supported aggregate. It is **not** a 1:1 alias for `aggregate`.

- **`aggregate {thing}`**: always works without AI (deterministic aggregation + grouping + counts).
- **`summary {thing}`**: requests AI summarization for that aggregate only (feature-gated by license).

Current implemented examples:

- `aggregate email` → shows the email aggregation report (non‑AI)
- `summary email` → requests AI summary for the email aggregate (currently stubbed; gated)

### Alias commands

Flux One supports “forgiving” command inputs by canonicalizing token order/synonyms (e.g. `user lock` → `lock user`).  
**Important:** history/memory should store the **canonical** command (not the alias) as the source of truth.

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
- **User memory (planned usage expansion):** `_flux_one_command_memory` user meta
  - `recent_commands`, `pinned_commands`, `frequent_entities`, `last_site_context`

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
  - `GET /bootstrap` → indices for fast autocomplete
- **Command execution**
  - `POST /command` body: `{ input: string }`
- **Index**
  - `GET /index/users?q=` → user search (from cached index)
- **Menus**
  - `GET /menus`
  - `GET /menus/{id}`
  - `POST /menus/{id}` body: `{ items: [{ id, parentId, order }] }`
- **Email aggregation**
  - `GET /aggregate/email?days=7` (non‑AI report)
  - `POST /summary/email` (AI summary request; gated; currently stubbed)

---

## Admin UI (React + TypeScript, no MUI)

### Key constraint: single React instance (wp-admin)

wp-admin ships React via `wp.element`. `@wordpress/components` uses that React instance.

To avoid the “Invalid hook call” error, Flux One **must not bundle its own React** when using WordPress components. The admin bundle uses:

- `createRoot` from `@wordpress/element`
- Hooks (`useState`, `useEffect`, etc.) from `@wordpress/element`

Webpack also aliases `react` / `react-dom` to `@wordpress/element` as a safety net.

### Mount points

Inserted by PHP:

- Overlay root: `#flux-one-command-central-root`
- Dashboard widget root: `#flux-one-dashboard-widget-root`

Entry:

- `assets/js/src/admin/index.tsx`

Current UI implementation is a minimal v1 shell:

- Command input
- Suggestion list (keyboard navigation + Tab autocomplete)
- Inline JSON renderer for panels (placeholder until panel UIs are built)

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

---

## Current command coverage (v1)

- Plugins:
  - `plugins`
  - `plugin update all`
  - `plugin activate {query}`
  - `plugin deactivate {query}`
  - `plugin delete {query}`
- Users:
  - `lock user {email}`
  - `unlock user {email}`
  - `role set {email} {role}`
  - Aliases like `user lock {email}` are canonicalized
- Multisite:
  - `sites`
  - `site switch {query}`
- Aggregation:
  - `aggregate email`
  - `summary email` (AI prefix; gated; stubbed)

---

## Uninstall / cleanup

- `uninstall.php` drops the events table and removes:
  - `flux_one_db_version`
  - `_flux_one_command_memory` user meta (all users)

---

## Contributor notes / next build targets

- Replace JSON panel renderers with real wp-admin-native UIs:
  - Plugins table (with bulk actions and update status)
  - Menu editor (DnD + save)
  - Email aggregation report view + async AI summary section
- Implement canonical command persistence in `UserCommandMemory` for recent/pins.
- Add “navigation” response type and route shortcuts.

