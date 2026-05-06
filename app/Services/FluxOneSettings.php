<?php
/**
 * Flux One settings: per-user email prefs (user meta) + site aggregate window.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Services;

/**
 * Option names and helpers for Command Bar email features.
 *
 * @since 0.1.0
 */
class FluxOneSettings {

	/**
	 * Legacy site option (migrated to user meta, then removed).
	 *
	 * @since 0.1.0
	 */
	public const OPTION_EMAIL_CAPTURE_ENABLED = 'flux_one_email_capture_enabled';

	/**
	 * Legacy site option (migrated to user meta, then removed).
	 *
	 * @since 0.1.0
	 */
	public const OPTION_SUPPRESS_MAIL_TO_SELF = 'flux_one_suppress_mail_to_self';

	/**
	 * Default window in days for aggregate UI (max 30, enforced server-side). Site-wide default only.
	 *
	 * @since 0.1.0
	 */
	public const OPTION_AGGREGATE_DEFAULT_DAYS = 'flux_one_aggregate_default_days';

	/**
	 * User meta: when true, log wp_mail for this user’s aggregate.
	 *
	 * @since 0.1.0
	 */
	public const USER_META_EMAIL_CAPTURE = 'flux_one_email_capture_enabled';

	/**
	 * User meta: when true, strip this user’s email from To/Cc/Bcc on outbound mail.
	 *
	 * @since 0.1.0
	 */
	public const USER_META_SUPPRESS_MAIL = 'flux_one_suppress_mail_to_self';

	/**
	 * User meta: Command Bar shortcut (e.g. mod+.).
	 *
	 * @since 0.1.1
	 */
	public const USER_META_COMMAND_SHORTCUT = 'flux_one_command_shortcut';

	/**
	 * Migration flag (site option).
	 *
	 * @since 0.1.0
	 */
	public const OPTION_USER_EMAIL_PREFS_MIGRATED = 'flux_one_user_email_prefs_migrated';

	/**
	 * Register WordPress settings (aggregate window only; email toggles are user meta).
	 *
	 * @since 0.1.0
	 * @return void
	 */
	public static function register_settings() {
		register_setting(
			'flux_one_settings',
			self::OPTION_AGGREGATE_DEFAULT_DAYS,
			[
				'type'              => 'integer',
				'default'           => 7,
				'sanitize_callback' => static function ( $v ) {
					$n = (int) $v;
					return max( 1, min( 30, $n ) );
				},
			]
		);
	}

	/**
	 * Copy legacy site-wide email flags into per-user meta once, then drop legacy options.
	 *
	 * Must run on {@see 'plugins_loaded'} or later so user APIs (`get_users`, `user_can`, …) exist
	 * and {@see WP_User_Query} is allowed (WP 6.1.1+).
	 *
	 * @since 0.1.0
	 * @return void
	 */
	public static function maybe_migrate_legacy_email_options() {
		if ( ! did_action( 'plugins_loaded' ) ) {
			return;
		}

		if ( (string) get_option( self::OPTION_USER_EMAIL_PREFS_MIGRATED, '' ) === '1' ) {
			return;
		}

		$legacy_capture  = get_option( self::OPTION_EMAIL_CAPTURE_ENABLED, null );
		$legacy_suppress = get_option( self::OPTION_SUPPRESS_MAIL_TO_SELF, null );

		if ( null !== $legacy_capture || null !== $legacy_suppress ) {
			$user_ids = get_users(
				[
					'fields' => 'ID',
					'number' => 9999,
				]
			);
			foreach ( (array) $user_ids as $uid ) {
				$uid = (int) $uid;
				if ( $uid <= 0 || ! user_can( $uid, 'manage_options' ) ) {
					continue;
				}
				if ( null !== $legacy_capture ) {
					update_user_meta( $uid, self::USER_META_EMAIL_CAPTURE, (bool) $legacy_capture );
				}
				if ( null !== $legacy_suppress ) {
					update_user_meta( $uid, self::USER_META_SUPPRESS_MAIL, (bool) $legacy_suppress );
				}
			}
		}

		delete_option( self::OPTION_EMAIL_CAPTURE_ENABLED );
		delete_option( self::OPTION_SUPPRESS_MAIL_TO_SELF );
		update_option( self::OPTION_USER_EMAIL_PREFS_MIGRATED, '1', false );
	}

	/**
	 * Public shape for REST and admin UI (current user + site default days).
	 *
	 * @since 0.1.0
	 * @return array
	 */
	public static function get_all() {
		$uid = get_current_user_id();

		return [
			'emailCaptureEnabled'    => self::is_email_capture_enabled_for_user( $uid ),
			'suppressMailToSelf'     => self::is_suppress_mail_enabled_for_user( $uid ),
			'aggregateDefaultDays'   => self::get_aggregate_default_days(),
			'commandShortcut'        => self::get_command_shortcut_for_user( $uid ),
		];
	}

	/**
	 * Merge partial update (current user for email prefs; site for default days).
	 *
	 * @since 0.1.0
	 * @param array $patch Patch.
	 * @return array Updated public shape.
	 */
	public static function update_from_array( $patch ) {
		$patch = is_array( $patch ) ? $patch : [];
		$uid   = get_current_user_id();

		if ( $uid > 0 ) {
			if ( array_key_exists( 'emailCaptureEnabled', $patch ) ) {
				update_user_meta( $uid, self::USER_META_EMAIL_CAPTURE, (bool) $patch['emailCaptureEnabled'] );
			}
			if ( array_key_exists( 'suppressMailToSelf', $patch ) ) {
				update_user_meta( $uid, self::USER_META_SUPPRESS_MAIL, (bool) $patch['suppressMailToSelf'] );
			}
			if ( array_key_exists( 'commandShortcut', $patch ) ) {
				self::update_command_shortcut_for_user( $uid, $patch['commandShortcut'] );
			}
		}

		if ( array_key_exists( 'aggregateDefaultDays', $patch ) ) {
			$d = (int) $patch['aggregateDefaultDays'];
			$d = max( 1, min( 30, $d ) );
			update_option( self::OPTION_AGGREGATE_DEFAULT_DAYS, $d, false );
		}

		return self::get_all();
	}

	/**
	 * Command Bar shortcut string for a user.
	 *
	 * @since 0.1.1
	 * @param int $user_id User ID.
	 * @return string
	 */
	public static function get_command_shortcut_for_user( $user_id ) {
		$user_id = (int) $user_id;
		if ( $user_id <= 0 ) {
			return 'mod+.';
		}
		$raw = (string) get_user_meta( $user_id, self::USER_META_COMMAND_SHORTCUT, true );
		$raw = trim( strtolower( $raw ) );
		return '' !== $raw ? $raw : 'mod+.';
	}

	/**
	 * Update Command Bar shortcut for a user (normalized).
	 *
	 * @since 0.1.1
	 * @param int   $user_id User ID.
	 * @param mixed $raw     Raw shortcut string.
	 * @return void
	 */
	public static function update_command_shortcut_for_user( $user_id, $raw ) {
		$user_id = (int) $user_id;
		if ( $user_id <= 0 ) {
			return;
		}
		$s = trim( strtolower( (string) $raw ) );
		if ( '' === $s ) {
			update_user_meta( $user_id, self::USER_META_COMMAND_SHORTCUT, 'mod+.' );
			return;
		}
		$parts = array_values( array_filter( array_map( 'trim', explode( '+', $s ) ) ) );
		$mods  = [];
		$key   = '';
		foreach ( $parts as $p ) {
			if ( in_array( $p, [ 'mod', 'shift', 'alt', 'option' ], true ) ) {
				$mods[] = 'option' === $p ? 'alt' : $p;
				continue;
			}
			if ( '' === $key ) {
				$key = $p;
			}
		}
		if ( '' === $key ) {
			$key = '.';
		}
		$mods = array_values( array_unique( $mods ) );
		sort( $mods );
		$norm = implode( '+', array_merge( $mods, [ $key ] ) );
		if ( false === strpos( $norm, 'mod+' ) ) {
			$norm = 'mod+' . $norm;
		}
		update_user_meta( $user_id, self::USER_META_COMMAND_SHORTCUT, $norm );
	}

	/**
	 * Whether wp_mail events are logged for this user (sending context).
	 *
	 * @since 0.1.0
	 * @param int $user_id User ID.
	 * @return bool
	 */
	public static function is_email_capture_enabled_for_user( $user_id ) {
		$user_id = (int) $user_id;
		if ( $user_id <= 0 ) {
			return false;
		}
		return (bool) get_user_meta( $user_id, self::USER_META_EMAIL_CAPTURE, true );
	}

	/**
	 * Whether outbound mail strips this user’s address from recipients.
	 *
	 * @since 0.1.0
	 * @param int $user_id User ID.
	 * @return bool
	 */
	public static function is_suppress_mail_enabled_for_user( $user_id ) {
		$user_id = (int) $user_id;
		if ( $user_id <= 0 ) {
			return false;
		}
		return (bool) get_user_meta( $user_id, self::USER_META_SUPPRESS_MAIL, true );
	}

	/**
	 * Lowercased account emails that should be suppressed for the current request.
	 *
	 * Suppression is per-user (sending context), not a global admin list. When enabled,
	 * only the current user’s account email is stripped from To/Cc/Bcc.
	 *
	 * @since 0.1.0
	 * @return string[]
	 */
	public static function get_suppressed_delivery_emails() {
		static $cache = null;
		if ( is_array( $cache ) ) {
			return $cache;
		}

		$user_id = get_current_user_id();
		if ( $user_id <= 0 || ! self::is_suppress_mail_enabled_for_user( $user_id ) ) {
			$cache = [];
			return $cache;
		}

		$user = get_userdata( (int) $user_id );
		if ( ! $user || ! is_email( $user->user_email ) ) {
			$cache = [];
			return $cache;
		}

		$cache = [ strtolower( (string) $user->user_email ) ];
		return $cache;
	}

	/**
	 * Default aggregate window (days), site option.
	 *
	 * @since 0.1.0
	 * @return int
	 */
	public static function get_aggregate_default_days() {
		$d = (int) get_option( self::OPTION_AGGREGATE_DEFAULT_DAYS, 7 );
		return max( 1, min( 30, $d ) );
	}
}
