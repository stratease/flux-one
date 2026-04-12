<?php
/**
 * Nav command: redirect to whitelisted wp-admin screens.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Services\CommandHandlers;

use FluxOne\App\Services\AdminDestinations;

/**
 * Handles `nav {query}` (aliases `go`, `open` normalized in router).
 *
 * @since 0.1.0
 */
class NavigationHandler {

	/**
	 * Tokens after the `nav` verb.
	 *
	 * @since 0.1.0
	 * @param array $tokens Tokens.
	 * @return array
	 */
	public function handle( $tokens ) {
		$tokens = array_values( (array) $tokens );
		$query  = trim( implode( ' ', $tokens ) );

		if ( '' === $query ) {
			return [
				'type'    => 'error',
				'command' => 'nav',
				'message' => __( 'Try e.g. nav plugins or nav dashboard.', 'flux-one' ),
			];
		}

		$resolved = AdminDestinations::resolve( strtolower( $query ) );
		if ( ! $resolved ) {
			return [
				'type'    => 'error',
				'command' => 'nav ' . $query,
				'message' => __( 'No matching admin screen.', 'flux-one' ),
			];
		}

		return [
			'type'    => 'navigation',
			'command' => 'nav ' . $query,
			'data'    => [
				'url'   => (string) $resolved['url'],
				'label' => (string) $resolved['label'],
			],
		];
	}
}
