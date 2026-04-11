<?php
/**
 * Command router.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Services;

use FluxOne\App\Services\CommandHandlers\PluginsHandler;
use FluxOne\App\Services\CommandHandlers\UsersHandler;
use FluxOne\App\Services\CommandHandlers\MultisiteHandler;

/**
 * Parses and routes commands to handlers.
 *
 * @since 0.1.0
 */
class CommandRouter {

	/**
	 * Handle a command input.
	 *
	 * @since 0.1.0
	 * @param string $input Raw input.
	 * @return array
	 */
	public function handle( $input ) {
		$normalized = $this->normalize_input( (string) $input );
		$tokens     = $normalized === '' ? [] : explode( ' ', $normalized );

		if ( empty( $tokens ) ) {
			return [
				'type'    => 'error',
				'command' => '',
				'message' => 'Empty command.',
			];
		}

		$mode = 'standard';
		if ( 'summary' === $tokens[0] ) {
			$mode   = 'summary';
			$tokens = array_slice( $tokens, 1 );
		}

		// Canonicalize common alias forms (store only canonical commands later in memory layer).
		$tokens = $this->canonicalize_tokens( $tokens );

		// Plugin management.
		if ( 'plugins' === ( $tokens[0] ?? '' ) ) {
			// Support `plugins update ...` as an alias for `plugin update ...`.
			if ( 'update' === ( $tokens[1] ?? '' ) ) {
				return ( new PluginsHandler() )->handle( array_slice( $tokens, 1 ) );
			}
			return ( new PluginsHandler() )->show_plugins_panel();
		}
		if ( 'plugin' === ( $tokens[0] ?? '' ) ) {
			return ( new PluginsHandler() )->handle( array_slice( $tokens, 1 ) );
		}

		// Users.
		if ( 'users' === ( $tokens[0] ?? '' ) ) {
			return ( new UsersHandler() )->show_users_panel();
		}
		if ( 'user' === ( $tokens[0] ?? '' ) ) {
			return ( new UsersHandler() )->handle( array_slice( $tokens, 1 ) );
		}
		if ( 'lock' === ( $tokens[0] ?? '' ) && 'user' === ( $tokens[1] ?? '' ) ) {
			return ( new UsersHandler() )->handle( [ 'lock', ...array_slice( $tokens, 2 ) ] );
		}
		if ( 'unlock' === ( $tokens[0] ?? '' ) && 'user' === ( $tokens[1] ?? '' ) ) {
			return ( new UsersHandler() )->handle( [ 'unlock', ...array_slice( $tokens, 2 ) ] );
		}

		// Multisite.
		if ( 'sites' === ( $tokens[0] ?? '' ) ) {
			return ( new MultisiteHandler() )->show_sites_panel();
		}
		if ( 'site' === ( $tokens[0] ?? '' ) ) {
			return ( new MultisiteHandler() )->handle( array_slice( $tokens, 1 ) );
		}

		// Aggregates.
		if ( 'aggregate' === ( $tokens[0] ?? '' ) && 'email' === ( $tokens[1] ?? '' ) ) {
			return [
				'type'    => 'panel',
				'panelId' => 'aggregate_email',
				'command' => 'aggregate email',
				'data'    => [
					'aiRequested' => false,
				],
			];
		}
		if ( 'aggregate' === ( $tokens[0] ?? '' ) && 'emails' === ( $tokens[1] ?? '' ) ) {
			return [
				'type'    => 'panel',
				'panelId' => 'aggregate_email',
				'command' => 'aggregate email',
				'data'    => [
					'aiRequested' => false,
				],
			];
		}
		if ( 'email' === ( $tokens[0] ?? '' ) && 'aggregate' === ( $tokens[1] ?? '' ) ) {
			return [
				'type'    => 'panel',
				'panelId' => 'aggregate_email',
				'command' => 'aggregate email',
				'data'    => [
					'aiRequested' => false,
				],
			];
		}
		if ( 'emails' === ( $tokens[0] ?? '' ) && 'aggregate' === ( $tokens[1] ?? '' ) ) {
			return [
				'type'    => 'panel',
				'panelId' => 'aggregate_email',
				'command' => 'aggregate email',
				'data'    => [
					'aiRequested' => false,
				],
			];
		}
		if ( 'email' === ( $tokens[0] ?? '' ) && 'summary' === $mode ) {
			return [
				'type'    => 'panel',
				'panelId' => 'aggregate_email',
				'command' => 'summary email',
				'data'    => [
					'aiRequested' => true,
				],
			];
		}
		if ( 'email' === ( $tokens[0] ?? '' ) && 'summary' === ( $tokens[1] ?? '' ) ) {
			// Support "email summary" as an alias for "summary email" input.
			return [
				'type'    => 'panel',
				'panelId' => 'aggregate_email',
				'command' => 'summary email',
				'data'    => [
					'aiRequested' => true,
				],
			];
		}

		return [
			'type'    => 'error',
			'command' => implode( ' ', $tokens ),
			'message' => 'Unknown command.',
		];
	}

	/**
	 * Normalize input (lowercase, trim, collapse spaces).
	 *
	 * @since 0.1.0
	 * @param string $input Input.
	 * @return string
	 */
	private function normalize_input( $input ) {
		$input = strtolower( trim( $input ) );
		$input = preg_replace( '/\s+/', ' ', $input );
		return (string) $input;
	}

	/**
	 * Canonicalize token sequences for common aliases.
	 *
	 * @since 0.1.0
	 * @param array $tokens Tokens.
	 * @return array
	 */
	private function canonicalize_tokens( $tokens ) {
		// "user lock {email}" => "lock user {email}".
		if ( 'user' === ( $tokens[0] ?? '' ) && 'lock' === ( $tokens[1] ?? '' ) ) {
			return [ 'lock', 'user', ...array_slice( $tokens, 2 ) ];
		}
		// "users lock {email}" => "lock user {email}".
		if ( 'users' === ( $tokens[0] ?? '' ) && 'lock' === ( $tokens[1] ?? '' ) ) {
			return [ 'lock', 'user', ...array_slice( $tokens, 2 ) ];
		}
		// "user unlock {email}" => "unlock user {email}".
		if ( 'user' === ( $tokens[0] ?? '' ) && 'unlock' === ( $tokens[1] ?? '' ) ) {
			return [ 'unlock', 'user', ...array_slice( $tokens, 2 ) ];
		}
		// "users unlock {email}" => "unlock user {email}".
		if ( 'users' === ( $tokens[0] ?? '' ) && 'unlock' === ( $tokens[1] ?? '' ) ) {
			return [ 'unlock', 'user', ...array_slice( $tokens, 2 ) ];
		}

		return $tokens;
	}
}

