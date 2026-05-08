<?php
/**
 * Multisite handler.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Services\CommandHandlers;

// @since 1.5.1 Guard against direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use FluxOne\App\Services\UserCommandMemory;

/**
 * Handles multisite commands.
 *
 * @since 0.1.0
 */
class MultisiteHandler {

	/**
	 * Handle site subcommands.
	 *
	 * Supported: switch {query}.
	 *
	 * @since 0.1.0
	 * @param array $tokens Tokens after "site".
	 * @return array
	 */
	public function handle( $tokens ) {
		$tokens = array_values( (array) $tokens );
		$op     = $tokens[0] ?? '';

		if ( in_array( $op, [ 'list', 'show' ], true ) ) {
			return $this->sites_list_panel( 'site ' . $op );
		}

		if ( 'switch' === $op ) {
			$query = trim( implode( ' ', array_slice( $tokens, 1 ) ) );
			return $this->switch_site( $query );
		}

		if ( '' === $op ) {
			return [
				'type'    => 'error',
				'command' => 'site',
				'message' => __( 'Try site list or site switch.', 'flux-one' ),
			];
		}

		return [
			'type'    => 'error',
			'command' => 'site ' . implode( ' ', $tokens ),
			'message' => __( 'Unknown multisite command. Try site list.', 'flux-one' ),
		];
	}

	/**
	 * Sites list panel payload.
	 *
	 * @since 0.1.0
	 * @param string $command Command label for response.
	 * @return array
	 */
	private function sites_list_panel( $command ) {
		if ( ! is_multisite() ) {
			return [
				'type'    => 'error',
				'command' => $command,
				'message' => __( 'Multisite is not enabled.', 'flux-one' ),
			];
		}

		if ( ! current_user_can( 'manage_sites' ) && ! current_user_can( 'manage_options' ) ) {
			return [
				'type'    => 'error',
				'command' => $command,
				'message' => __( 'You do not have permission to view sites.', 'flux-one' ),
			];
		}

		$sites = get_sites( [ 'number' => 200 ] );

		return [
			'type'    => 'panel',
			'panelId' => 'sites',
			'command' => $command,
			'data'    => array_map(
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
	}

	/**
	 * Switch site context and persist to user memory.
	 *
	 * @since 0.1.0
	 * @param string $query Query (domain, path, or blog id).
	 * @return array
	 */
	private function switch_site( $query ) {
		if ( ! is_multisite() ) {
			return [
				'type'    => 'error',
				'command' => 'site switch ' . $query,
				'message' => 'Multisite is not enabled.',
			];
		}

		if ( '' === trim( $query ) ) {
			return [
				'type'    => 'error',
				'command' => 'site switch',
				'message' => 'Site name is required.',
			];
		}

		$blog_id = null;
		if ( ctype_digit( $query ) ) {
			$blog_id = (int) $query;
		} else {
			$sites = get_sites( [ 'number' => 200 ] );
			foreach ( $sites as $site ) {
				$needle = strtolower( trim( $query ) );
				$hay    = strtolower( (string) $site->domain . (string) $site->path );
				if ( false !== strpos( $hay, $needle ) ) {
					$blog_id = (int) $site->blog_id;
					break;
				}
			}
		}

		if ( ! $blog_id ) {
			return [
				'type'    => 'error',
				'command' => 'site switch ' . $query,
				'message' => 'Site not found.',
			];
		}

		// Persist context for this user.
		$memory = new UserCommandMemory();
		$memory->set_last_site_context( $blog_id );

		return [
			'type'    => 'action',
			'command' => 'site switch ' . $query,
			'status'  => 'success',
			'message' => 'Site context updated.',
			'data'    => [
				'blogId' => (int) $blog_id,
			],
		];
	}
}

