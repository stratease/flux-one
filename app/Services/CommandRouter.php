<?php
/**
 * Command router.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Services;

use FluxOne\App\Services\CommandHandlers\ConfigHandler;
use FluxOne\App\Services\CommandHandlers\MenusHandler;
use FluxOne\App\Services\CommandHandlers\NavigationHandler;
use FluxOne\App\Services\CommandHandlers\PluginsHandler;
use FluxOne\App\Services\CommandHandlers\UsersHandler;

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
		$trim = trim( (string) $input );
		if ( preg_match( '/^config(\s|$)/i', $trim ) ) {
			return ( new ConfigHandler() )->handle_raw( $trim );
		}

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

		// Quick nav (canonical `nav`; `go` / `open` normalized in canonicalize_tokens).
		if ( 'nav' === ( $tokens[0] ?? '' ) ) {
			return ( new NavigationHandler() )->handle( array_slice( $tokens, 1 ) );
		}

		// Menus.
		if ( 'menu' === ( $tokens[0] ?? '' ) ) {
			return ( new MenusHandler() )->handle( array_slice( $tokens, 1 ) );
		}

		// Plugin management (`plugins` → `plugin` in canonicalize_tokens).
		if ( 'plugin' === ( $tokens[0] ?? '' ) ) {
			return ( new PluginsHandler() )->handle( array_slice( $tokens, 1 ) );
		}

		// Users (`users` → `user` except `users lock|unlock` rewritten earlier).
		if ( 'user' === ( $tokens[0] ?? '' ) ) {
			return ( new UsersHandler() )->handle( array_slice( $tokens, 1 ) );
		}

		// Multisite (`sites` → `site` in canonicalize_tokens).
		if ( 'site' === ( $tokens[0] ?? '' ) ) {
			// @since 1.4.3 Site commands temporarily disabled.
			return [
				'type'    => 'error',
				'command' => implode( ' ', $tokens ),
				/* translators: 1: Example command. */
				'message' => sprintf( __( 'Site commands are currently disabled. Planned feature: %s', 'flux-one' ), 'site list' ),
			];
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
	 * @since 1.4.0 Maps `menu show` to `menu list`.
	 * @param array $tokens Tokens.
	 * @return array
	 */
	private function canonicalize_tokens( $tokens ) {
		// "role set …" => "user role set …" (canonical; matches UsersHandler).
		if ( 'role' === ( $tokens[0] ?? '' ) && 'set' === ( $tokens[1] ?? '' ) ) {
			return array_merge( [ 'user', 'role', 'set' ], array_slice( $tokens, 2 ) );
		}

		// "lock user {email}" => "user lock {email}" (canonical).
		if ( 'lock' === ( $tokens[0] ?? '' ) && 'user' === ( $tokens[1] ?? '' ) ) {
			return [ 'user', 'lock', ...array_slice( $tokens, 2 ) ];
		}
		// "unlock user {email}" => "user unlock {email}".
		if ( 'unlock' === ( $tokens[0] ?? '' ) && 'user' === ( $tokens[1] ?? '' ) ) {
			return [ 'user', 'unlock', ...array_slice( $tokens, 2 ) ];
		}
		// "users lock" / "users unlock" before plural → singular.
		if ( 'users' === ( $tokens[0] ?? '' ) && 'lock' === ( $tokens[1] ?? '' ) ) {
			return [ 'user', 'lock', ...array_slice( $tokens, 2 ) ];
		}
		if ( 'users' === ( $tokens[0] ?? '' ) && 'unlock' === ( $tokens[1] ?? '' ) ) {
			return [ 'user', 'unlock', ...array_slice( $tokens, 2 ) ];
		}

		// Nav verb aliases.
		if ( 'go' === ( $tokens[0] ?? '' ) || 'open' === ( $tokens[0] ?? '' ) ) {
			$tokens[0] = 'nav';
		}

		// plugin upload/install => nav add plugin (navigation command).
		if ( 'plugin' === ( $tokens[0] ?? '' ) && in_array( (string) ( $tokens[1] ?? '' ), [ 'upload', 'install' ], true ) ) {
			return [ 'nav', 'add', 'plugin' ];
		}

		// Plural → singular first tokens (after users lock|unlock rewrites above).
		if ( 'plugins' === ( $tokens[0] ?? '' ) ) {
			$tokens[0] = 'plugin';
		}
		if ( 'users' === ( $tokens[0] ?? '' ) ) {
			$tokens[0] = 'user';
		}
		if ( 'sites' === ( $tokens[0] ?? '' ) ) {
			$tokens[0] = 'site';
		}

		// "menu show" => "menu list" (alias; matches client normalize.ts).
		if ( 'menu' === ( $tokens[0] ?? '' ) && 'show' === ( $tokens[1] ?? '' ) ) {
			$tokens[1] = 'list';
		}

		return $tokens;
	}
}

