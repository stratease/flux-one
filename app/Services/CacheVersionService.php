<?php
/**
 * Cache version service.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Services;

/**
 * Provides version tokens for client/server cache invalidation.
 *
 * @since 0.1.0
 */
class CacheVersionService {

	/**
	 * Option name storing versions.
	 *
	 * @since 0.1.0
	 */
	private const OPTION = 'flux_one_cache_versions';

	/**
	 * Get version map.
	 *
	 * @since 0.1.0
	 * @return array<string,int>
	 */
	public function get_versions() {
		$raw = get_option( self::OPTION, [] );
		$versions = is_array( $raw ) ? $raw : [];

		return wp_parse_args(
			$versions,
			[
				'plugins'      => 1,
				'users'        => 1,
				'menus'        => 1,
				'sites'        => 1,
				'destinations' => 1,
			]
		);
	}

	/**
	 * Bump a version token.
	 *
	 * @since 0.1.0
	 * @param string $key Key.
	 * @return void
	 */
	public function bump( $key ) {
		$key = (string) $key;
		$versions = $this->get_versions();
		$versions[ $key ] = (int) ( $versions[ $key ] ?? 1 ) + 1;
		update_option( self::OPTION, $versions );
	}
}

