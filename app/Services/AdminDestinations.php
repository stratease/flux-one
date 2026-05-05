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
	 * Per-user cache key for dynamic admin menu destinations.
	 *
	 * @since 0.1.0
	 * @var string
	 */
	private const USER_META_DYNAMIC_CACHE = '_flux_one_nav_destinations_cache';

	/**
	 * Global bump flag invalidates all per-user nav caches cheaply.
	 *
	 * @since 0.1.0
	 * @var string
	 */
	private const OPTION_NAV_CACHE_BUMP = '_flux_one_nav_dest_bump';

	/**
	 * Cache TTL in seconds.
	 *
	 * @since 0.1.0
	 * @var int
	 */
	private const DYNAMIC_CACHE_TTL = 3600;

	/**
	 * Active plugin signature used to bust stale nav caches after installs/updates.
	 *
	 * @since 0.1.0
	 * @return string
	 */
	private static function active_plugins_signature() {
		$active = (array) get_option( 'active_plugins', [] );
		$active = array_values( array_filter( array_map( 'strval', $active ) ) );
		sort( $active, SORT_STRING );

		$network = [];
		if ( is_multisite() ) {
			$network = (array) get_site_option( 'active_sitewide_plugins', [] );
			$network = array_values( array_filter( array_map( 'strval', array_keys( $network ) ) ) );
			sort( $network, SORT_STRING );
		}

		return md5( wp_json_encode( [ 'site' => $active, 'network' => $network ] ) );
	}

	/**
	 * Normalize admin URL for dedupe while keeping distinct admin.php?page=… entries.
	 *
	 * @since 0.1.0
	 * @param string $url URL.
	 * @return string
	 */
	private static function normalize_admin_url_key( $url ) {
		$url = (string) $url;
		$parts = wp_parse_url( $url );
		if ( ! is_array( $parts ) ) {
			return md5( $url );
		}

		$path = isset( $parts['path'] ) ? (string) $parts['path'] : '';
		$query = [];
		if ( isset( $parts['query'] ) && is_string( $parts['query'] ) && $parts['query'] !== '' ) {
			parse_str( $parts['query'], $query );
		}

		// Only keep params that commonly distinguish admin screens.
		$keep = [];
		foreach ( [ 'page', 'tab', 'post_type', 'taxonomy' ] as $k ) {
			if ( isset( $query[ $k ] ) && $query[ $k ] !== '' ) {
				$keep[ $k ] = (string) $query[ $k ];
			}
		}
		ksort( $keep );

		$key = $path;
		if ( [] !== $keep ) {
			$key .= '?' . http_build_query( $keep, '', '&', PHP_QUERY_RFC3986 );
		}

		return $key;
	}

	/**
	 * Build extra search text for nav autocomplete (slug tokens, post types, etc.).
	 *
	 * @since 0.1.0
	 * @param string $label Label.
	 * @param string $slug  Menu slug.
	 * @param string $url   Resolved admin URL.
	 * @return string
	 */
	private static function build_destination_search_text( $label, $slug, $url ) {
		$bits = [];

		$label = trim( wp_strip_all_tags( (string) $label ) );
		$slug  = trim( (string) $slug );
		$url   = (string) $url;

		if ( $label !== '' ) {
			$bits[] = $label;
		}
		if ( $slug !== '' ) {
			$bits[] = $slug;
			$bits[] = str_replace( [ '_', '/' ], ' ', $slug );
			$bits[] = str_replace( [ '_', '-' ], ' ', $slug );
		}

		$parts = wp_parse_url( $url );
		if ( is_array( $parts ) && isset( $parts['query'] ) && is_string( $parts['query'] ) && $parts['query'] !== '' ) {
			$q = [];
			parse_str( $parts['query'], $q );
			foreach ( [ 'page', 'post_type', 'taxonomy', 'tab' ] as $k ) {
				if ( isset( $q[ $k ] ) && $q[ $k ] !== '' ) {
					$v = (string) $q[ $k ];
					$bits[] = $v;
					$bits[] = str_replace( [ '_', '-' ], ' ', $v );
				}
			}
		}

		$hay = strtolower( implode( ' ', array_filter( array_map( 'strval', $bits ) ) ) );
		$hay = preg_replace( '/\s+/', ' ', $hay );
		return trim( (string) $hay );
	}

	/**
	 * Register hooks to keep destinations fresh.
	 *
	 * We cannot build a full plugin menu index during REST requests reliably,
	 * because `admin_menu` may not have run. Instead, build and persist a
	 * capability-filtered list during normal wp-admin loads.
	 *
	 * @since 0.1.0
	 * @return void
	 */
	public static function register() {
		add_action( 'admin_menu', [ self::class, 'maybe_refresh_dynamic_cache' ], 999 );
		add_action( 'network_admin_menu', [ self::class, 'maybe_refresh_dynamic_cache' ], 999 );

		// Bust per-user caches when plugin activation changes admin menus.
		add_action( 'activated_plugin', [ self::class, 'bust_all_users_dynamic_cache' ], 10, 0 );
		add_action( 'deactivated_plugin', [ self::class, 'bust_all_users_dynamic_cache' ], 10, 0 );
		add_action( 'upgrader_process_complete', [ self::class, 'bust_all_users_dynamic_cache' ], 10, 0 );
	}

	/**
	 * Invalidate all per-user nav caches (plugin graph changed).
	 *
	 * @since 0.1.0
	 * @return void
	 */
	public static function bust_all_users_dynamic_cache() {
		update_option( self::OPTION_NAV_CACHE_BUMP, time(), false );
	}

	/**
	 * Refresh the dynamic admin destinations cache when stale.
	 *
	 * @since 0.1.0
	 * @return void
	 */
	public static function maybe_refresh_dynamic_cache() {
		$user_id = get_current_user_id();
		if ( $user_id <= 0 ) {
			return;
		}

		$sig = self::active_plugins_signature();
		$bump = (int) get_option( self::OPTION_NAV_CACHE_BUMP, 0 );

		$cached = get_user_meta( $user_id, self::USER_META_DYNAMIC_CACHE, true );
		if ( is_array( $cached ) && isset( $cached['updatedAt'] ) && is_numeric( $cached['updatedAt'] ) ) {
			$cached_sig = isset( $cached['pluginsSig'] ) ? (string) $cached['pluginsSig'] : '';
			$cached_bump = isset( $cached['bump'] ) ? (int) $cached['bump'] : 0;
			if ( $cached_sig !== '' && $cached_sig !== $sig ) {
				// Plugin list changed; rebuild immediately.
			} elseif ( $cached_bump !== $bump ) {
				// Global invalidation (activate/deactivate/upgrade).
			} else {
				$age = time() - (int) $cached['updatedAt'];
				if ( $age >= 0 && $age < self::DYNAMIC_CACHE_TTL ) {
					return;
				}
			}
		}

		$entries = self::build_dynamic_menu_entries();
		update_user_meta(
			$user_id,
			self::USER_META_DYNAMIC_CACHE,
			[
				'updatedAt'  => time(),
				'pluginsSig' => $sig,
				'bump'       => $bump,
				'entries'    => $entries,
			]
		);
	}

	/**
	 * Build dynamic menu/submenu destinations from globals $menu / $submenu.
	 *
	 * @since 0.1.0
	 * @return array<int, array{id: string, label: string, value: string, url: string, searchText: string}>
	 */
	private static function build_dynamic_menu_entries() {
		global $menu, $submenu;

		if ( ! is_array( $menu ) ) {
			$menu = [];
		}
		if ( ! is_array( $submenu ) ) {
			$submenu = [];
		}

		$admin_base = admin_url();
		$out        = [];
		$seen_value = [];
		$seen_url   = [];

		$add_entry = function ( $id, $label, $value, $url, $slug_for_search, $path_labels = [], $parent_id = '' ) use ( &$out, &$seen_value, &$seen_url, $admin_base ) {
			$label = trim( wp_strip_all_tags( (string) $label ) );
			if ( '' === $label ) {
				return;
			}
			$url = (string) $url;
			if ( '' === $url || 0 !== strpos( $url, $admin_base ) ) {
				return;
			}

			$url_key = self::normalize_admin_url_key( $url );
			if ( isset( $seen_url[ $url_key ] ) ) {
				return;
			}
			$seen_url[ $url_key ] = true;

			$value = strtolower( preg_replace( '/\s+/', ' ', (string) $value ) );
			$value = trim( preg_replace( '/[^a-z0-9 _\\-]/', '', $value ) );
			$value = preg_replace( '/\\s+/', ' ', $value );
			$value = str_replace( ' ', '-', $value );
			$value = trim( preg_replace( '/\\-+/', '-', $value ), '-' );
			if ( '' === $value ) {
				$value = 'page';
			}

			if ( isset( $seen_value[ $value ] ) ) {
				$suffix = substr( md5( $url ), 0, 6 );
				$value  = $value . '-' . $suffix;
			}
			$seen_value[ $value ] = true;

			$search_text = self::build_destination_search_text( $label, (string) $slug_for_search, $url );

			$row = [
				'id'         => (string) $id,
				'label'      => $label,
				'value'      => $value,
				'url'        => $url,
				'searchText' => $search_text,
			];
			$pls = array_values(
				array_filter(
					array_map( 'strval', is_array( $path_labels ) ? $path_labels : [] ),
					static function ( $v ) {
						return '' !== trim( (string) $v );
					}
				)
			);
			if ( [] !== $pls ) {
				$row['pathLabels'] = $pls;
			}
			if ( is_string( $parent_id ) && '' !== trim( $parent_id ) ) {
				$row['parentId'] = trim( $parent_id );
			}

			$out[] = $row;
		};

		foreach ( $menu as $top ) {
			if ( ! is_array( $top ) || ! isset( $top[2] ) ) {
				continue;
			}
			$cap = $top[1] ?? null;
			if ( $cap && ! current_user_can( $cap ) ) {
				continue;
			}

			$slug  = (string) $top[2];
			$label = (string) ( $top[0] ?? '' );

			$url = '';
			if ( $slug !== '' ) {
				// For plugin pages, menu_page_url() resolves admin.php?page=... correctly.
				if ( function_exists( 'menu_page_url' ) ) {
					$maybe = menu_page_url( $slug, false );
					if ( is_string( $maybe ) && '' !== $maybe ) {
						$url = $maybe;
					}
				}
				if ( '' === $url ) {
					$url = admin_url( $slug );
				}
			}

			$top_id = 'dyn.' . $slug;
			if ( '' !== $url ) {
				$add_entry( $top_id, $label, $label . ' ' . $slug, $url, $slug, [ $label ] );
			}

			if ( isset( $submenu[ $slug ] ) && is_array( $submenu[ $slug ] ) ) {
				foreach ( $submenu[ $slug ] as $sub ) {
					if ( ! is_array( $sub ) || ! isset( $sub[2] ) ) {
						continue;
					}
					$subcap = $sub[1] ?? null;
					if ( $subcap && ! current_user_can( $subcap ) ) {
						continue;
					}
					$sub_slug  = (string) $sub[2];
					$sub_label = (string) ( $sub[0] ?? '' );

					$sub_url = '';
					if ( function_exists( 'menu_page_url' ) ) {
						$maybe = menu_page_url( $sub_slug, false );
						if ( is_string( $maybe ) && '' !== $maybe ) {
							$sub_url = $maybe;
						}
					}
					if ( '' === $sub_url ) {
						$sub_url = admin_url( $sub_slug );
					}

					if ( '' !== $sub_url ) {
						$add_entry(
							'dyn.' . $slug . '.' . $sub_slug,
							$sub_label,
							$sub_label . ' ' . $sub_slug . ' ' . $slug,
							$sub_url,
							$sub_slug,
							[ $label, $sub_label ],
							$top_id
						);
					}
				}
			}
		}

		return $out;
	}

	/**
	 * Get cached dynamic entries for current user.
	 *
	 * @since 0.1.0
	 * @return array<int, array{id: string, label: string, value: string, url: string}>
	 */
	private static function get_dynamic_cached_entries() {
		$user_id = get_current_user_id();
		if ( $user_id <= 0 ) {
			return [];
		}
		$cached = get_user_meta( $user_id, self::USER_META_DYNAMIC_CACHE, true );
		if ( ! is_array( $cached ) || ! isset( $cached['entries'] ) || ! is_array( $cached['entries'] ) ) {
			return [];
		}
		return array_values(
			array_filter(
				(array) $cached['entries'],
				static function ( $row ) {
					return is_array( $row ) && isset( $row['id'], $row['label'], $row['value'], $row['url'] );
				}
			)
		);
	}

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
	 * Includes absolute `url` (admin_url) for same-origin navigation from Command Bar without a command POST.
	 *
	 * @since 0.1.0
	 * @return array<int, array{id: string, label: string, value: string, url: string, searchText: string}>
	 */
	public static function get_index_entries() {
		$out = [];
		$seen_url = [];

		foreach ( self::raw_definitions() as $def ) {
			$cap = $def['cap'] ?? null;
			if ( is_callable( $cap ) && ! $cap() ) {
				continue;
			}
			$url = (string) admin_url( (string) $def['path'] );
			$key = self::normalize_admin_url_key( $url );
			if ( '' === $key || isset( $seen_url[ $key ] ) ) {
				continue;
			}
			$seen_url[ $key ] = true;
			$search_text = self::build_destination_search_text( (string) $def['label'], (string) $def['value'], $url );
			$out[] = [
				'id'         => (string) $def['id'],
				'label'      => (string) $def['label'],
				'value'      => (string) $def['value'],
				'url'        => $url,
				'searchText' => $search_text,
				'pathLabels' => [ (string) $def['label'] ],
			];
		}

		foreach ( self::get_dynamic_cached_entries() as $row ) {
			$url = (string) ( $row['url'] ?? '' );
			$key = self::normalize_admin_url_key( $url );
			if ( '' === $key || isset( $seen_url[ $key ] ) ) {
				continue;
			}
			$seen_url[ $key ] = true;
			$label = (string) $row['label'];
			$value = (string) $row['value'];
			$search_text = isset( $row['searchText'] ) ? (string) $row['searchText'] : '';
			if ( '' === trim( $search_text ) ) {
				$search_text = self::build_destination_search_text( $label, $value, $url );
			}
			$entry = [
				'id'         => (string) $row['id'],
				'label'      => $label,
				'value'      => $value,
				'url'        => $url,
				'searchText' => $search_text,
			];
			if ( isset( $row['pathLabels'] ) && is_array( $row['pathLabels'] ) ) {
				$pls = array_values(
					array_filter(
						array_map( 'strval', (array) $row['pathLabels'] ),
						static function ( $v ) {
							return '' !== trim( (string) $v );
						}
					)
				);
				if ( [] !== $pls ) {
					$entry['pathLabels'] = $pls;
				}
			}
			if ( isset( $row['parentId'] ) && is_string( $row['parentId'] ) && '' !== trim( $row['parentId'] ) ) {
				$entry['parentId'] = trim( (string) $row['parentId'] );
			}

			if ( ! isset( $entry['pathLabels'] ) ) {
				$entry['pathLabels'] = [ $label ];
			}

			$out[] = $entry;
		}

		/**
		 * Filter admin destinations used for nav autocomplete.
		 *
		 * @since 0.1.0
		 * @param array<int, array{id: string, label: string, value: string, url: string, searchText: string}> $out Entries.
		 */
		$out = apply_filters( 'flux_one_admin_destinations_entries', $out );

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
		foreach ( self::get_index_entries() as $row ) {
			$id    = strtolower( (string) ( $row['id'] ?? '' ) );
			$label = strtolower( (string) ( $row['label'] ?? '' ) );
			$value = strtolower( (string) ( $row['value'] ?? '' ) );
			$search = strtolower( (string) ( $row['searchText'] ?? '' ) );
			$hay   = $id . ' ' . $label . ' ' . $value . ' ' . $search;
			if ( $query === $value || $query === $id ) {
				return [
					'url'   => (string) ( $row['url'] ?? '' ),
					'label' => (string) ( $row['label'] ?? '' ),
				];
			}
			if ( false !== strpos( $hay, $query ) || ( $value !== '' && false !== strpos( $query, $value ) ) ) {
				$candidates[] = $row;
			}
		}

		if ( empty( $candidates ) ) {
			return null;
		}

		// Prefer shortest value match (more specific slugs first when multiple substring hits).
		usort(
			$candidates,
			static function ( $a, $b ) {
				return strlen( (string) ( $a['value'] ?? '' ) ) <=> strlen( (string) ( $b['value'] ?? '' ) );
			}
		);

		$def = $candidates[0];
		return [
			'url'   => (string) ( $def['url'] ?? '' ),
			'label' => (string) ( $def['label'] ?? '' ),
		];
	}
}
