<?php
/**
 * Plugin Name: Flux One - Command Bar by Flux Plugins
 * Plugin URI: https://fluxplugins.com/flux-one
 * Description: Command-driven control panel for WordPress admin (command palette, dashboard widget, and operational actions).
 * Version: 1.5.0
 * Author: Flux Plugins
 * Author URI: https://fluxplugins.com
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: flux-one
 * Requires at least: 5.8
 * Tested up to: 6.9
 * Requires PHP: 8.1
 *
 * @package FluxOne
 * @since 0.1.0
 */

use FluxOne\App\Plugin;
use FluxOne\App\Services\CleanupService;
use FluxOne\App\Services\Database;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'FLUX_ONE_VERSION', '1.5.0' );
define( 'FLUX_ONE_PLUGIN_FILE', __FILE__ );
define( 'FLUX_ONE_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'FLUX_ONE_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'FLUX_ONE_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );
define( 'FLUX_ONE_PLUGIN_SLUG', 'flux-one' );

// @since 0.1.0 Initial minimum PHP version requirement.
if ( version_compare( PHP_VERSION, '8.1', '<' ) ) {
	add_action(
		'admin_notices',
		static function () {
			?>
			<div class="notice notice-error">
				<p>
					<?php
					printf(
						/* translators: 1: Current PHP version, 2: Required PHP version */
						esc_html__( 'Flux One requires PHP %2$s or higher. You are running PHP %1$s.', 'flux-one' ),
						esc_html( PHP_VERSION ),
						'8.1'
					);
					?>
				</p>
			</div>
			<?php
		}
	);
	return;
}

global $wp_version;
// @since 0.1.0 Initial minimum WordPress version requirement.
if ( version_compare( (string) $wp_version, '5.8', '<' ) ) {
	add_action(
		'admin_notices',
		static function () use ( $wp_version ) {
			?>
			<div class="notice notice-error">
				<p>
					<?php
					printf(
						/* translators: 1: Current WordPress version, 2: Required WordPress version */
						esc_html__( 'Flux One requires WordPress %2$s or higher. You are running WordPress %1$s.', 'flux-one' ),
						esc_html( (string) $wp_version ),
						'5.8'
					);
					?>
				</p>
			</div>
			<?php
		}
	);
	return;
}

// Load Composer autoloader(s).
$autoload = FLUX_ONE_PLUGIN_DIR . 'vendor/autoload.php';
if ( file_exists( $autoload ) ) {
	require_once $autoload;
}

$prefixed_autoload = FLUX_ONE_PLUGIN_DIR . 'vendor-prefixed/autoload.php';
if ( file_exists( $prefixed_autoload ) ) {
	require_once $prefixed_autoload;
}

$flux_plugins_class = '\FluxOne\FluxPlugins\Common\FluxPlugins';
if ( ! class_exists( $flux_plugins_class ) ) {
	add_action(
		'admin_notices',
		static function () {
			?>
			<div class="notice notice-error">
				<p>
					<?php esc_html_e( 'Flux One is missing required dependencies. Please run Composer install for this plugin.', 'flux-one' ); ?>
				</p>
			</div>
			<?php
		}
	);
	return;
}

call_user_func(
	[ $flux_plugins_class, 'init' ],
	FLUX_ONE_PLUGIN_SLUG,
	FLUX_ONE_VERSION,
	'flux-one',
	FLUX_ONE_PLUGIN_URL . 'src/assets/common/'
);

( new Plugin() )->init();

register_activation_hook( __FILE__, 'flux_one_activate' );
register_deactivation_hook( __FILE__, 'flux_one_deactivate' );

/**
 * Plugin activation handler.
 *
 * @since 0.1.0
 * @return void
 */
function flux_one_activate() {
	global $wp_version;
	if ( version_compare( PHP_VERSION, '8.1', '<' ) || version_compare( (string) $wp_version, '5.8', '<' ) ) {
		return;
	}

	Database::create_tables();
	// v1 retention originally scheduled a daily cleanup; email events are now retained until explicitly deleted.
	CleanupService::clear_schedule();
}

/**
 * Plugin deactivation handler.
 *
 * @since 0.1.0
 * @return void
 */
function flux_one_deactivate() {
	CleanupService::clear_schedule();
}

