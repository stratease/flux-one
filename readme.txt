=== Flux One - Command Bar ===
Contributors: edaniels
Tags: command bar, command palette, admin productivity, streamline, wp-admin
Requires at least: 5.8
Tested up to: 6.9
Requires PHP: 8.1
Stable tag: 1.6.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Run WordPress faster with a command bar for common admin tasks, workflow shortcuts, dashboard actions, and optional AI-powered email summaries.

== Description ==

Flux One adds a command bar to WordPress admin so you can complete common site-management tasks without digging through menus, screens, and settings pages.

Use Flux One to search, navigate, and trigger supported admin actions from one focused interface.

It is built for WordPress administrators, agencies, freelancers, WooCommerce managers, and site owners who want a faster way to operate WordPress.

= Why use Flux One? =

WordPress admin tasks often require too much clicking.

Flux One helps reduce that friction by giving you a command-driven interface for common workflows.

Instead of navigating through multiple admin screens, open the Flux One command bar, type what you need, and take action.

= Key features =

* Command bar interface inside WordPress admin
* Dashboard widget for quick access to operational actions
* Fast admin navigation and workflow shortcuts
* Command-style access to supported WordPress actions
* Cleaner workflow for repetitive site-management tasks
* Email aggregate and summary screen
* Optional AI-powered email summaries (Flux-connected processing when integrated) with urgent and important items surfaced first
* Designed for agencies, power users, and day-to-day site operators

= Example workflows =

Flux One is designed for common admin tasks such as:

* Finding and opening admin screens faster
* Running supported operational actions
* Reviewing outbound email activity
* Summarizing email content into a concise operational view
* Identifying urgent or important action items from email activity
* Reducing repetitive navigation inside wp-admin

= AI email summaries =

Flux One includes an email aggregate and summary interface.

With an active Flux Suite connection, Flux One can send captured outbound email content to Flux-hosted services for summarization into a clearer operational view, with urgent and important action items prioritized above the full summary. That processing runs on Flux infrastructure, not entirely inside the plugin.

This is useful for site owners and agencies who want better visibility into what their WordPress site is sending and which items may need attention.

= Built for WordPress admin workflows =

Flux One is not a replacement for WP-CLI or advanced developer tooling.

It is built for normal WordPress admin workflows where speed, clarity, and fewer clicks matter.

= Flux Suite =

Flux One can connect with Flux Suite to use Flux-hosted capabilities such as AI-powered summaries and future Flux workflow enhancements.

The core plugin provides command and dashboard workflow functionality. Licensed Flux Suite features add advanced intelligence and summarization capabilities.

= Third-party libraries =

This plugin bundles third-party libraries in the distributed build. Exact contents are defined by the build packaging process.

Bundled libraries include:

* Flux Plugins Common (Strauss-prefixed PHP in `vendor-prefixed/stratease/flux-plugins-common/`; runtime JS in `src/assets/common/js/dist/`) — license as included with the library.

= External services =

Flux One includes a shared Flux Plugins Common library that can communicate with the Flux Plugins API service for license validation/activation, compatibility checks, and optional hosted capabilities (for example AI-assisted summarization) when you use those features.

* Service: Flux Plugins API. Default base URL: `https://api.fluxplugins.com`. This may be overridden with `FLUX_PLUGINS_COMMON_EXTERNAL_SERVICE_URL`.
* When requests occur: when a license key is activated or validated, when compatibility checks are performed by the shared library, and when optional hosted features (such as AI-assisted summarization) request processing.
* Data sent may include: license key, account ID, site URL/domain (`home_url()`), and plugin version. See the `ExternalApiClient` implementation in the bundled common library.

Privacy policy: https://fluxplugins.com/privacy/

Terms of use: https://fluxplugins.com/terms-of-service/

== Development / Build instructions ==

This plugin ships compiled JavaScript bundles in the WordPress.org package:

* `assets/js/dist/*` (Flux One admin UI)
* `src/assets/common/js/dist/*` (Flux Suite shared admin pages: License, Logs, Compatibility)

Human-readable source code for these bundles is available in repository: https://github.com/stratease/flux-one (WordPress.org listing slug: `flux-one-command-bar`; text domain matches that slug).

To rebuild bundles from source:

1. Install Node dependencies:
   - `npm ci`
2. Build Flux One admin UI bundles:
   - `npm run build`
   - Output: `assets/js/dist/`

The Flux Suite shared admin page bundles under `src/assets/common/js/dist/` are built in the `flux-plugins-common` repository (`npm run build`) and copied into this plugin during Composer install/update via the `copy-common-assets` script (`js/dist` and `images` only).

== Installation ==

1. Upload the plugin ZIP to your WordPress site, or install it from the WordPress plugin directory.
2. Activate the plugin through the “Plugins” screen in WordPress.
3. Open your WordPress admin dashboard.
4. Use the Flux One command bar hotkeys (Cmd / Ctrl + .) and dashboard surfaces to start running supported admin workflows faster.

== Frequently Asked Questions ==

= What does Flux One do? =

Flux One adds a command bar and dashboard workflow layer to WordPress admin so you can access common actions, shortcuts, and operational views faster.

= Is Flux One only for developers? =

No. Flux One is designed for WordPress administrators, agencies, freelancers, WooCommerce managers, and site owners. It does not require command-line knowledge.

= Does Flux One replace WP-CLI? =

No. WP-CLI is a developer command-line tool. Flux One is a wp-admin productivity interface for faster day-to-day operations.

= Does Flux One include AI features? =

Flux One includes an email aggregate and summary screen. AI-powered email summaries and urgent action prioritization use Flux-connected processing and need an active Flux Suite license and external connection so those hosted services can run the work.

= What is Flux Suite? =

Flux Suite is the Flux Plugins offering that connects supported plugins—including Flux One to shared Flux services. It provides access to hosted capabilities such as AI-powered summaries and related workflow enhancements. Core Flux One command bar features work without a license and are not locked; the Flux Suite license applies where processing is delivered from Flux infrastructure.

= Does Flux One send data to an external service? =

Flux One may communicate with the Flux Plugins API for license validation, license activation, compatibility checks, and optional hosted feature requests such as AI-assisted summarization when you use those capabilities. See the External services section for details.

== Screenshots ==

1. Flux One command bar inside WordPress admin.
2. Dashboard widget with operational actions.
3. Email aggregate and summary screen.
4. AI-powered email summary with urgent action items prioritized.

== Changelog ==

= 1.6.4 =
* Command Bar suite configuration panel (`config list`): grouped grid with inline controls for Flux suite plugin settings and curated WordPress options (Settings → General, Reading, Permalinks).
* Dev-only UI component design guide tab in the Flux One admin app (when `WP_DEBUG` and `SCRIPT_DEBUG` are enabled).
* Updated some dependencies, trimming overall package size.

= 1.6.3 =
* Removed any references to incomplete "site" feature.
* Updated some language around licensing features to clarify the service requires integration with our 3rd party infrastructure, and it is not trialware or feature locked capabilities.
* Removed direct Composer requirement on Monolog; `vendor/monolog/monolog/` may still appear as a transitive dependency.

= 1.6.2 =
* Maintenance and WordPress.org readiness (documentation, i18n text domain alignment, serviceware disclosure).


== Upgrade Notice ==

= 1.6.3 =
Documentation and disclosure copy only (Flux Suite described as connected services).

= 1.6.0 =
Adds Overview onboarding help; see changelog for prior releases.
