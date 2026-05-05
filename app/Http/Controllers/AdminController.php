<?php
/**
 * Admin controller.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Http\Controllers;

use FluxOne\App\Services\AdminBarHotkeyDisplay;
use FluxOne\App\Services\AdminDestinations;
use FluxOne\App\Services\AdminVisitRecorder;
use FluxOne\App\Services\CacheVersionService;
use FluxOne\App\Services\FluxOneSettings;
use FluxOne\App\Services\UserCommandMemory;
use FluxOne\FluxPlugins\Common\License\LicenseService;
use FluxOne\FluxPlugins\Common\Services\MenuService;

/**
 * Admin hooks for Flux One.
 *
 * @since 0.1.0
 */
class AdminController {

	/**
	 * Initialize admin hooks.
	 *
	 * @since 0.1.0
	 * @return void
	 */
	public function init() {
		add_action( 'init', [ $this, 'register_menu' ], 1 );
		add_action( 'init', [ $this, 'register_flux_suite_pages' ], 10 );
		AdminVisitRecorder::register();
		add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_admin_scripts' ] );
		add_action( 'admin_bar_menu', [ $this, 'register_admin_bar' ], 100 );
		add_action( 'admin_footer', [ $this, 'render_overlay_mount' ] );
		add_action( 'wp_dashboard_setup', [ $this, 'register_dashboard_widget' ] );
		add_action( 'wp_dashboard_setup', [ $this, 'maybe_apply_default_dashboard_widget_order' ], 999 );
	}

	/**
	 * Register shared Flux Suite License and Settings submenu pages (once per request).
	 *
	 * @since 0.1.0
	 * @return void
	 */
	public function register_flux_suite_pages() {
		if ( ! is_admin() ) {
			return;
		}

		$menu_service = MenuService::get_instance();
		$menu_service->register_license_page();
	}

	/**
	 * Register Flux Suite submenu page.
	 *
	 * @since 0.1.0
	 * @return void
	 */
	public function register_menu() {
		$menu_service = MenuService::get_instance();

		$menu_service->register_submenu_page(
			'flux-one',
			__( 'Flux One', 'flux-one' ),
			[ $this, 'render_settings_page' ],
			'manage_options',
			5
		);
	}

	/**
	 * Render plugin page (placeholder for v1).
	 *
	 * @since 0.1.0
	 * @since 1.2.1 Output `<span class="wp-header-end"></span>` before the React root so core admin notice placement stays above the app shell.
	 * @return void
	 */
	public function render_settings_page() {
		printf(
			'<div class="wrap flux-one-plugin-admin-wrap"><span class="wp-header-end"></span><div id="flux-one-plugin-app" class="flux-one-plugin-app" data-initial-hash="%s"></div></div>',
			esc_attr( '#/overview' )
		);
	}

	/**
	 * Enqueue global admin scripts for palette + widget.
	 *
	 * @since 0.1.0
	 * @param string $hook Hook suffix.
	 * @return void
	 */
	public function enqueue_admin_scripts( $hook ) {
		$handle = 'flux-one-admin';
		$script_url = $this->get_loader_script_url();

		wp_enqueue_script(
			$handle,
			$script_url,
			[ 'wp-api-fetch' ],
			FLUX_ONE_VERSION,
			true
		);

		if ( ! function_exists( 'get_editable_roles' ) ) {
			require_once ABSPATH . 'wp-admin/includes/user.php';
		}
		$editable_roles = function_exists( 'get_editable_roles' )
			? array_keys( get_editable_roles() )
			: [];

		$versions = ( new CacheVersionService() )->get_versions();
		$memory   = new UserCommandMemory();
		$license  = LicenseService::get_instance();
		$license_valid = (bool) $license->is_license_valid();

		$bootstrap = [
			'contractVersion' => 1,
			'editableRoles'   => array_values( array_map( 'strval', $editable_roles ) ),
			'features'        => [
				'plugins'        => [ 'enabled' => true ],
				'users'          => [ 'enabled' => true ],
				'menus'          => [ 'enabled' => true ],
				'multisite'       => [ 'enabled' => is_multisite() ],
				'aggregateEmail'  => [ 'enabled' => true ],
				'summaryEmail'    => [ 'enabled' => $license_valid ],
				'navigation'      => [ 'enabled' => true ],
				'suiteConfig'     => [ 'enabled' => true ],
			],
			'cacheVersions'   => $versions,
			'commandMemory'   => [
				'recentNavigations' => $memory->get_recent_navigations(),
			],
			'emailPrefs'      => [
				'emailCaptureEnabled' => FluxOneSettings::is_email_capture_enabled_for_user( get_current_user_id() ),
			],
			'uiPrefs'         => [
				'commandShortcut' => FluxOneSettings::get_command_shortcut_for_user( get_current_user_id() ),
			],
			'license'         => [
				'valid' => $license_valid,
			],
			'currentUser'     => [
				'id'    => (int) get_current_user_id(),
				'email' => (string) wp_get_current_user()->user_email,
			],
		];

		wp_localize_script(
			$handle,
			'fluxOneAdmin',
			[
				'apiUrl'    => rest_url(),
				'nonce'     => wp_create_nonce( 'wp_rest' ),
				'adminUrl'  => admin_url(),
				'pluginUrl' => plugin_dir_url( FLUX_ONE_PLUGIN_FILE ),
				'adminBundleUrl' => $this->get_admin_bundle_url(),
				'version'   => FLUX_ONE_VERSION,
				'features'  => [
					'emailAggregation' => [ 'enabled' => true ],
					'aiEmailSummary'   => [ 'enabled' => $license_valid ],
				],
				'bootstrap' => $bootstrap,
				'indices'   => [
					'destinations' => AdminDestinations::get_index_entries(),
				],
			]
		);

		$style_handle = 'flux-one-admin-bar';
		wp_register_style( $style_handle, false, [], FLUX_ONE_VERSION );
		wp_enqueue_style( $style_handle );
		wp_add_inline_style(
			$style_handle,
			'#wpadminbar #wp-admin-bar-flux-one-command .flux-one-admin-bar-hotkey{font-size:.85em;font-weight:400;opacity:.82;color:#c3c4c7}'
		);

		if ( $hook === 'flux-suite_page_flux-one' ) {
			$this->enqueue_plugin_app_scripts();
		}
	}

	/**
	 * Flux One submenu page: HashRouter app (Overview / Settings).
	 *
	 * @since 0.1.0
	 * @return void
	 */
	private function enqueue_plugin_app_scripts() {
		$handle     = 'flux-one-plugin-app';
		$script_url = $this->get_plugin_app_script_url();

		wp_enqueue_script(
			$handle,
			$script_url,
			[ 'wp-element', 'wp-api-fetch', 'flux-one-admin' ],
			FLUX_ONE_VERSION,
			true
		);
	}

	/**
	 * Built plugin admin app script URL.
	 *
	 * @since 0.1.0
	 * @return string
	 */
	private function get_plugin_app_script_url() {
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG && defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) {
			return 'http://localhost:3004/plugin-app.bundle.js';
		}
		return plugin_dir_url( FLUX_ONE_PLUGIN_FILE ) . 'assets/js/dist/plugin-app.bundle.js';
	}

	/**
	 * Get loader script URL (dev server or built file).
	 *
	 * @since 0.1.0
	 * @return string
	 */
	private function get_loader_script_url() {
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG && defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) {
			return 'http://localhost:3004/admin-loader.bundle.js';
		}
		return plugin_dir_url( FLUX_ONE_PLUGIN_FILE ) . 'assets/js/dist/admin-loader.bundle.js';
	}

	/**
	 * Main Command Bar admin bundle URL (dev server or built file).
	 *
	 * @since 0.1.0
	 * @return string
	 */
	private function get_admin_bundle_url() {
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG && defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) {
			return 'http://localhost:3004/admin.bundle.js';
		}
		return plugin_dir_url( FLUX_ONE_PLUGIN_FILE ) . 'assets/js/dist/admin.bundle.js';
	}

	/**
	 * Register admin bar Command trigger.
	 *
	 * @since 0.1.0
	 * @since 1.2.1 Ctrl-first hotkey label with styled span; client refines Cmd on Apple-like platforms.
	 * @param \WP_Admin_Bar $wp_admin_bar Admin bar.
	 * @return void
	 */
	public function register_admin_bar( $wp_admin_bar ) {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$stored = FluxOneSettings::get_command_shortcut_for_user( get_current_user_id() );
		$stored = is_string( $stored ) ? $stored : '';
		$normalized = AdminBarHotkeyDisplay::normalize_shortcut_raw( $stored );
		$hotkey_label = AdminBarHotkeyDisplay::inner_text_from_normalized_raw( $normalized );

		$paren        = '(' . $hotkey_label . ')';
		$allowed_html = [
			'span' => [
				'class' => true,
			],
		];
		$title_html = wp_kses(
			esc_html__( 'Flux One', 'flux-one' )
				. ' <span class="flux-one-admin-bar-hotkey"><span class="flux-one-admin-bar-hotkey-inner">'
				. esc_html( $paren )
				. '</span></span>',
			$allowed_html
		);

		$wp_admin_bar->add_node(
			[
				'id'    => 'flux-one-command',
				'title' => $title_html,
				'href'  => '#',
				'meta'  => [
					'title' => sprintf(
						/* translators: %s: Keyboard shortcut e.g. (Ctrl+.) */
						__( 'Open Flux One %s', 'flux-one' ),
						$paren
					),
				],
			]
		);
	}

	/**
	 * Render overlay mount container.
	 *
	 * @since 0.1.0
	 * @return void
	 */
	public function render_overlay_mount() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		echo '<div id="flux-one-command-central-root"></div>';
	}

	/**
	 * Register dashboard widget.
	 *
	 * @since 0.1.0
	 * @since 1.4.2 Dashboard widget title uses Command Bar branding.
	 * @return void
	 */
	public function register_dashboard_widget() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		wp_add_dashboard_widget(
			'flux_one_command_central_widget',
			esc_html__( 'Flux One — Command Bar', 'flux-one' ),
			[ $this, 'render_dashboard_widget' ]
		);
	}

	/**
	 * Render dashboard widget mount.
	 *
	 * @since 0.1.0
	 * @return void
	 */
	public function render_dashboard_widget() {
		echo '<div id="flux-one-dashboard-widget-root"></div>';
	}

	/**
	 * Once per user, prepend the Command Bar widget to the normal dashboard column when no layout is saved yet.
	 *
	 * @since 0.1.0
	 * @return void
	 */
	public function maybe_apply_default_dashboard_widget_order() {
		if ( ! is_admin() || ! current_user_can( 'manage_options' ) ) {
			return;
		}

		if ( ! function_exists( 'get_current_screen' ) ) {
			return;
		}

		$screen = get_current_screen();
		if ( ! $screen || 'dashboard' !== $screen->id ) {
			return;
		}

		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return;
		}

		$existing = get_user_option( 'meta-box-order_dashboard', $user_id );
		if ( ! empty( $existing ) ) {
			return;
		}

		if ( get_user_meta( $user_id, '_flux_one_dashboard_default_order_applied', true ) ) {
			return;
		}

		global $wp_meta_boxes;
		if ( empty( $wp_meta_boxes['dashboard'] ) || ! is_array( $wp_meta_boxes['dashboard'] ) ) {
			return;
		}

		$widget_id = 'flux_one_command_central_widget';
		$new_order = [];

		foreach ( [ 'normal', 'side', 'column3', 'column4' ] as $col ) {
			if ( empty( $wp_meta_boxes['dashboard'][ $col ]['core'] ) || ! is_array( $wp_meta_boxes['dashboard'][ $col ]['core'] ) ) {
				continue;
			}
			$ids = array_keys( $wp_meta_boxes['dashboard'][ $col ]['core'] );
			if ( 'normal' === $col && in_array( $widget_id, $ids, true ) ) {
				$ids = array_values( array_filter( $ids, static fn( $id ) => $id !== $widget_id ) );
				array_unshift( $ids, $widget_id );
			}
			$new_order[ $col ] = implode( ',', $ids );
		}

		if ( empty( $new_order ) ) {
			return;
		}

		update_user_option( $user_id, 'meta-box-order_dashboard', $new_order, true );
		update_user_meta( $user_id, '_flux_one_dashboard_default_order_applied', '1' );
	}
}

