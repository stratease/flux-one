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
	 * Supported: list/show, lock/unlock {email}, user add {login} {email} {role}, user role set {email} {role} (alias: role set …).
	 *
	 * @since 0.1.0
	 * @since 1.4.0 Removed `user {email}` placeholder panel; use `user list` or lock/unlock flows.
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

		if ( 'add' === $op ) {
			$login = (string) ( $tokens[1] ?? '' );
			$email = (string) ( $tokens[2] ?? '' );
			$role  = (string) ( $tokens[3] ?? '' );
			return $this->add_user( $login, $email, $role );
		}

		if ( 'role' === $op && 'set' === ( $tokens[1] ?? '' ) ) {
			$email = (string) ( $tokens[2] ?? '' );
			$role  = (string) ( $tokens[3] ?? '' );
			return $this->set_role( $email, $role );
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
	 * @since 1.4.0 Refuses to lock the account of the user running the command.
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

		if ( $locked && (int) $user->ID === (int) get_current_user_id() ) {
			return [
				'type'        => 'error',
				'command'     => 'user lock ' . $email,
				'message'     => __( 'You cannot lock your own account.', 'flux-one' ),
				'error_code'  => 'flux_one_user_lock_self',
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
	 * Create a user (username, email, role). Password is generated and new-user emails are sent when WP supports it.
	 *
	 * @since 0.1.0
	 * @param string $login User login.
	 * @param string $email Email.
	 * @param string $role  Role slug (must be editable by current user).
	 * @return array
	 */
	private function add_user( $login, $email, $role ) {
		if ( ! current_user_can( 'create_users' ) ) {
			return [
				'type'    => 'error',
				'command' => 'user add',
				'message' => __( 'You do not have permission to create users.', 'flux-one' ),
			];
		}

		$login = sanitize_user( $login, true );
		if ( '' === $login ) {
			return [
				'type'    => 'error',
				'command' => 'user add',
				'message' => __( 'A valid username is required.', 'flux-one' ),
			];
		}

		$email = sanitize_email( $email );
		if ( '' === $email || ! is_email( $email ) ) {
			return [
				'type'    => 'error',
				'command' => 'user add ' . $login,
				'message' => __( 'A valid email address is required.', 'flux-one' ),
			];
		}

		$role = sanitize_key( $role );
		if ( '' === $role ) {
			return [
				'type'    => 'error',
				'command' => 'user add ' . $login . ' ' . $email,
				'message' => __( 'A role is required. Use a role you are allowed to assign (see user list / autocomplete).', 'flux-one' ),
			];
		}

		if ( ! function_exists( 'get_editable_roles' ) ) {
			require_once ABSPATH . 'wp-admin/includes/user.php';
		}
		$allowed_roles = function_exists( 'get_editable_roles' ) ? array_keys( get_editable_roles() ) : [];
		if ( ! in_array( $role, $allowed_roles, true ) ) {
			return [
				'type'    => 'error',
				'command' => 'user add ' . $login . ' ' . $email . ' ' . $role,
				'message' => __( 'That role is not available for your account.', 'flux-one' ),
			];
		}

		if ( username_exists( $login ) ) {
			return [
				'type'    => 'error',
				'command' => 'user add ' . $login . ' ' . $email . ' ' . $role,
				'message' => __( 'That username is already taken.', 'flux-one' ),
			];
		}

		if ( email_exists( $email ) ) {
			return [
				'type'    => 'error',
				'command' => 'user add ' . $login . ' ' . $email . ' ' . $role,
				'message' => __( 'That email address is already registered.', 'flux-one' ),
			];
		}

		$user_id = wp_insert_user(
			[
				'user_login' => $login,
				'user_email' => $email,
				'user_pass'  => wp_generate_password( 24, true, true ),
				'role'       => $role,
			]
		);

		if ( is_wp_error( $user_id ) ) {
			return [
				'type'    => 'error',
				'command' => 'user add ' . $login . ' ' . $email . ' ' . $role,
				'message' => $user_id->get_error_message(),
			];
		}

		if ( function_exists( 'wp_send_new_user_notifications' ) ) {
			wp_send_new_user_notifications( (int) $user_id, 'both' );
		}

		return [
			'type'    => 'action',
			'command' => 'user add ' . $login . ' ' . $email . ' ' . $role,
			'status'  => 'success',
			'message' => __( 'User created. A generated password was emailed when your site sends new-user notifications.', 'flux-one' ),
			'data'    => [
				'userId' => (int) $user_id,
				'login'  => (string) $login,
				'email'  => (string) $email,
				'role'   => (string) $role,
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

