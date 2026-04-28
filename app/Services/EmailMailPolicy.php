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
	 * Marker header used to prevent re-suppress during release resend.
	 *
	 * @since 0.1.0
	 * @var string
	 */
	private const RELEASE_HEADER = 'X-Flux-One-Release: 1';

	/**
	 * Marker header used to bypass suppression for operational emails (password reset, welcome, etc.).
	 *
	 * This header is intended for internal use and should be stripped before sending.
	 *
	 * @since 1.3.0
	 * @var string
	 */
	private const NEVER_SUPPRESS_HEADER = 'X-Flux-One-Never-Suppress: 1';


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

		$headers = $args['headers'] ?? [];
		if ( self::has_release_header( $headers ) ) {
			return $args;
		}

		if ( self::has_never_suppress_header( $headers ) ) {
			$args['headers'] = self::strip_never_suppress_header( $headers );
			return $args;
		}

		$skip = apply_filters( 'flux_one_skip_suppress_mail_to_self', false, $args );
		if ( true === $skip ) {
			return $args;
		}

		$strip = array_flip( FluxOneSettings::get_suppressed_delivery_emails() );
		if ( empty( $strip ) ) {
			return $args;
		}

		$args['to']      = self::filter_to_field( $args['to'] ?? '', $strip );
		$args['headers'] = self::filter_headers_cc_bcc( $headers, $strip );

		return $args;
	}

	/**
	 * @since 0.1.0
	 * @param mixed $headers Headers.
	 * @return bool
	 */
	private static function has_release_header( $headers ) {
		if ( is_string( $headers ) ) {
			return false !== stripos( $headers, self::RELEASE_HEADER );
		}
		if ( is_array( $headers ) ) {
			foreach ( $headers as $h ) {
				if ( is_string( $h ) && false !== stripos( $h, self::RELEASE_HEADER ) ) {
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * @since 1.3.0
	 * @param mixed $headers Headers.
	 * @return bool
	 */
	private static function has_never_suppress_header( $headers ) {
		if ( is_string( $headers ) ) {
			return false !== stripos( $headers, self::NEVER_SUPPRESS_HEADER );
		}
		if ( is_array( $headers ) ) {
			foreach ( $headers as $h ) {
				if ( is_string( $h ) && false !== stripos( $h, self::NEVER_SUPPRESS_HEADER ) ) {
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * Remove the internal never-suppress marker header from header lines.
	 *
	 * @since 1.3.0
	 * @param mixed $headers Headers.
	 * @return string|array
	 */
	private static function strip_never_suppress_header( $headers ) {
		if ( is_array( $headers ) ) {
			$out = [];
			foreach ( $headers as $h ) {
				$h = (string) $h;
				if ( false !== stripos( $h, self::NEVER_SUPPRESS_HEADER ) ) {
					continue;
				}
				$out[] = $h;
			}
			return array_values( array_filter( $out, static fn( $l ) => '' !== trim( (string) $l ) ) );
		}

		$lines = preg_split( "/\r\n|\n|\r/", (string) $headers );
		$lines = is_array( $lines ) ? $lines : [];
		$built = [];
		foreach ( $lines as $line ) {
			$line = (string) $line;
			if ( false !== stripos( $line, self::NEVER_SUPPRESS_HEADER ) ) {
				continue;
			}
			if ( '' !== trim( $line ) ) {
				$built[] = $line;
			}
		}
		return implode( "\r\n", $built );
	}

	/**
	 * Append internal never-suppress marker to headers.
	 *
	 * Intended for core email filter hooks (e.g. password reset notifications).
	 *
	 * @since 1.3.0
	 * @param array $email Email attrs.
	 * @return array
	 */
	public static function mark_never_suppress_email( $email ) {
		$email = is_array( $email ) ? $email : [];
		$h     = $email['headers'] ?? [];
		if ( is_array( $h ) ) {
			$h[] = self::NEVER_SUPPRESS_HEADER;
		} else {
			$s = trim( (string) $h );
			$h = '' === $s ? self::NEVER_SUPPRESS_HEADER : $s . "\r\n" . self::NEVER_SUPPRESS_HEADER;
		}
		$email['headers'] = $h;
		return $email;
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
