<?php
/**
 * Whitelisted wp-admin destinations for nav command and index API.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Services;

/**
 * Static registry of admin URLs (never pass arbitrary paths from clients).
 *
 * @since 0.1.0
 */
class AdminDestinations {

	/**
	 * Raw definitions: id, label, value (search slug), path (relative to admin), optional cap callback.
	 *
	 * @since 0.1.0
	 * @return array<int, array<string, mixed>>
	 */
	private static function raw_definitions() {
		$defs = [
			[
				'id'    => 'dashboard',
				'label' => 'Dashboard',
				'value' => 'dashboard',
				'path'  => 'index.php',
				'cap'   => static function () {
					return current_user_can( 'read' );
				},
			],
			[
				'id'    => 'plugins',
				'label' => 'Plugins',
				'value' => 'plugins',
				'path'  => 'plugins.php',
				'cap'   => static function () {
					return current_user_can( 'activate_plugins' );
				},
			],
			[
				'id'    => 'plugin_install',
				'label' => 'Add Plugin',
				'value' => 'plugin-install',
				'path'  => 'plugin-install.php',
				'cap'   => static function () {
					return current_user_can( 'install_plugins' );
				},
			],
			[
				'id'    => 'plugin_editor',
				'label' => 'Plugin File Editor',
				'value' => 'plugin-editor',
				'path'  => 'plugin-editor.php',
				'cap'   => static function () {
					return current_user_can( 'edit_plugins' ) && wp_is_file_mod_allowed( 'plugin' );
				},
			],
			[
				'id'    => 'updates',
				'label' => 'WordPress Updates',
				'value' => 'updates',
				'path'  => 'update-core.php',
				'cap'   => static function () {
					return current_user_can( 'update_core' );
				},
			],
			[
				'id'    => 'users',
				'label' => 'Users',
				'value' => 'users',
				'path'  => 'users.php',
				'cap'   => static function () {
					return current_user_can( 'list_users' );
				},
			],
			[
				'id'    => 'menus',
				'label' => 'Menus',
				'value' => 'menus',
				'path'  => 'nav-menus.php',
				'cap'   => static function () {
					return current_user_can( 'edit_theme_options' );
				},
			],
			[
				'id'    => 'settings',
				'label' => 'Settings',
				'value' => 'settings',
				'path'  => 'options-general.php',
				'cap'   => static function () {
					return current_user_can( 'manage_options' );
				},
			],
			[
				'id'    => 'themes',
				'label' => 'Themes',
				'value' => 'themes',
				'path'  => 'themes.php',
				'cap'   => static function () {
					return current_user_can( 'switch_themes' ) || current_user_can( 'edit_theme_options' );
				},
			],
			[
				'id'    => 'theme_editor',
				'label' => 'Theme File Editor',
				'value' => 'theme-editor',
				'path'  => 'theme-editor.php',
				'cap'   => static function () {
					return current_user_can( 'edit_themes' ) && wp_is_file_mod_allowed( 'theme' );
				},
			],
			[
				'id'    => 'media',
				'label' => 'Media Library',
				'value' => 'media',
				'path'  => 'upload.php',
				'cap'   => static function () {
					return current_user_can( 'upload_files' );
				},
			],
			[
				'id'    => 'posts',
				'label' => 'Posts',
				'value' => 'posts',
				'path'  => 'edit.php',
				'cap'   => static function () {
					return current_user_can( 'edit_posts' );
				},
			],
			[
				'id'    => 'pages',
				'label' => 'Pages',
				'value' => 'pages',
				'path'  => 'edit.php?post_type=page',
				'cap'   => static function () {
					return current_user_can( 'edit_pages' );
				},
			],
			[
				'id'    => 'comments',
				'label' => 'Comments',
				'value' => 'comments',
				'path'  => 'edit-comments.php',
				'cap'   => static function () {
					return current_user_can( 'moderate_comments' );
				},
			],
			[
				'id'    => 'tools',
				'label' => 'Tools',
				'value' => 'tools',
				'path'  => 'tools.php',
				'cap'   => static function () {
					return current_user_can( 'manage_options' );
				},
			],
		];

		return $defs;
	}

	/**
	 * Destinations for REST index, filtered by capability.
	 *
	 * Includes absolute `url` (admin_url) for same-origin navigation from Command Central without a command POST.
	 *
	 * @since 0.1.0
	 * @return array<int, array{id: string, label: string, value: string, url: string}>
	 */
	public static function get_index_entries() {
		$out = [];
		foreach ( self::raw_definitions() as $def ) {
			$cap = $def['cap'] ?? null;
			if ( is_callable( $cap ) && ! $cap() ) {
				continue;
			}
			$out[] = [
				'id'    => (string) $def['id'],
				'label' => (string) $def['label'],
				'value' => (string) $def['value'],
				'url'   => (string) admin_url( (string) $def['path'] ),
			];
		}
		return $out;
	}

	/**
	 * Resolve a fuzzy query to admin URL + label.
	 *
	 * @since 0.1.0
	 * @param string $query Normalized query (lowercase).
	 * @return array{ url: string, label: string }|null
	 */
	public static function resolve( $query ) {
		$query = strtolower( trim( (string) $query ) );
		if ( '' === $query ) {
			return null;
		}

		$candidates = [];
		foreach ( self::raw_definitions() as $def ) {
			$cap = $def['cap'] ?? null;
			if ( is_callable( $cap ) && ! $cap() ) {
				continue;
			}
			$id    = strtolower( (string) $def['id'] );
			$label = strtolower( (string) $def['label'] );
			$value = strtolower( (string) $def['value'] );
			$hay   = $id . ' ' . $label . ' ' . $value;
			if ( $query === $value || $query === $id ) {
				return [
					'url'   => admin_url( (string) $def['path'] ),
					'label' => (string) $def['label'],
				];
			}
			if ( false !== strpos( $hay, $query ) || false !== strpos( $query, $value ) ) {
				$candidates[] = $def;
			}
		}

		if ( empty( $candidates ) ) {
			return null;
		}

		// Prefer shortest value match (more specific slugs first when multiple substring hits).
		usort(
			$candidates,
			static function ( $a, $b ) {
				return strlen( (string) $a['value'] ) <=> strlen( (string) $b['value'] );
			}
		);

		$def = $candidates[0];
		return [
			'url'   => admin_url( (string) $def['path'] ),
			'label' => (string) $def['label'],
		];
	}
}
