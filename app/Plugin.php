<?php
/**
 * Main plugin class.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App;

use FluxOne\App\Http\Controllers\AdminController;
use FluxOne\App\Http\Controllers\CommandController;
use FluxOne\App\Http\Controllers\BootstrapController;
use FluxOne\App\Http\Controllers\IndexController;
use FluxOne\App\Http\Controllers\MenuController;
use FluxOne\App\Http\Controllers\AggregationController;
use FluxOne\App\Http\Controllers\MemoryController;
use FluxOne\App\Http\Controllers\SettingsController;
use FluxOne\App\Services\Database;
use FluxOne\App\Services\CleanupService;
use FluxOne\App\Services\CommandHandlers\UsersHandler;
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
	 * @return void
	 */
	public function init() {
		Database::maybe_update_database();

		add_action( 'plugins_loaded', [ FluxOneSettings::class, 'maybe_migrate_legacy_email_options' ], 20 );

		add_action( 'admin_init', [ FluxOneSettings::class, 'register_settings' ] );

		if ( is_admin() ) {
			( new AdminController() )->init();
		}

		add_action( CleanupService::CRON_HOOK, [ CleanupService::class, 'run' ] );
		add_filter( 'wp_authenticate_user', [ UsersHandler::class, 'enforce_lock_on_authentication' ], 10, 1 );
		add_filter( 'wp_mail', [ ( new EmailEventLogger() ), 'capture_wp_mail' ], 5, 1 );
		EmailMailPolicy::register();

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
		( new MemoryController() )->register_routes();
		( new SettingsController() )->register_routes();
	}
}

