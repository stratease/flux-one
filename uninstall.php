<?php
/**
 * Uninstall handler.
 *
 * @package FluxOne
 * @since 0.1.0
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// Load Composer autoloader(s) if available (needed for Database class).
$plugin_dir = plugin_dir_path( __FILE__ );
$autoload   = $plugin_dir . 'vendor/autoload.php';
if ( file_exists( $autoload ) ) {
	require_once $autoload;
}
$prefixed_autoload = $plugin_dir . 'vendor-prefixed/autoload.php';
if ( file_exists( $prefixed_autoload ) ) {
	require_once $prefixed_autoload;
}

if ( class_exists( '\FluxOne\App\Services\Database' ) ) {
	\FluxOne\App\Services\Database::drop_tables();
}

// Remove plugin options.
delete_option( 'flux_one_db_version' );

// Remove per-user memory.
delete_metadata( 'user', 0, '_flux_one_command_memory', '', true );

