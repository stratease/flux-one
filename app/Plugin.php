<?php
/**
 * Main plugin class.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App;

// @since 1.5.1 Guard against direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use FluxOne\App\Http\Controllers\AdminController;
use FluxOne\App\Http\Controllers\CommandController;
use FluxOne\App\Http\Controllers\BootstrapController;
use FluxOne\App\Http\Controllers\IndexController;
use FluxOne\App\Http\Controllers\MenuController;
use FluxOne\App\Http\Controllers\AggregationController;
use FluxOne\App\Http\Controllers\HeartbeatController;
use FluxOne\App\Http\Controllers\MemoryController;
use FluxOne\App\Http\Controllers\SettingsController;
use FluxOne\App\Services\Database;
use FluxOne\App\Services\CommandHandlers\UsersHandler;
use FluxOne\App\Services\AdminDestinations;
use FluxOne\App\Services\EmailEventLogger;
use FluxOne\App\Services\EmailMailPolicy;
use FluxOne\App\Services\FluxOneSettings;

/**
 * Plugin orchestrator.
 *
 * @since 0.1.0
 */
class Plugin {

	/**
	 * Initialize the plugin.
	 *
	 * @since 0.1.0
	 * @since 1.6.3 AdminController always initializes so Command Bar can load on the front for `manage_options`; AdminDestinations stays admin-only.
	 * @return void
	 */
	public function init() {
		Database::maybe_update_database();

		add_action( 'plugins_loaded', [ FluxOneSettings::class, 'maybe_migrate_legacy_email_options' ], 20 );

		add_action( 'admin_init', [ FluxOneSettings::class, 'register_settings' ] );

		( new AdminController() )->init();

		if ( is_admin() ) {
			AdminDestinations::register();
		}

		add_filter( 'wp_authenticate_user', [ UsersHandler::class, 'enforce_lock_on_authentication' ], 10, 1 );
		add_filter( 'wp_mail', [ ( new EmailEventLogger() ), 'capture_wp_mail' ], 5, 1 );
		EmailMailPolicy::register();

		// Never suppress operational emails (password reset, welcome, account changes).
		add_filter( 'retrieve_password_notification_email', [ EmailMailPolicy::class, 'mark_never_suppress_email' ], 10, 4 );
		add_filter( 'wp_new_user_notification_email', [ EmailMailPolicy::class, 'mark_never_suppress_email' ], 10, 3 );
		add_filter( 'wp_new_user_notification_email_admin', [ EmailMailPolicy::class, 'mark_never_suppress_email' ], 10, 3 );
		add_filter( 'new_user_email_content', [ EmailMailPolicy::class, 'mark_never_suppress_email' ], 10, 2 );
		add_filter( 'new_admin_email_content', [ EmailMailPolicy::class, 'mark_never_suppress_email' ], 10, 2 );
		add_filter( 'password_change_email', [ EmailMailPolicy::class, 'mark_never_suppress_email' ], 10, 3 );

		add_action( 'rest_api_init', [ $this, 'register_rest_routes' ] );
	}

	/**
	 * Register REST routes.
	 *
	 * @since 0.1.0
	 * @return void
	 */
	public function register_rest_routes() {
		( new BootstrapController() )->register_routes();
		( new CommandController() )->register_routes();
		( new IndexController() )->register_routes();
		( new MenuController() )->register_routes();
		( new AggregationController() )->register_routes();
		( new HeartbeatController() )->register_routes();
		( new MemoryController() )->register_routes();
		( new SettingsController() )->register_routes();
	}
}

