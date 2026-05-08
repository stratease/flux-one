<?php
/**
 * Command usage block for bootstrap and localized admin data.
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
 * Builds the `commandUsage` object for API and script bootstrap.
 *
 * @since 1.6.0
 */
final class BootstrapCommandUsagePayload {

	/**
	 * Shapes command usage for clients.
	 *
	 * @since 1.6.0
	 * @param UserCommandMemory $memory Per-user memory.
	 * @return array{counts: array<string, int>, estimatesSeconds: array<string, int>, totalSecondsSaved: int}
	 */
	public static function build( UserCommandMemory $memory ) {
		$counts = $memory->get_command_usage_counts();

		return [
			'counts'              => $counts,
			'estimatesSeconds'    => CommandUsageEstimates::seconds_per_root(),
			'totalSecondsSaved'   => CommandUsageEstimates::total_seconds_saved( $counts ),
		];
	}
}
