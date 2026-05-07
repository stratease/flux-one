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
if ( ! function_exists( 'apply_filters' ) ) {
	function apply_filters( $hook_name, $value, ...$args ) {
		return $value;
	}
}
if ( ! function_exists( 'get_option' ) ) {
	function get_option( $key, $default = false ) {
		if ( ! isset( $GLOBALS['flux_one_test_options'] ) || ! is_array( $GLOBALS['flux_one_test_options'] ) ) {
			return $default;
		}
		return array_key_exists( $key, $GLOBALS['flux_one_test_options'] )
			? $GLOBALS['flux_one_test_options'][ $key ]
			: $default;
	}
}
if ( ! function_exists( 'update_option' ) ) {
	function update_option( $key, $value, $autoload = null ) {
		if ( ! isset( $GLOBALS['flux_one_test_options'] ) || ! is_array( $GLOBALS['flux_one_test_options'] ) ) {
			$GLOBALS['flux_one_test_options'] = [];
		}
		$GLOBALS['flux_one_test_options'][ $key ] = $value;
		return true;
	}
}
if ( ! function_exists( 'get_user_meta' ) ) {
	function get_user_meta( $user_id, $key, $single = false ) {
		return $single ? '' : [];
	}
}
if ( ! function_exists( 'sanitize_text_field' ) ) {
	function sanitize_text_field( $str ) {
		return trim( wp_strip_all_tags( (string) $str ) );
	}
}
if ( ! function_exists( 'sanitize_textarea_field' ) ) {
	function sanitize_textarea_field( $str ) {
		return sanitize_text_field( $str );
	}
}
if ( ! function_exists( 'sanitize_email' ) ) {
	function sanitize_email( $email ) {
		return trim( strtolower( (string) $email ) );
	}
}
if ( ! function_exists( 'sanitize_key' ) ) {
	function sanitize_key( $key ) {
		return strtolower( preg_replace( '/[^a-z0-9_\-]/', '', (string) $key ) );
	}
}
if ( ! function_exists( 'sanitize_option' ) ) {
	function sanitize_option( $option, $value ) {
		return $value;
	}
}
if ( ! function_exists( 'wp_strip_all_tags' ) ) {
	function wp_strip_all_tags( $str, $remove_breaks = false ) {
		return strip_tags( (string) $str );
	}
}
if ( ! function_exists( 'flush_rewrite_rules' ) ) {
	function flush_rewrite_rules( $hard = true ) {
		return true;
	}
}
if ( ! class_exists( 'WP_Post' ) ) {
	class WP_Post {
		public $ID = 0;
		public $post_type = 'page';
	}
}
if ( ! function_exists( 'get_post' ) ) {
	function get_post( $post = null, $output = OBJECT, $filter = 'raw' ) {
		$pid = (int) $post;
		if ( $pid > 0 && ! empty( $GLOBALS['flux_one_test_posts'][ $pid ] ) ) {
			return $GLOBALS['flux_one_test_posts'][ $pid ];
		}
		return null;
	}
}
if ( ! class_exists( 'WP_Error' ) ) {
	class WP_Error {
		private $message = '';
		public function __construct( $code = '', $message = '', $data = '' ) {
			$this->message = (string) $message;
		}
		public function get_error_message() {
			return $this->message;
		}
	}
}
if ( ! function_exists( 'is_wp_error' ) ) {
	function is_wp_error( $thing ) {
		return $thing instanceof WP_Error;
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
if ( ! class_exists( 'WP_User' ) ) {
	class WP_User {
		public $ID = 0;
		public $user_email = '';
	}
}
if ( ! function_exists( 'get_current_user_id' ) ) {
	function get_current_user_id() {
		return isset( $GLOBALS['flux_one_test_current_user_id'] ) ? (int) $GLOBALS['flux_one_test_current_user_id'] : 0;
	}
}
if ( ! function_exists( 'get_user_by' ) ) {
	function get_user_by( $field, $value ) {
		if ( ! empty( $GLOBALS['flux_one_test_get_user_by_user'] ) && $GLOBALS['flux_one_test_get_user_by_user'] instanceof WP_User ) {
			return $GLOBALS['flux_one_test_get_user_by_user'];
		}
		return false;
	}
}
if ( ! function_exists( 'update_user_meta' ) ) {
	function update_user_meta( $user_id, $meta_key, $meta_value ) {
		return true;
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
if ( ! function_exists( 'wp_get_nav_menus' ) ) {
	function wp_get_nav_menus() {
		return [];
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
require_once dirname( __DIR__ ) . '/app/Services/AdminBarHotkeyDisplay.php';

$flux_autoload = dirname( __DIR__ ) . '/vendor/autoload.php';
if ( is_readable( $flux_autoload ) ) {
	require_once $flux_autoload;
}
