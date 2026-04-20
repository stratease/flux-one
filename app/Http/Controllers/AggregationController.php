<?php
/**
 * Aggregation endpoints.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Http\Controllers;

use FluxOne\App\Services\AiSummaryService;
use FluxOne\App\Services\Database;
use FluxOne\App\Services\EmailAggregationService;
use WP_REST_Request;

/**
 * Aggregation controller.
 *
 * @since 0.1.0
 */
class AggregationController extends BaseController {
	/**
	 * Marker header used to prevent re-log/re-suppress loops during release resend.
	 *
	 * @since 0.1.0
	 * @var string
	 */
	private const RELEASE_HEADER = 'X-Flux-One-Release: 1';


	/**
	 * REST namespace.
	 *
	 * @since 0.1.0
	 * @var string
	 */
	protected $namespace = 'flux-one/v1';

	/**
	 * Register routes.
	 *
	 * @since 0.1.0
	 * @return void
	 */
	public function register_routes() {
		register_rest_route(
			$this->namespace,
			'/aggregate/email',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'aggregate_email' ],
					'permission_callback' => [ $this, 'check_permissions' ],
					'args'                => [
						'days' => [
							'type'     => 'integer',
							'required' => false,
						],
					],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/summary/email',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'summary_email' ],
					'permission_callback' => [ $this, 'check_permissions' ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/aggregate/email/release',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'release_email' ],
					'permission_callback' => [ $this, 'check_permissions' ],
					'args'                => [
						'eventId' => [
							'type'     => 'integer',
							'required' => true,
						],
					],
				],
			]
		);
	}

	/**
	 * Email aggregation report (non-AI).
	 *
	 * @since 0.1.0
	 * @param WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function aggregate_email( WP_REST_Request $request ) {
		$days = (int) $request->get_param( 'days' );
		if ( $days <= 0 || $days > 30 ) {
			$days = 7;
		}

		$svc    = new EmailAggregationService();
		$report = $svc->get_report( $days, get_current_user_id() );

		return $this->create_success_response( $report, 'Email aggregation' );
	}

	/**
	 * AI summary for email aggregation (feature-gated).
	 *
	 * @since 0.1.0
	 * @param WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function summary_email( WP_REST_Request $request ) {
		$report = ( new EmailAggregationService() )->get_report( 7, get_current_user_id() );
		$ai     = ( new AiSummaryService() )->summarize_email_report( $report );

		return $this->create_success_response(
			[
				'ai' => $ai,
			],
			'Email AI summary'
		);
	}

	/**
	 * Release a captured email event: resend to current user, then delete event.
	 *
	 * Per-user: only releases events owned by current user.
	 *
	 * @since 0.1.0
	 * @param WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function release_email( WP_REST_Request $request ) {
		global $wpdb;

		$event_id = (int) $request->get_param( 'eventId' );
		if ( $event_id <= 0 ) {
			return $this->create_error_response( 'Missing eventId.', 'flux_one_bad_request', 400 );
		}

		$user_id = (int) get_current_user_id();
		if ( $user_id <= 0 ) {
			return $this->create_error_response( 'Not logged in.', 'flux_one_forbidden', 403 );
		}

		$user = get_userdata( $user_id );
		if ( ! $user || ! is_email( $user->user_email ) ) {
			return $this->create_error_response( 'User email not available.', 'flux_one_no_user_email', 400 );
		}

		$table = Database::events_table_name();
		$row   = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT id, user_id, subject, payload FROM {$table} WHERE id = %d AND user_id = %d AND event_type = %s LIMIT 1",
				$event_id,
				$user_id,
				'email'
			),
			ARRAY_A
		);

		if ( ! is_array( $row ) || empty( $row['id'] ) ) {
			return $this->create_error_response( 'Email event not found.', 'flux_one_not_found', 404 );
		}

		$payload = json_decode( (string) ( $row['payload'] ?? '' ), true );
		$payload = is_array( $payload ) ? $payload : [];

		$subject = (string) ( $row['subject'] ?? '' );
		$message = (string) ( $payload['message'] ?? '' );
		if ( '' === trim( $message ) ) {
			return $this->create_error_response( 'Captured email body is missing (cannot release).', 'flux_one_missing_message', 400 );
		}

		$headers = $payload['headers'] ?? [];
		$headers = $this->strip_cc_bcc_headers( $headers );
		$headers = $this->append_release_header( $headers );

		$sent = wp_mail( (string) $user->user_email, $subject, $message, $headers );
		if ( true !== $sent ) {
			return $this->create_error_response( 'wp_mail failed during release.', 'flux_one_mail_failed', 500 );
		}

		$wpdb->delete(
			$table,
			[
				'id'      => $event_id,
				'user_id' => $user_id,
			],
			[
				'%d',
				'%d',
			]
		);

		return $this->create_success_response(
			[
				'eventId' => $event_id,
				'to'      => (string) $user->user_email,
			],
			'Email released'
		);
	}

	/**
	 * Remove Cc/Bcc headers from captured headers so release only emails current user.
	 *
	 * @since 0.1.0
	 * @param mixed $headers Captured wp_mail headers.
	 * @return string|array
	 */
	private function strip_cc_bcc_headers( $headers ) {
		if ( is_array( $headers ) ) {
			return array_values(
				array_filter(
					array_map(
						static function ( $h ) {
							$h = (string) $h;
							return preg_match( '/^\s*(cc|bcc)\s*:/i', $h ) ? '' : $h;
						},
						$headers
					),
					static fn( $h ) => '' !== trim( (string) $h )
				)
			);
		}

		$lines = preg_split( "/\r\n|\n|\r/", (string) $headers );
		$lines = is_array( $lines ) ? $lines : [];
		$keep  = [];
		foreach ( $lines as $line ) {
			$line = (string) $line;
			if ( preg_match( '/^\s*(cc|bcc)\s*:/i', $line ) ) {
				continue;
			}
			if ( '' !== trim( $line ) ) {
				$keep[] = $line;
			}
		}
		return implode( "\r\n", $keep );
	}

	/**
	 * Append marker header to captured header set.
	 *
	 * @since 0.1.0
	 * @param mixed $headers Captured wp_mail headers.
	 * @return string|array
	 */
	private function append_release_header( $headers ) {
		if ( is_array( $headers ) ) {
			$headers[] = self::RELEASE_HEADER;
			return $headers;
		}
		$h = trim( (string) $headers );
		if ( '' === $h ) {
			return self::RELEASE_HEADER;
		}
		return $h . "\r\n" . self::RELEASE_HEADER;
	}
}

