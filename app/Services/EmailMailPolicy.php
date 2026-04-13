<?php
/**
 * Strip opted-in users’ addresses from outbound wp_mail (To / Cc / Bcc).
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Services;

/**
 * Mutates wp_mail args so suppressed users do not receive copies; other recipients still get the message.
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
		add_filter( 'wp_mail', [ self::class, 'maybe_strip_suppressed_recipients' ], 10, 1 );
	}

	/**
	 * Remove addresses belonging to users who enabled suppression.
	 *
	 * Runs after {@see EmailEventLogger::capture_wp_mail} (priority 5) so logs see pre-strip recipients.
	 *
	 * @since 0.1.0
	 * @param array $args Mail attributes (to, subject, message, headers, attachments).
	 * @return array
	 */
	public static function maybe_strip_suppressed_recipients( $args ) {
		$args = (array) $args;

		$strip = array_flip( FluxOneSettings::get_suppressed_delivery_emails() );
		if ( empty( $strip ) ) {
			return $args;
		}

		$args['to']      = self::filter_to_field( $args['to'] ?? '', $strip );
		$args['headers'] = self::filter_headers_cc_bcc( $args['headers'] ?? [], $strip );

		return $args;
	}

	/**
	 * @param mixed           $to    wp_mail to.
	 * @param array<string,1> $strip Lowercased email => 1.
	 * @return string|array
	 */
	private static function filter_to_field( $to, array $strip ) {
		if ( is_array( $to ) ) {
			$out = [];
			foreach ( $to as $entry ) {
				$filtered = self::filter_address_string( (string) $entry, $strip );
				if ( '' !== $filtered ) {
					$out[] = $filtered;
				}
			}
			return $out;
		}

		$addrs = self::parse_address_list( (string) $to );
		$keep  = [];
		foreach ( $addrs as $addr ) {
			if ( ! isset( $strip[ strtolower( $addr ) ] ) ) {
				$keep[] = $addr;
			}
		}
		return implode( ', ', $keep );
	}

	/**
	 * @param mixed           $headers String or array of header lines.
	 * @param array<string,1> $strip   Lowercased email => 1.
	 * @return string|array
	 */
	private static function filter_headers_cc_bcc( $headers, array $strip ) {
		if ( is_array( $headers ) ) {
			$out = [];
			foreach ( $headers as $line ) {
				$out[] = self::filter_single_header_line( (string) $line, $strip );
			}
			return array_values( array_filter( $out, static fn( $l ) => '' !== trim( $l ) ) );
		}

		$lines = preg_split( "/\r\n|\n|\r/", (string) $headers );
		$lines = is_array( $lines ) ? $lines : [];
		$built = [];
		foreach ( $lines as $line ) {
			$adj = self::filter_single_header_line( $line, $strip );
			if ( '' !== trim( $adj ) ) {
				$built[] = $adj;
			}
		}
		return implode( "\r\n", $built );
	}

	/**
	 * @param string          $line  One header line.
	 * @param array<string,1> $strip Lowercased email => 1.
	 */
	private static function filter_single_header_line( $line, array $strip ) {
		$line = (string) $line;
		if ( ! preg_match( '/^\s*(cc|bcc)\s*:\s*(.+)$/i', $line, $m ) ) {
			return $line;
		}
		$name = $m[1];
		$rest = $m[2];
		$addrs = self::parse_address_list( $rest );
		$keep  = [];
		foreach ( $addrs as $addr ) {
			if ( ! isset( $strip[ strtolower( $addr ) ] ) ) {
				$keep[] = $addr;
			}
		}
		if ( empty( $keep ) ) {
			return '';
		}
		return $name . ': ' . implode( ', ', $keep );
	}

	/**
	 * Remove suppressed addresses from one comma/semicolon segment (may include display names).
	 *
	 * @param array<string,1> $strip Lowercased email => 1.
	 */
	private static function filter_address_string( $chunk, array $strip ) {
		$addrs = self::parse_address_list( $chunk );
		$keep  = [];
		foreach ( $addrs as $addr ) {
			if ( ! isset( $strip[ strtolower( $addr ) ] ) ) {
				$keep[] = $addr;
			}
		}
		return implode( ', ', $keep );
	}

	/**
	 * Extract bare email addresses from a header fragment.
	 *
	 * @since 0.1.0
	 * @param string $s Raw.
	 * @return string[]
	 */
	private static function parse_address_list( $s ) {
		$s = trim( (string) $s );
		if ( '' === $s ) {
			return [];
		}
		$parts = preg_split( '/[,;]/', $s );
		$parts = is_array( $parts ) ? $parts : [];
		$addrs = [];
		foreach ( $parts as $p ) {
			$p = trim( $p );
			if ( '' === $p ) {
				continue;
			}
			if ( preg_match( '/<([^>]+)>/', $p, $m ) ) {
				$candidate = trim( $m[1] );
			} else {
				$candidate = $p;
			}
			if ( is_email( $candidate ) ) {
				$addrs[] = $candidate;
			}
		}
		return $addrs;
	}
}
