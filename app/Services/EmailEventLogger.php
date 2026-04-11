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
		try {
			$this->log_email_event( (array) $args );
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
	private function log_email_event( $args ) {
		global $wpdb;

		$table = Database::events_table_name();
		$user_id = get_current_user_id();

		$to      = $args['to'] ?? '';
		$subject = (string) ( $args['subject'] ?? '' );

		$payload = [
			'to'      => $to,
			'headers' => $args['headers'] ?? [],
		];

		$wpdb->insert(
			$table,
			[
				'user_id'    => $user_id ? (int) $user_id : null,
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

