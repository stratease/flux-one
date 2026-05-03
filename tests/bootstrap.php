<?php
/**
 * PHPUnit bootstrap for Flux One.
 *
 * @package FluxOne
 * @since 0.1.0
 */

// Minimal stubs so unit tests can run without a full WP test suite.
if ( ! defined( 'DAY_IN_SECONDS' ) ) {
	define( 'DAY_IN_SECONDS', 86400 );
}

if ( ! function_exists( 'current_user_can' ) ) {
	function current_user_can( $capability ) {
		return true;
	}
}
if ( ! function_exists( 'is_multisite' ) ) {
	function is_multisite() {
		return false;
	}
}
if ( ! function_exists( 'get_transient' ) ) {
	function get_transient( $key ) {
		return null;
	}
}
if ( ! function_exists( 'set_transient' ) ) {
	function set_transient( $key, $value, $ttl ) {
		return true;
	}
}
if ( ! function_exists( 'get_option' ) ) {
	function get_option( $key, $default = false ) {
		return $default;
	}
}
if ( ! function_exists( 'wp_parse_args' ) ) {
	function wp_parse_args( $args, $defaults = [] ) {
		return array_merge( $defaults, is_array( $args ) ? $args : [] );
	}
}
if ( ! function_exists( 'is_email' ) ) {
	function is_email( $email ) {
		return (bool) filter_var( $email, FILTER_VALIDATE_EMAIL );
	}
}
if ( ! function_exists( 'get_user_by' ) ) {
	function get_user_by( $field, $value ) {
		return false;
	}
}
if ( ! function_exists( '__' ) ) {
	function __( $text, $domain = null ) {
		return $text;
	}
}
if ( ! function_exists( 'admin_url' ) ) {
	function admin_url( $path = '' ) {
		return 'https://example.test/wp-admin/' . ltrim( (string) $path, '/' );
	}
}
if ( ! function_exists( 'wp_is_file_mod_allowed' ) ) {
	function wp_is_file_mod_allowed( $context = '' ) {
		return true;
	}
}

// Load the classes under test directly (no Composer autoload required).
require_once dirname( __DIR__ ) . '/app/Services/AdminDestinations.php';
require_once dirname( __DIR__ ) . '/app/Services/CommandHandlers/NavigationHandler.php';
require_once dirname( __DIR__ ) . '/app/Services/CommandHandlers/MenusHandler.php';
require_once dirname( __DIR__ ) . '/app/Services/IndexCacheService.php';
require_once dirname( __DIR__ ) . '/app/Services/UserCommandMemory.php';
require_once dirname( __DIR__ ) . '/app/Services/CommandHandlers/PluginsHandler.php';
require_once dirname( __DIR__ ) . '/app/Services/CommandHandlers/UsersHandler.php';
require_once dirname( __DIR__ ) . '/app/Services/CommandHandlers/MultisiteHandler.php';
require_once dirname( __DIR__ ) . '/app/Services/CommandRouter.php';
require_once dirname( __DIR__ ) . '/app/Services/Database.php';
require_once dirname( __DIR__ ) . '/app/Services/EmailAggregationService.php';

