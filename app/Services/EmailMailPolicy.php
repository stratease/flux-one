<?php
/**
 * Optional cancellation of wp_mail after logging (suppress mail to self).
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Services;

/**
 * Hooks pre_wp_mail to skip delivery when policy matches.
 *
 * @since 0.1.0
 */
class EmailMailPolicy {

	/**
	 * Register WordPress hooks.
	 *
	 * @since 0.1.0
	 * @return void
	 */
	public static function register() {
		add_filter( 'pre_wp_mail', [ self::class, 'maybe_suppress_mail_to_self' ], 10, 2 );
	}

	/**
	 * Return false to cancel send when To includes the current user's email.
	 *
	 * Logging runs earlier on the wp_mail filter, so aggregates stay complete.
	 *
	 * @since 0.1.0
	 * @param mixed $pre  Short-circuit value.
	 * @param array $atts Mail attributes (to, subject, message, headers, attachments).
	 * @return mixed
	 */
	public static function maybe_suppress_mail_to_self( $pre, $atts ) {
		if ( null !== $pre ) {
			return $pre;
		}

		if ( ! FluxOneSettings::is_suppress_mail_to_self_enabled() ) {
			return $pre;
		}

		$user = wp_get_current_user();
		if ( ! $user || ! $user->ID || ! is_email( $user->user_email ) ) {
			return $pre;
		}

		$self = strtolower( $user->user_email );
		$tos  = self::normalize_recipients( $atts['to'] ?? '' );

		foreach ( $tos as $addr ) {
			if ( strtolower( $addr ) === $self ) {
				return false;
			}
		}

		return $pre;
	}

	/**
	 * Flatten wp_mail "to" into lowercase-ish address strings.
	 *
	 * @since 0.1.0
	 * @param mixed $to String or array from wp_mail.
	 * @return string[]
	 */
	private static function normalize_recipients( $to ) {
		if ( is_array( $to ) ) {
			$out = [];
			foreach ( $to as $entry ) {
				$out = array_merge( $out, self::normalize_recipients( $entry ) );
			}
			return $out;
		}

		$s = trim( (string) $to );
		if ( '' === $s ) {
			return [];
		}

		$parts = preg_split( '/[,;]/', $s );
		$addrs = [];
		foreach ( (array) $parts as $p ) {
			$p = trim( $p );
			if ( '' === $p ) {
				continue;
			}
			if ( preg_match( '/<([^>]+)>/', $p, $m ) ) {
				$addrs[] = trim( $m[1] );
				continue;
			}
			$addrs[] = $p;
		}

		return $addrs;
	}
}
