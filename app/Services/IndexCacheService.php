<?php
/**
 * Index caching service.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Services;

/**
 * Provides lightweight indices for fast client-side autocomplete.
 *
 * @since 0.1.0
 */
class IndexCacheService {

	/**
	 * Plugins index cache key.
	 *
	 * @since 0.1.0
	 */
	private const TRANSIENT_PLUGINS = 'flux_one_index_plugins';

	/**
	 * Menus index cache key.
	 *
	 * @since 0.1.0
	 */
	private const TRANSIENT_MENUS = 'flux_one_index_menus';

	/**
	 * Multisite index cache key.
	 *
	 * @since 0.1.0
	 */
	private const TRANSIENT_SITES = 'flux_one_index_sites';

	/**
	 * Users index cache key.
	 *
	 * @since 0.1.0
	 */
	private const TRANSIENT_USERS = 'flux_one_index_users';

	/**
	 * Delete index transients.
	 *
	 * @since 0.1.0
	 * @param string|null $which Optional key.
	 * @return void
	 */
	public function clear( $which = null ) {
		$which = $which ? (string) $which : '';

		$map = [
			'plugins' => self::TRANSIENT_PLUGINS,
			'menus'   => self::TRANSIENT_MENUS,
			'sites'   => self::TRANSIENT_SITES,
			'users'   => self::TRANSIENT_USERS,
		];

		if ( isset( $map[ $which ] ) ) {
			delete_transient( $map[ $which ] );
			return;
		}

		foreach ( $map as $t ) {
			delete_transient( $t );
		}
	}

	/**
	 * Get plugins index.
	 *
	 * @since 0.1.0
	 * @return array
	 */
	public function get_plugins_index() {
		$cached = get_transient( self::TRANSIENT_PLUGINS );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		if ( ! function_exists( 'get_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		require_once ABSPATH . 'wp-admin/includes/update.php';

		$plugins = get_plugins();
		$active  = (array) get_option( 'active_plugins', [] );
		wp_update_plugins();
		$updates          = get_site_transient( 'update_plugins' );
		$updates_response = isset( $updates->response ) && is_array( $updates->response ) ? $updates->response : [];

		$index = [];
		foreach ( $plugins as $plugin_file => $meta ) {
			$index[] = [
				'pluginFile' => (string) $plugin_file,
				'name'       => (string) ( $meta['Name'] ?? $plugin_file ),
				'version'    => (string) ( $meta['Version'] ?? '' ),
				'active'     => in_array( $plugin_file, $active, true ),
				'updateAvailable' => isset( $updates_response[ $plugin_file ] ),
			];
		}

		set_transient( self::TRANSIENT_PLUGINS, $index, 60 );
		return $index;
	}

	/**
	 * Get roles index.
	 *
	 * @since 0.1.0
	 * @return array
	 */
	public function get_roles_index() {
		global $wp_roles;
		if ( ! $wp_roles ) {
			$wp_roles = new \WP_Roles();
		}

		$roles = [];
		foreach ( (array) $wp_roles->roles as $role_key => $role ) {
			$roles[] = [
				'role'  => (string) $role_key,
				'label' => (string) ( $role['name'] ?? $role_key ),
			];
		}

		return $roles;
	}

	/**
	 * Get nav menus index.
	 *
	 * @since 0.1.0
	 * @return array
	 */
	public function get_menus_index() {
		$cached = get_transient( self::TRANSIENT_MENUS );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		$menus = wp_get_nav_menus();
		$index = [];
		foreach ( $menus as $menu ) {
			$index[] = [
				'id'   => (int) $menu->term_id,
				'name' => (string) $menu->name,
				'slug' => (string) $menu->slug,
			];
		}

		set_transient( self::TRANSIENT_MENUS, $index, 60 );
		return $index;
	}

	/**
	 * Get multisite index.
	 *
	 * @since 0.1.0
	 * @return array
	 */
	public function get_multisite_index() {
		if ( ! is_multisite() ) {
			return [
				'enabled' => false,
				'sites'   => [],
			];
		}

		$cached = get_transient( self::TRANSIENT_SITES );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		$sites = get_sites(
			[
				'number' => 200,
			]
		);

		$index = [
			'enabled' => true,
			'sites'   => array_map(
				static function ( $site ) {
					return [
						'blogId' => (int) $site->blog_id,
						'domain' => (string) $site->domain,
						'path'   => (string) $site->path,
					];
				},
				$sites
			),
		];

		set_transient( self::TRANSIENT_SITES, $index, 60 );
		return $index;
	}

	/**
	 * Get users index (lightweight).
	 *
	 * @since 0.1.0
	 * @param int $limit Max users.
	 * @return array
	 */
	public function get_users_index( $limit = 200 ) {
		$cached = get_transient( self::TRANSIENT_USERS );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		if ( ! current_user_can( 'list_users' ) ) {
			return [];
		}

		$users = get_users(
			[
				'number'  => (int) $limit,
				'orderby' => 'ID',
				'order'   => 'DESC',
				'fields'  => [ 'ID', 'user_email', 'display_name', 'user_login' ],
			]
		);

		$index = array_map(
			static function ( $user ) {
				return [
					'id'          => (int) $user->ID,
					'email'       => (string) $user->user_email,
					'displayName' => (string) $user->display_name,
					'login'       => (string) $user->user_login,
				];
			},
			$users
		);

		set_transient( self::TRANSIENT_USERS, $index, 60 );
		return $index;
	}
}

