<?php
/**
 * Records recently viewed wp-admin screens for the Command Central dashboard widget.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Services;

/**
 * Hooks {@see UserCommandMemory} on normal admin page loads (not only `nav` commands).
 *
 * @since 0.1.0
 */
class AdminVisitRecorder {

	/**
	 * Register WordPress hooks.
	 *
	 * @since 0.1.0
	 * @return void
	 */
	public static function register() {
		add_action( 'current_screen', [ self::class, 'record_visit' ], 999 );
	}

	/**
	 * Persist this screen as a recent destination when appropriate.
	 *
	 * @since 0.1.0
	 * @param \WP_Screen|null $screen Current screen.
	 * @return void
	 */
	public static function record_visit( $screen ) {
		if ( wp_doing_ajax() ) {
			return;
		}

		if ( defined( 'DOING_CRON' ) && DOING_CRON ) {
			return;
		}

		if ( defined( 'IFRAME_REQUEST' ) && IFRAME_REQUEST ) {
			return;
		}

		if ( ! is_user_logged_in() || ! current_user_can( 'manage_options' ) ) {
			return;
		}

		if ( ! $screen instanceof \WP_Screen ) {
			return;
		}

		global $pagenow;
		if ( ! is_string( $pagenow ) || $pagenow === '' ) {
			return;
		}

		$skip_pages = [
			'admin-ajax.php',
			'load-styles.php',
			'load-scripts.php',
			'async-upload.php',
		];
		if ( in_array( $pagenow, $skip_pages, true ) ) {
			return;
		}

		$url = self::build_current_admin_url();
		if ( $url === '' || ! self::is_valid_saved_destination_url( $url ) ) {
			return;
		}

		// Avoid get_admin_page_title() when ?page= is absent: core calls get_plugin_page_hook( $plugin_page, … )
		// with unset $plugin_page, which triggers preg_replace( …, null ) deprecation on PHP 8.1+.
		$title = '';
		$plugin_page_ok = isset( $GLOBALS['plugin_page'] ) && is_string( $GLOBALS['plugin_page'] ) && $GLOBALS['plugin_page'] !== '';
		if ( function_exists( 'get_admin_page_title' ) && $plugin_page_ok ) {
			$title = (string) get_admin_page_title();
		}
		if ( $title === '' ) {
			$title = (string) $screen->id;
		}

		( new UserCommandMemory() )->add_recent_destination( $url, $title, null );
	}

	/**
	 * Reconstruct the admin URL for the current request from $pagenow and $_GET.
	 *
	 * @since 0.1.0
	 * @return string Empty string if not buildable.
	 */
	private static function build_current_admin_url() {
		global $pagenow;

		$query = isset( $_GET ) && is_array( $_GET ) ? wp_unslash( $_GET ) : [];
		unset( $query['_wpnonce'], $query['wp_http_referer'] );

		if ( is_network_admin() ) {
			$base = network_admin_url( $pagenow );
		} else {
			$base = admin_url( $pagenow );
		}

		$url = add_query_arg( $query, $base );

		return esc_url_raw( $url );
	}

	/**
	 * Whether a URL may be stored or opened from recent destinations (same host, wp-admin path).
	 *
	 * @since 0.1.0
	 * @param string $url URL.
	 * @return bool
	 */
	public static function is_valid_saved_destination_url( $url ) {
		$expected_host = wp_parse_url( admin_url(), PHP_URL_HOST );
		$target_host   = wp_parse_url( $url, PHP_URL_HOST );
		if ( ! is_string( $expected_host ) || $expected_host === '' || ! is_string( $target_host ) || $target_host === '' ) {
			return false;
		}
		if ( strtolower( $expected_host ) !== strtolower( $target_host ) ) {
			return false;
		}

		$path = (string) wp_parse_url( $url, PHP_URL_PATH );

		return strpos( $path, '/wp-admin' ) !== false;
	}
}
