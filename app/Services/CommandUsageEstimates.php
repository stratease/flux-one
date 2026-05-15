<?php
/**
 * Time-saved estimates per top-level command root (SSOT).
 *
 * @package FluxOne
 * @since 1.6.0
 */

namespace FluxOne\App\Services;

// @since 1.5.1 Guard against direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Seconds saved per root token compared to manual wp-admin navigation.
 *
 * @since 1.6.0
 */
final class CommandUsageEstimates {

	/**
	 * Balanced estimates (seconds per successful run).
	 *
	 * @since 1.6.0
	 * @since 1.6.3 Adds `pnav` (same estimate as `nav`).
	 * @var array<string, int>
	 */
	private const SECONDS_PER_ROOT = [
		'nav'       => 5,
		'pnav'      => 5,
		'edit'      => 8,
		'plugin'    => 15,
		'user'      => 20,
		'menu'      => 30,
		'config'    => 15,
		'aggregate' => 60,
		'summary'   => 90,
	];

	/**
	 * Allowed root tokens for usage counters.
	 *
	 * @since 1.6.0
	 * @return string[]
	 */
	public static function get_allowed_roots() {
		return array_keys( self::SECONDS_PER_ROOT );
	}

	/**
	 * Map root token to seconds saved per use.
	 *
	 * @since 1.6.0
	 * @return array<string, int>
	 */
	public static function seconds_per_root() {
		return self::SECONDS_PER_ROOT;
	}

	/**
	 * Total seconds saved from counts (unknown roots ignored).
	 *
	 * @since 1.6.0
	 * @param array<string, int> $counts Usage counts by root.
	 * @return int
	 */
	public static function total_seconds_saved( array $counts ) {
		$total = 0;
		foreach ( self::SECONDS_PER_ROOT as $root => $seconds ) {
			if ( ! isset( $counts[ $root ] ) ) {
				continue;
			}
			$n = self::sanitize_count( $counts[ $root ] );
			$total += $n * $seconds;
		}
		return $total;
	}

	/**
	 * Coerce a count to a non-negative integer.
	 *
	 * @since 1.6.0
	 * @param mixed $value Raw value.
	 * @return int
	 */
	public static function sanitize_count( $value ) {
		if ( is_string( $value ) && is_numeric( $value ) ) {
			$value = (int) $value;
		}
		if ( ! is_int( $value ) ) {
			return 0;
		}
		return max( 0, $value );
	}
}
