# Plugin Audit Findings: flux-one
Date: 2026-05-06
Auditor: Cursor Agent

## Severity Key
- 🔴 BLOCKER — Will cause rejection or removal from WordPress.org
- 🟠 HIGH — Likely to be flagged in review
- 🟡 MEDIUM — Should fix before submission
- 🔵 INFO — Best practice / minor improvement

---

## Summary
| Severity | Count |
|----------|-------|
| 🔴 BLOCKER | 0 |
| 🟠 HIGH | 4 |
| 🟡 MEDIUM | 10 |
| 🔵 INFO | 8 |

**Verdict:** NEEDS WORK BEFORE SUBMISSION

## Phase 1 — File Architecture & Plugin Header

- **Setup**
  - **AUDIT_ROOT**: `wp-content/plugins/flux-one/`
  - **PLUGIN_SLUG**: `flux-one`
  - **PREFIX (observed)**: `FLUX_ONE_*` (constants) / `FluxOne\` (namespaces)
  - **OPTION_PREFIX (observed in plugin-owned code)**: `flux_one_` (see `uninstall.php`), plus cross-plugin suite keys in `SuiteConfigCatalog` (see Phase 3 note).
  - **TEXT_DOMAIN**: `flux-one`
  - **MAIN_FILE**: `wp-content/plugins/flux-one/flux-one.php`
  - **Build exclusions source of truth (submission inference only)**: `flux-plugins-common/bin/build-plugin.sh` (rsync `--exclude` list).

- ✅ **Main file/header present**: `flux-one.php` contains required header fields including `License: GPL-2.0-or-later` and `Text Domain: flux-one`.
- ✅ **`readme.txt` present**: `wp-content/plugins/flux-one/readme.txt` exists.
- ✅ **Uninstall handler present**: `wp-content/plugins/flux-one/uninstall.php` exists.
- 🟡 **Repo contains build-excluded artifacts (should not ship)**: `.git/`, `node_modules/`, `tests/`, `wporg/`, `bin/`, `package*.json`, `webpack.config.js`, `phpunit.xml.dist`, and multiple `flux-one-v*.zip` files exist under `AUDIT_ROOT`. `flux-plugins-common/bin/build-plugin.sh` excludes these from the zip; ensure submission artifact is produced with that exclusion set.
- ✅ **Credential assignment pattern scan (first-party PHP)**: no matches for `(api_key|secret_key|password|private_key)\s*=\s*['"][^'"]{8,}`.
- ✅ **`base64_decode()` scan (all PHP)**: not found.
- ✅ **`eval()` scan (all PHP)**: not found.
- 🔵 **Disallowed extension scan**: matches present under `node_modules/`, `vendor/`, and `vendor-prefixed/` (excluded from submission by build script); no first-party `.exe/.bat/.sh/.zip/.log/.DS_Store` found in plugin-owned code paths during this pass.

## Phase 2 — Licensing & Bundled Code

- ✅ **License declared**: `flux-one.php` declares `GPL-2.0-or-later`; `readme.txt` declares `GPLv2 or later`.
- ✅ **Bundled libraries disclosed in `readme.txt`**: `readme.txt` includes a “Third-party libraries” section listing Action Scheduler, Monolog, PSR-3, and Flux Plugins Common (Strauss-prefixed), including license notes.
- ✅ **External services disclosed**: `readme.txt` discloses license/compatibility calls to Flux Plugins API and links privacy policy (`https://fluxplugins.com/privacy`).
- 🔵 **No root `LICENSE` file**: not required when license is clearly declared in `flux-one.php` + `readme.txt`, but some reviewers prefer a license file; verify submission expectations.

## Phase 3 — Naming Conventions & Namespace Hygiene

- ✅ **Namespaces used throughout plugin-owned PHP**: `app/` files declare `namespace FluxOne\App\...`.
- ✅ **Prefixed constants used in main file**: `flux-one.php` defines `FLUX_ONE_*` constants.
- 🟡 **Options API keys**:
  - ✅ `flux_one_db_version` (prefixed) used in `uninstall.php`.
  - ✅ Core option `active_plugins` used in `AdminDestinations` / `IndexCacheService` (acceptable).
  - 🔵 `SuiteConfigCatalog` reads/writes cross-plugin suite keys (examples: `flux_ai_alt_creator_pro_auto_processing`). This may be acceptable given it is explicitly cross-plugin integration, but Plugin Check can flag unprefixed/generic option names; verify these keys are intended to be owned by other Flux plugins and that each owning plugin uses its own prefix consistently.
- ✅ **No plugin-owned global functions found**: no matches for `^function` under `app/` (class-based code).
- 🔵 **`define()` outside main file**: `tests/bootstrap.php` defines `DAY_IN_SECONDS` (tests are excluded from submission by build script).

## Phase 4 — Data Handling: Sanitization, Escaping, Nonces

- 🟡 **Superglobal usage found (sanitized)**: `app/Services/AdminVisitRecorder.php` uses `$_GET['page']`, sanitizes with `sanitize_text_field( wp_unslash( ... ) )`, and escapes URLs with `esc_url_raw()`.
- ✅ **No direct `echo $var` patterns detected in `app/`**: no matches for `^\s*(echo|print)\s+\$` (heuristic).
- 🔵 **Nonces**: no matches in plugin-owned PHP for `wp_nonce_field`, `wp_verify_nonce`, `check_admin_referer`, or `check_ajax_referer`. REST controllers use `current_user_can( 'manage_options' )` as default permission check (`app/Http/Controllers/BaseController.php`). Verify front-end/admin requests are made via WP REST APIs (cookie auth + REST nonce) and that any non-REST state changes enforce a nonce.

## Phase 5 — SQL Practices

- ✅ **Prepared queries used for reads**: multiple `$wpdb->get_results()` / `$wpdb->get_var()` calls wrap SQL in `$wpdb->prepare()` (examples in `EmailAggregationService`, `EmailSummaryService`, `IndexController`, `AggregationController`).
- 🔵 **Schema changes use direct queries**: `Database::drop_tables()` issues `DROP TABLE IF EXISTS ...` using table names derived from `$wpdb->prefix` (`flux_one_events`, `flux_one_email_summaries`) and includes PHPCS ignores for schema-change rules; verify these methods are only invoked in uninstall/cleanup flows.
- ✅ **Custom table creation uses `dbDelta()`**: `Database` uses `dbDelta()` for table creation.

## Phase 6 — Admin Notices & Upsells

- ✅ **Admin notices limited to compatibility/dependency blocking**: `flux-one.php` registers `admin_notices` that render `notice notice-error` for minimum PHP/WP checks and missing dependency checks. These are not dismissible (appropriate for hard-block requirements).
- 🟡 **Manual review for “Pro”/license UI copy**: plugin-owned PHP contains “Pro” strings in command/config catalog entries (e.g. `SuiteConfigCatalog`), but this scan did not identify intrusive `admin_notices` upsells. Verify any UI upgrade messaging is limited to plugin-related screens and does not interrupt core admin flows.

## Phase 7 — External Services & Remote Calls

- 🟠 **External service calls (email summaries)**: `app/Services/EmailSummariesApiClient.php` uses `FluxOne\FluxPlugins\Common\Api\ExternalApiClient` to POST email batch content to Flux API route `api/v1/fo/email-summaries`. Ensure the user must explicitly enable/configure any licensed features before outbound content is sent (verify in Phase 8).
- ✅ **External services disclosure present**: `readme.txt` includes an “External services” section with privacy policy and describes when requests occur and what data may be sent.
- 🔵 **Local dev server URLs exist (debug-only)**: `AdminController` returns `http://localhost:3004/...` only when `WP_DEBUG` and `SCRIPT_DEBUG` are true; production path uses plugin `assets/js/dist/*.js`.

## Phase 8 — Feature Locking & Freemium Language

- ✅ **No obvious paywall/gating strings found in plugin-owned code**: targeted scan did not find `requires license`, `upgrade to unlock`, `pro only`, etc. (This does not prove absence; UI strings may live in built JS bundles.)
- 🔵 **Licensed features disclosed in `readme.txt`**: `readme.txt` states that AI-powered email summaries require a valid Flux Suite license.

## Phase 9 — Internationalization (i18n)

- 🟡 **Text domain loader not found**: no matches for `load_plugin_textdomain()` in plugin-owned PHP (`flux-one.php` + `app/`). Verify where/when `flux-one` text domain is loaded (or whether it relies on language packs without explicit loader).
- ✅ **Text domain consistency (spot-check)**: translation calls observed use `'flux-one'` domain (examples in `AdminController`, `EmailSummaryService`, `EmailSummariesApiClient`, `UsersHandler`).
- 🟡 **Untranslated user-facing strings likely present**: multiple REST responses use raw English strings like `Settings loaded`, `Settings saved`, `Plugins index` (spot-check from greps). Confirm whether these are user-visible in UI; if so, wrap in i18n functions.

## Phase 10 — `readme.txt` Compliance

- 🟠 **Contributors missing required username**: `readme.txt` has `Contributors: fluxplugins` but does not include `edaniels` (required by audit spec).
- 🟠 **Stable tag mismatch**: `readme.txt` `Stable tag: 1.3.0` does not match plugin header `Version: 1.4.1` in `flux-one.php`. WP.org submissions should keep these aligned to the submitted zip.
- 🟡 **Changelog/Upgrade Notice behind current code version**: `readme.txt` changelog and upgrade notice stop at `1.3.0` while plugin header is `1.4.1`. Update entries to reflect current release contents honestly.
- ✅ **Tags count OK**: exactly 5 tags.
- ✅ **Required sections present**: Description, Installation, FAQ, Changelog, Upgrade Notice, Screenshots.

## Phase 11 — Deprecated & Disallowed Functions

- ✅ **No matches found (plugin-owned PHP)**: `extract()`, `compact()`, `create_function()`, `mysql_*`/`mysqli_query`, or backtick execution patterns.
- ✅ **Short tags scan (heuristic)**: no matches for `<?` followed by a non-`p` character at start of PHP files (no `<?` short tags detected in plugin-owned PHP).

## Phase 12 — TODO / FIXME / placeholder comments

- 🟡 **TODO present (plugin-authored JS)**: `src/assets/common/js/src/components/Logs/LogsPage.js` contains `// TODO: Save setting via API when options endpoint is available`.
- ✅ **No TODO/FIXME markers found in plugin-owned PHP**: none under `app/`.

## Phase 13 — Scripts & styles (`wp_enqueue_*`)

- ✅ **No raw `<script>` / `<link>` output detected in plugin-owned PHP** (heuristic scan).
- ✅ **Assets registered/enqueued via WP APIs**: `app/Http/Controllers/AdminController.php` uses `wp_register_script`, `wp_enqueue_script`, `wp_register_style`, `wp_enqueue_style`, and `wp_add_inline_style`.

## Phase 14 — Distribution filenames & uncommon artifacts

- ✅ **No `Zone.Identifier` artifacts found** under `AUDIT_ROOT`.
- ✅ **No cross-platform risky filename characters found** (`:<>\"|?*`) in filenames under `AUDIT_ROOT` (heuristic scan).
- 🟠 **Shell script present in plugin root**: `scripts/run-ephemeral-local.sh` exists and is **not** covered by the current `flux-plugins-common/bin/build-plugin.sh` rsync excludes (no `scripts` / no `*.sh`). This is likely to be flagged if it ships in the WP.org zip.
- 🟡 **SQL file present in plugin root**: `seed-email-events.sql` exists and is **not** covered by current rsync excludes (no `*.sql`). Confirm it should not ship; exclude it from submission artifact if not required at runtime.
- 🟡 **Repo metadata directory may ship**: `.github/` exists and is **not** covered by current rsync excludes. Consider excluding it from the WP.org artifact.


