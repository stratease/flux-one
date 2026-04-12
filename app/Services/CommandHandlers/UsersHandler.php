<?php
/**
 * Users handler.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Services\CommandHandlers;

use FluxOne\App\Services\IndexCacheService;
use WP_User;

/**
 * Handles user-related commands.
 *
 * @since 0.1.0
 */
class UsersHandler {

	/**
	 * User meta key for lock state.
	 *
	 * @since 0.1.0
	 */
	private const LOCK_META_KEY = '_flux_one_user_locked';

	/**
	 * Handle user subcommands.
	 *
	 * Supported (v1): lock/unlock {email}, user role set {email} {role} (alias: role set …).
	 *
	 * @since 0.1.0
	 * @param array $tokens Tokens after "user" or canonicalized.
	 * @return array
	 */
	public function handle( $tokens ) {
		$tokens = array_values( (array) $tokens );

		$op = $tokens[0] ?? '';

		if ( in_array( $op, [ 'list', 'show' ], true ) ) {
			if ( ! current_user_can( 'list_users' ) ) {
				return [
					'type'    => 'error',
					'command' => 'user ' . $op,
					'message' => __( 'You do not have permission to list users.', 'flux-one' ),
				];
			}
			return [
				'type'    => 'panel',
				'panelId' => 'users',
				'command' => 'user ' . $op,
				'data'    => ( new IndexCacheService() )->get_users_index(),
			];
		}

		if ( 'lock' === $op ) {
			$email = (string) ( $tokens[1] ?? '' );
			return $this->lock_user( $email, true );
		}

		if ( 'unlock' === $op ) {
			$email = (string) ( $tokens[1] ?? '' );
			return $this->lock_user( $email, false );
		}

		if ( 'role' === $op && 'set' === ( $tokens[1] ?? '' ) ) {
			$email = (string) ( $tokens[2] ?? '' );
			$role  = (string) ( $tokens[3] ?? '' );
			return $this->set_role( $email, $role );
		}

		// Shortcut: "user {email}" opens a panel (v1 placeholder).
		if ( is_email( $op ) ) {
			return [
				'type'    => 'panel',
				'panelId' => 'user',
				'command' => 'user ' . $op,
				'data'    => [
					'email' => $op,
				],
			];
		}

		if ( '' === $op ) {
			return [
				'type'    => 'error',
				'command' => 'user',
				'message' => __( 'Try user list.', 'flux-one' ),
			];
		}

		return [
			'type'    => 'error',
			'command' => 'user ' . implode( ' ', $tokens ),
			'message' => __( 'Unknown user command. Try user list.', 'flux-one' ),
		];
	}

	/**
	 * Lock or unlock a user by email.
	 *
	 * @since 0.1.0
	 * @param string $email Email.
	 * @param bool   $locked Locked state.
	 * @return array
	 */
	private function lock_user( $email, $locked ) {
		if ( ! current_user_can( 'edit_users' ) ) {
			return [
				'type'    => 'error',
				'command' => $locked ? 'user lock' : 'user unlock',
				'message' => 'You do not have permission to manage users.',
			];
		}

		$user = get_user_by( 'email', $email );
		if ( ! ( $user instanceof WP_User ) ) {
			return [
				'type'    => 'error',
				'command' => ( $locked ? 'user lock ' : 'user unlock ' ) . $email,
				'message' => 'User not found.',
			];
		}

		update_user_meta( $user->ID, self::LOCK_META_KEY, $locked ? '1' : '0' );

		if ( function_exists( 'wp_destroy_sessions_for_user' ) ) {
			call_user_func( 'wp_destroy_sessions_for_user', $user->ID );
		}

		return [
			'type'    => 'action',
			'command' => ( $locked ? 'user lock ' : 'user unlock ' ) . $email,
			'status'  => 'success',
			'message' => $locked ? 'User locked.' : 'User unlocked.',
			'data'    => [
				'userId' => (int) $user->ID,
				'email'  => (string) $email,
				'locked' => (bool) $locked,
			],
		];
	}

	/**
	 * Set role for a user.
	 *
	 * @since 0.1.0
	 * @param string $email Email.
	 * @param string $role Role key.
	 * @return array
	 */
	private function set_role( $email, $role ) {
		if ( ! current_user_can( 'promote_users' ) ) {
			return [
				'type'    => 'error',
				'command' => 'user role set ' . $email . ' ' . $role,
				'message' => 'You do not have permission to change roles.',
			];
		}

		$user = get_user_by( 'email', $email );
		if ( ! ( $user instanceof WP_User ) ) {
			return [
				'type'    => 'error',
				'command' => 'user role set ' . $email . ' ' . $role,
				'message' => 'User not found.',
			];
		}

		$role = sanitize_key( $role );
		if ( '' === $role ) {
			return [
				'type'    => 'error',
				'command' => 'user role set ' . $email,
				'message' => 'Role is required.',
			];
		}

		$user->set_role( $role );

		return [
			'type'    => 'action',
			'command' => 'user role set ' . $email . ' ' . $role,
			'status'  => 'success',
			'message' => 'Role updated.',
			'data'    => [
				'userId' => (int) $user->ID,
				'email'  => (string) $email,
				'role'   => (string) $role,
			],
		];
	}

	/**
	 * Enforce user lock on authentication.
	 *
	 * @since 0.1.0
	 * @param WP_User|\WP_Error $user User object.
	 * @return WP_User|\WP_Error
	 */
	public static function enforce_lock_on_authentication( $user ) {
		if ( ! ( $user instanceof WP_User ) ) {
			return $user;
		}

		$locked = get_user_meta( $user->ID, self::LOCK_META_KEY, true );
		if ( '1' !== (string) $locked ) {
			return $user;
		}

		return new \WP_Error(
			'flux_one_user_locked',
			__( 'Your account has been locked by an administrator.', 'flux-one' )
		);
	}
}

