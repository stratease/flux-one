<?php
/**
 * Index builders for REST and Command Bar (no server-side HTTP response cache).
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
 * Builds lightweight indices for client-side autocomplete. Each call recomputes;
 * TanStack Query caches on the client.
 *
 * @since 0.1.0
 */
class IndexCacheService {

	/**
	 * Get plugins index.
	 *
	 * @since 0.1.0
	 * @return array
	 */
	public function get_plugins_index() {
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
				'pluginFile'      => (string) $plugin_file,
				'name'            => (string) ( $meta['Name'] ?? $plugin_file ),
				'version'         => (string) ( $meta['Version'] ?? '' ),
				'active'          => in_array( $plugin_file, $active, true ),
				'updateAvailable' => isset( $updates_response[ $plugin_file ] ),
			];
		}

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
		$menus = wp_get_nav_menus();
		$index = [];
		foreach ( $menus as $menu ) {
			$index[] = [
				'id'   => (int) $menu->term_id,
				'name' => (string) $menu->name,
				'slug' => (string) $menu->slug,
			];
		}

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

		return array_map(
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
	}
}
