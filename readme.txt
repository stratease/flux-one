=== Flux One - Command Bar by Flux Plugins ===
Contributors: edaniels
Tags: command bar, command palette, admin productivity, streamline, wp-admin
Requires at least: 5.8
Tested up to: 6.9
Requires PHP: 8.1
Stable tag: 1.4.2
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
* Optional AI-powered email summaries with urgent and important items surfaced first
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

With a valid Flux Suite license, Flux One can summarize captured outbound email content into a clearer operational view, with urgent and important action items prioritized above the full summary.

This is useful for site owners and agencies who want better visibility into what their WordPress site is sending and which items may need attention.

= Built for WordPress admin workflows =

Flux One is not a replacement for WP-CLI or advanced developer tooling.

It is built for normal WordPress admin workflows where speed, clarity, and fewer clicks matter.

= Flux Suite =

Flux One can connect with Flux Suite for licensed features such as AI-powered summaries and future Flux workflow enhancements.

The core plugin provides command and dashboard workflow functionality. Licensed Flux Suite features add advanced intelligence and summarization capabilities.

= Third-party libraries =

This plugin bundles third-party libraries in the distributed build. Exact contents are defined by the build packaging process.

Bundled libraries include:

* WooCommerce Action Scheduler (`vendor/woocommerce/action-scheduler/`) — GPLv3 compatible. See included library license/readme.
* Monolog (`vendor-prefixed/monolog/monolog/` and/or `vendor/monolog/monolog/`) — MIT License.
* PSR-3 Logger Interface (`vendor-prefixed/psr/log/` and/or `vendor/psr/log/`) — MIT License.
* Flux Plugins Common (Strauss-prefixed) (`vendor-prefixed/stratease/flux-plugins-common/` and/or `vendor/stratease/flux-plugins-common/`) — license as included with the library.

= External services =

Flux One includes a shared Flux Plugins Common library that can communicate with the Flux Plugins API service for license validation/activation and compatibility checks.

* Service: Flux Plugins API. Default base URL: `https://api.fluxplugins.com`. This may be overridden with `FLUX_PLUGINS_COMMON_EXTERNAL_SERVICE_URL`.
* When requests occur: when a license key is activated or validated, and when compatibility checks are performed by the shared library.
* Data sent may include: license key, account ID, site URL/domain (`home_url()`), and plugin version. See the `ExternalApiClient` implementation in the bundled common library.

Privacy policy: https://fluxplugins.com/privacy

== Development / Build instructions ==

This plugin ships compiled JavaScript bundles in the WordPress.org package:

* `assets/js/dist/*` (Flux One admin UI)
* `src/assets/common/js/dist/*` (Flux Suite shared admin pages: License, Logs, Compatibility)

Human-readable source code for these bundles is available in repository: https://github.com/stratease/flux-one.

To rebuild bundles from source:

1. Install Node dependencies:
   - `npm ci`
2. Build Flux One admin UI bundles:
   - `npm run build`
   - Output: `assets/js/dist/`

The Flux Suite shared admin page bundles under `src/assets/common/js/dist/` are copied into this plugin during Composer install/update via the `copy-common-assets` script in `composer.json` (from `vendor/stratease/flux-plugins-common/src/assets/`).

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

Flux One includes an email aggregate and summary screen. AI-powered email summaries and urgent action prioritization require a valid Flux Suite license.

= What is Flux Suite? =

Flux Suite is the Flux Plugins license that unlocks Pro features across supported Flux plugins, including AI-powered summaries and other advanced workflow features.

= Does Flux One send data to an external service? =

Flux One may communicate with the Flux Plugins API for license validation, license activation, and compatibility checks. See the External services section for details.

== Screenshots ==

1. Flux One command bar inside WordPress admin.
2. Dashboard widget with operational actions.
3. Email aggregate and summary screen.
4. AI-powered email summary with urgent action items prioritized.

== Changelog ==

= 1.4.2 =
* Some UX improvements on config and fixed some entity search bugs.

= 1.4.1 =
* Improves AI email summary reliability with longer request timeout, compatibility gating, and clearer failure logging.

= 1.3.0 =
* Major update to email aggregate and email summary screen and functionality.
* Improved sorting for email summaries and operational review.
* Tested Flux API service integration.
* General workflow and reliability improvements.


== Upgrade Notice ==

= 1.3.0 =
Improves the email aggregate and summary experience with better sorting, tested API integration, and clearer operational review workflows.
