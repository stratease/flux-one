<?php
/**
 * Records recently viewed wp-admin screens for the Command Bar dashboard widget.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Services;

// @since 1.5.1 Guard against direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

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

		$title = self::resolve_screen_label( $screen );

		( new UserCommandMemory() )->add_recent_destination( $url, $title, null );
	}

	/**
	 * Human-friendly label for recent navigation (prefer real admin titles over raw screen ids).
	 *
	 * @param \WP_Screen $screen Current screen.
	 * @return string
	 */
	private static function resolve_screen_label( \WP_Screen $screen ) {
		if ( isset( $GLOBALS['title'] ) && is_string( $GLOBALS['title'] ) ) {
			$t = trim( wp_strip_all_tags( $GLOBALS['title'] ) );
			if ( $t !== '' ) {
				return $t;
			}
		}

		// Avoid get_admin_page_title() when ?page= is absent: core calls get_plugin_page_hook( $plugin_page, … )
		// with unset $plugin_page, which triggers preg_replace( …, null ) deprecation on PHP 8.1+.
		$plugin_page_ok = isset( $GLOBALS['plugin_page'] ) && is_string( $GLOBALS['plugin_page'] ) && $GLOBALS['plugin_page'] !== '';
		if ( function_exists( 'get_admin_page_title' ) && $plugin_page_ok ) {
			$t = trim( wp_strip_all_tags( (string) get_admin_page_title() ) );
			if ( $t !== '' ) {
				return $t;
			}
		}

		global $pagenow, $submenu;
		if ( $pagenow === 'admin.php' && isset( $_GET['page'] ) && is_string( $_GET['page'] ) && $_GET['page'] !== '' && is_array( $submenu ) ) {
			$page = sanitize_text_field( wp_unslash( $_GET['page'] ) );
			foreach ( $submenu as $items ) {
				if ( ! is_array( $items ) ) {
					continue;
				}
				foreach ( $items as $item ) {
					if ( ! is_array( $item ) || ! isset( $item[2] ) ) {
						continue;
					}
					if ( (string) $item[2] !== $page ) {
						continue;
					}
					$menu_title = isset( $item[0] ) ? (string) $item[0] : '';
					$menu_title = trim( wp_strip_all_tags( $menu_title ) );
					if ( $menu_title !== '' ) {
						return $menu_title;
					}
				}
			}
		}

		if ( $screen->post_type && is_string( $screen->post_type ) && $screen->post_type !== '' ) {
			$pto = get_post_type_object( $screen->post_type );
			if ( $pto && isset( $pto->labels->name ) && is_string( $pto->labels->name ) ) {
				$name = trim( $pto->labels->name );
				if ( $name !== '' ) {
					return $name;
				}
			}
		}

		$base = (string) $screen->base;
		$id   = (string) $screen->id;
		if ( $base === 'dashboard' || $id === 'dashboard' ) {
			return __( 'Dashboard', 'flux-one-command-bar' );
		}

		$hum = str_replace( [ '_', '-' ], ' ', $id );
		$hum = preg_replace( '/\s+/', ' ', $hum );
		if ( is_string( $hum ) && trim( $hum ) !== '' ) {
			return ucwords( trim( $hum ) );
		}

		return $id;
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
