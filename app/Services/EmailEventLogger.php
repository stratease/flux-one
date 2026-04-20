<?php
/**
 * Email event logger.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Services;

/**
 * Captures outbound email events via wp_mail filter.
 *
 * @since 0.1.0
 */
class EmailEventLogger {
	/**
	 * Max email body chars stored for HTML preview.
	 *
	 * @since 0.1.0
	 * @var int
	 */
	private const MAX_MESSAGE_HTML_CHARS = 50000;

	/**
	 * Max email body chars stored for release resend.
	 *
	 * @since 0.1.0
	 * @var int
	 */
	private const MAX_MESSAGE_CHARS = 150000;

	/**
	 * Marker header used to prevent re-log/re-suppress loops during release resend.
	 *
	 * @since 0.1.0
	 * @var string
	 */
	private const RELEASE_HEADER = 'X-Flux-One-Release: 1';

	/**
	 * Determine if headers indicate HTML content.
	 *
	 * @since 0.1.0
	 * @param mixed $headers wp_mail headers.
	 * @return bool
	 */
	private function is_html_headers( $headers ) {
		if ( is_string( $headers ) ) {
			return false !== stripos( $headers, 'content-type: text/html' );
		}
		if ( is_array( $headers ) ) {
			foreach ( $headers as $h ) {
				if ( is_string( $h ) && false !== stripos( $h, 'content-type: text/html' ) ) {
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * Truncate string to safe length (mb-safe when available).
	 *
	 * @since 0.1.0
	 * @param string $s String.
	 * @param int    $max_chars Max chars.
	 * @return string
	 */
	private function truncate( $s, $max_chars ) {
		$s         = (string) $s;
		$max_chars = (int) $max_chars;
		if ( $max_chars <= 0 ) {
			return '';
		}
		if ( function_exists( 'mb_strlen' ) && function_exists( 'mb_substr' ) ) {
			if ( mb_strlen( $s ) > $max_chars ) {
				return mb_substr( $s, 0, $max_chars );
			}
			return $s;
		}
		if ( strlen( $s ) > $max_chars ) {
			return substr( $s, 0, $max_chars );
		}
		return $s;
	}

	/**
	 * Determine if headers include the release marker.
	 *
	 * @since 0.1.0
	 * @param mixed $headers wp_mail headers.
	 * @return bool
	 */
	private function is_release_mail( $headers ) {
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
	 * Filter callback for wp_mail.
	 *
	 * @since 0.1.0
	 * @param array $args wp_mail args.
	 * @return array
	 */
	public function capture_wp_mail( $args ) {
		$args = (array) $args;
		if ( $this->is_release_mail( $args['headers'] ?? [] ) ) {
			return $args;
		}

		$uid = get_current_user_id();
		if ( $uid <= 0 || ! FluxOneSettings::is_email_capture_enabled_for_user( $uid ) ) {
			return $args;
		}

		try {
			$this->log_email_event( $args, $uid );
		} catch ( \Throwable $e ) {
			// Never break wp_mail due to logging.
		}

		return $args;
	}

	/**
	 * Log email event to DB.
	 *
	 * @since 0.1.0
	 * @param array $args wp_mail args.
	 * @return void
	 */
	private function log_email_event( $args, $user_id ) {
		global $wpdb;

		$table = Database::events_table_name();

		$to      = $args['to'] ?? '';
		$subject = (string) ( $args['subject'] ?? '' );
		$message = isset( $args['message'] ) ? (string) $args['message'] : '';
		$headers = $args['headers'] ?? [];
		$is_html = $this->is_html_headers( $headers );
		$preview = '';
		if ( $message !== '' ) {
			$plain = wp_strip_all_tags( $message );
			$plain = preg_replace( '/\s+/', ' ', $plain );
			$plain = trim( (string) $plain );
			if ( function_exists( 'mb_substr' ) ) {
				$preview = mb_substr( $plain, 0, 500 );
			} else {
				$preview = substr( $plain, 0, 500 );
			}
		}

		$message_html = '';
		if ( '' !== $message && $is_html ) {
			$message_html = $this->truncate( $message, self::MAX_MESSAGE_HTML_CHARS );
		}

		$message_raw = '';
		if ( '' !== $message ) {
			$message_raw = $this->truncate( $message, self::MAX_MESSAGE_CHARS );
		}

		$payload = [
			'to'             => $to,
			'headers'        => $headers,
			'message'        => $message_raw,
			'messagePreview' => $preview,
			'messageHtml'    => $message_html,
			'messageIsHtml'  => $is_html,
		];

		$wpdb->insert(
			$table,
			[
				'user_id'    => (int) $user_id,
				'source'     => 'wp_mail',
				'event_type' => 'email',
				'subject'    => $subject,
				'payload'    => wp_json_encode( $payload ),
				'created_at' => gmdate( 'Y-m-d H:i:s' ),
			],
			[
				'%d',
				'%s',
				'%s',
				'%s',
				'%s',
				'%s',
			]
		);
	}
}

