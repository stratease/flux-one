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
	 * Filter callback for wp_mail.
	 *
	 * @since 0.1.0
	 * @param array $args wp_mail args.
	 * @return array
	 */
	public function capture_wp_mail( $args ) {
		$uid = get_current_user_id();
		if ( $uid <= 0 || ! FluxOneSettings::is_email_capture_enabled_for_user( $uid ) ) {
			return $args;
		}

		try {
			$this->log_email_event( (array) $args, $uid );
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

		$payload = [
			'to'             => $to,
			'headers'        => $args['headers'] ?? [],
			'messagePreview' => $preview,
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

