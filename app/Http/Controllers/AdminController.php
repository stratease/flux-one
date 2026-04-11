<?php
/**
 * Admin controller.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Http\Controllers;

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
		add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_admin_scripts' ] );
		add_action( 'admin_bar_menu', [ $this, 'register_admin_bar' ], 100 );
		add_action( 'admin_footer', [ $this, 'render_overlay_mount' ] );
		add_action( 'wp_dashboard_setup', [ $this, 'register_dashboard_widget' ] );
	}

	/**
	 * Register Flux Suite submenu page.
	 *
	 * @since 0.1.0
	 * @return void
	 */
	public function register_menu() {
		$menu_service_class = '\FluxOne\FluxPlugins\Common\Services\MenuService';
		if ( ! class_exists( $menu_service_class ) ) {
			return;
		}

		$menu_service = call_user_func( [ $menu_service_class, 'get_instance' ] );
		if ( ! is_object( $menu_service ) || ! method_exists( $menu_service, 'register_submenu_page' ) ) {
			return;
		}

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
	 * @return void
	 */
	public function render_settings_page() {
		echo '<div class="wrap"><h1>' . esc_html__( 'Flux One', 'flux-one' ) . '</h1></div>';
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
		$script_url = $this->get_script_url();

		wp_enqueue_script(
			$handle,
			$script_url,
			[ 'wp-api-fetch' ],
			FLUX_ONE_VERSION,
			true
		);

		wp_localize_script(
			$handle,
			'fluxOneAdmin',
			[
				'apiUrl'    => rest_url(),
				'nonce'     => wp_create_nonce( 'wp_rest' ),
				'adminUrl'  => admin_url(),
				'pluginUrl' => plugin_dir_url( FLUX_ONE_PLUGIN_FILE ),
				'version'   => FLUX_ONE_VERSION,
				'features'  => [
					'emailAggregation' => [ 'enabled' => true ],
					'aiEmailSummary'   => [ 'enabled' => true ],
				],
			]
		);
	}

	/**
	 * Get script URL (dev server or built file).
	 *
	 * @since 0.1.0
	 * @return string
	 */
	private function get_script_url() {
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG && defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) {
			return 'http://localhost:3004/admin.bundle.js';
		}
		return plugin_dir_url( FLUX_ONE_PLUGIN_FILE ) . 'assets/js/dist/admin.bundle.js';
	}

	/**
	 * Register admin bar Command trigger.
	 *
	 * @since 0.1.0
	 * @param \WP_Admin_Bar $wp_admin_bar Admin bar.
	 * @return void
	 */
	public function register_admin_bar( $wp_admin_bar ) {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$wp_admin_bar->add_node(
			[
				'id'    => 'flux-one-command',
				'title' => esc_html__( 'Command', 'flux-one' ),
				'href'  => '#',
				'meta'  => [
					'title' => esc_html__( 'Open command palette (Ctrl/Cmd+K)', 'flux-one' ),
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
	 * @return void
	 */
	public function register_dashboard_widget() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		wp_add_dashboard_widget(
			'flux_one_command_central_widget',
			esc_html__( 'Flux One — Command Central', 'flux-one' ),
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
}

