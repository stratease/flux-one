=== Flux One - Command Center by Flux Plugins ===
Contributors: fluxplugins
Tags: admin, command palette, operations, workflow, dashboard
Requires at least: 5.8
Tested up to: 6.9
Requires PHP: 8.1
Stable tag: 1.3.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Command-driven control layer for WordPress admin: command palette overlay, dashboard widget, and operational actions.

== Description ==

Flux One adds an operator-focused command interface in wp-admin (Command Center) to run common admin tasks quickly.

= Third-party libraries =

This plugin bundles third-party libraries in the distributed build (exact contents defined by the build packaging process).

Bundled libraries include (non-exhaustive; disclose all bundled libraries in the submission artifact):

* WooCommerce Action Scheduler (`vendor/woocommerce/action-scheduler/`) — GPLv3 compatible. See included library license/readme.
* Monolog (`vendor-prefixed/monolog/monolog/` and/or `vendor/monolog/monolog/`) — MIT License.
* PSR-3 Logger Interface (`vendor-prefixed/psr/log/` and/or `vendor/psr/log/`) — MIT License.
* Flux Plugins Common (Strauss-prefixed) (`vendor-prefixed/stratease/flux-plugins-common/` and/or `vendor/stratease/flux-plugins-common/`) — license as included with the library.

= External services =

Flux One includes a shared Flux Plugins Common library that can communicate with the Flux Plugins API service for license validation/activation and compatibility checks.

* Service: Flux Plugins API (default base URL `https://api.fluxplugins.com`; overrideable via `FLUX_PLUGINS_COMMON_EXTERNAL_SERVICE_URL`).
* When requests occur: when a license key is activated/validated, and when compatibility checks are performed by the shared library.
* Data sent may include: license key, account ID, site URL/domain (`home_url()`), and plugin version (see `ExternalApiClient` implementation in bundled common library).

Privacy policy: https://fluxplugins.com/privacy

== Installation ==

1. Upload the plugin ZIP to your WordPress site.
2. Activate the plugin through the “Plugins” screen in WordPress.
3. Open wp-admin Dashboard to access the Flux One Command Center surfaces.

== Changelog ==

= 1.3.0 =
* Major update to email aggregate and email summary screen and functionality. Better sorting, tested API service integration and more.

= 1.2.0 =
* Initial public release.

