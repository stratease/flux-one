# Plugin Remediation Plan: flux-one
Generated from: `wp-content/plugins/flux-one/audit-findings.md`

## Execution Order
Fix HIGH items first, then MEDIUM. Each task below is scoped to be completable
in a single Cursor agent session.

---

## Task 1 — Fix `readme.txt` contributors + release metadata 🟠
**Guideline:** WordPress.org Plugin Guidelines (accuracy; `readme.txt` compliance) — `https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/`
**Files:** `wp-content/plugins/flux-one/readme.txt`, `wp-content/plugins/flux-one/flux-one.php`
**What to do:**
- Update `Contributors:` to include `edaniels` (keep existing contributors as needed), e.g. `Contributors: fluxplugins, edaniels`.
- Align `Stable tag:` with submitted release version. Current plugin header is `Version: 1.4.1` (in `flux-one.php`), so set `Stable tag: 1.4.1` for that submission (or update plugin header if submitting a different version).
- Add `= 1.4.1 =` entries to both `== Changelog ==` and `== Upgrade Notice ==` (or update to the exact version being submitted), describing changes honestly.
**Verify by:**
- `readme.txt` has `edaniels` on `Contributors:` line.
- `readme.txt` `Stable tag:` matches `flux-one.php` `Version:`.
- `readme.txt` contains changelog and upgrade notice for the submitted version.

---

## Task 2 — Prevent shell script from shipping in WP.org zip 🟠
**Guideline:** WordPress.org Plugin Guidelines (no unnecessary executables in submissions) — `https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/`
**Files:** `wp-content/plugins/flux-one/scripts/run-ephemeral-local.sh`, `flux-plugins-common/bin/build-plugin.sh`
**What to do (pick one approach; default: exclude from zip):**
- **Preferred:** Add an rsync exclude for `scripts/` (or at minimum `scripts/*.sh`) in `flux-plugins-common/bin/build-plugin.sh`, so it cannot ship in the WP.org artifact.
- Alternative: Remove `scripts/run-ephemeral-local.sh` from plugin directory (move it to a non-shipped test harness location outside `AUDIT_ROOT`), if it is not required for plugin runtime.
**Verify by:**
- Ensure `scripts/run-ephemeral-local.sh` is excluded from the submission artifact (by exclude list inspection and/or by checking the produced zip contents when you build outside this audit).

---

## Task 3 — Exclude non-runtime repo artifacts from WP.org zip 🟡
**Guideline:** WordPress.org Plugin Guidelines (clean distribution) — `https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/`
**Files:** `wp-content/plugins/flux-one/seed-email-events.sql`, `wp-content/plugins/flux-one/.github/`, `flux-plugins-common/bin/build-plugin.sh`
**What to do:**
- Add rsync excludes for `seed-email-events.sql` (or `*.sql`) and `.github/` in `flux-plugins-common/bin/build-plugin.sh`, unless you explicitly intend to ship them.
- Optionally consider excluding `README.md` if it is purely developer-facing (WP.org uses `readme.txt`).
**Verify by:**
- Exclude list covers `*.sql` (or the specific SQL file) and `.github/`.
- Submission artifact does not contain these files/directories.

---

## Task 4 — Load text domain and translate user-visible strings 🟡
**Guideline:** Internationalization — `https://developer.wordpress.org/plugins/internationalization/how-to-internationalize-your-plugin/`
**Files:** `wp-content/plugins/flux-one/flux-one.php` and/or `wp-content/plugins/flux-one/app/Plugin.php`, plus REST controllers returning raw English messages (e.g. `wp-content/plugins/flux-one/app/Http/Controllers/SettingsController.php`, `IndexController.php`, etc.)
**What to do:**
- Add/confirm `load_plugin_textdomain( 'flux-one', false, dirname( plugin_basename( FLUX_ONE_PLUGIN_FILE ) ) . '/languages' );` is called on `plugins_loaded` (or equivalent early hook).
- Wrap user-facing REST response messages currently returned as raw strings (examples observed: `Settings loaded`, `Settings saved`, `Plugins index`) with translation helpers using domain `flux-one`.
**Verify by:**
- With `WPLANG` set and translations available, plugin UI strings and REST UI-facing messages translate correctly.

---

## Task 5 — Resolve shipped TODO marker in admin JS 🟡
**Guideline:** WordPress.org review expectations (no unfinished TODOs in shipped code)
**Files:** `wp-content/plugins/flux-one/src/assets/common/js/src/components/Logs/LogsPage.js`
**What to do:**
- Replace `// TODO: Save setting via API when options endpoint is available` by either implementing the API save (if endpoint exists) or removing the TODO and ensuring behavior is correct for shipped UI.
**Verify by:**
- Grep for `TODO` in plugin-authored JS no longer finds this marker.

---

## Task 6 — Confirm licensed external service calls are opt-in 🟡
**Guideline:** External services + privacy disclosure — `https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/`
**Files:** `wp-content/plugins/flux-one/app/Services/EmailSummariesApiClient.php`, calling sites in `EmailSummaryService.php` / UI flows; `wp-content/plugins/flux-one/readme.txt`
**What to do:**
- Confirm AI email summary requests are only made after explicit user action and/or explicit feature enablement + valid license state (not automatically on activation).
- Ensure errors shown to users are clear and do not pressure/upsell outside plugin context.
**Verify by:**
- With feature disabled and/or no license, no summarization HTTP requests are attempted.
- `readme.txt` external services section remains accurate for actual behavior.
