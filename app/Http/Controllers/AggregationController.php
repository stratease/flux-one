<?php
/**
 * Aggregation endpoints.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Http\Controllers;

// @since 1.5.1 Guard against direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use FluxOne\App\Services\Database;
use FluxOne\App\Services\EmailAggregationService;
use FluxOne\App\Services\EmailSummaryRepository;
use FluxOne\App\Services\EmailSummaryService;
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
						'q' => [
							'type'     => 'string',
							'required' => false,
						],
						'page' => [
							'type'     => 'integer',
							'required' => false,
						],
						'perPage' => [
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

		register_rest_route(
			$this->namespace,
			'/aggregate/email/delete',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'delete_email' ],
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
		if ( $days <= 0 || $days > 365 ) {
			$days = 7;
		}

		$svc    = new EmailAggregationService();
		$report = $svc->get_report(
			$days,
			get_current_user_id(),
			[
				'q'       => (string) $request->get_param( 'q' ),
				'page'    => (int) $request->get_param( 'page' ),
				'perPage' => (int) $request->get_param( 'perPage' ),
			]
		);

		$report['summaries'] = $this->cached_summaries_for_visible_events( $report );

		return $this->create_success_response( $report, __( 'Email aggregation.', 'flux-one' ) );
	}

	/**
	 * Reads cached AI summaries for visible aggregate events only (no AI calls).
	 *
	 * @since 1.4.0
	 * @param array<string, mixed> $report Aggregate report from EmailAggregationService.
	 * @return array<string, mixed>
	 */
	private function cached_summaries_for_visible_events( array $report ) {
		$events = isset( $report['events'] ) && is_array( $report['events'] ) ? $report['events'] : [];
		$ids    = [];
		foreach ( $events as $ev ) {
			if ( ! is_array( $ev ) ) {
				continue;
			}
			$id = isset( $ev['id'] ) ? (int) $ev['id'] : 0;
			if ( $id > 0 ) {
				$ids[] = $id;
			}
		}
		if ( [] === $ids ) {
			return [
				'by_event_id'      => [],
				'urgent_event_ids' => [],
			];
		}

		$repo = new EmailSummaryRepository();
		$rows = $repo->get_by_event_ids( $ids );

		$by_event_id      = [];
		$urgent_event_ids = [];

		foreach ( $ids as $eid ) {
			if ( ! isset( $rows[ $eid ] ) ) {
				continue;
			}
			$r = $rows[ $eid ];
			$key = (string) $eid;
			$by_event_id[ $key ] = [
				'summary'      => (string) ( $r['summary'] ?? '' ),
				'action'       => (string) ( $r['action'] ?? '' ),
				'isUrgent'     => ! empty( $r['is_urgent'] ),
				'summarizedAt' => (string) ( $r['summarized_at'] ?? '' ),
			];
			if ( ! empty( $r['is_urgent'] ) ) {
				$urgent_event_ids[] = $eid;
			}
		}

		return [
			'by_event_id'      => $by_event_id,
			'urgent_event_ids' => $urgent_event_ids,
		];
	}

	/**
	 * AI summary for email aggregation (feature-gated).
	 *
	 * @since 0.1.0
	 * @since 1.3.0 Expects JSON `{ "event_ids": [1,2,...] }` (1..25); uses Flux API for uncached IDs.
	 * @param WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function summary_email( WP_REST_Request $request ) {
		$params = $request->get_json_params();
		if ( ! is_array( $params ) ) {
			$params = [];
		}
		$event_ids = isset( $params['event_ids'] ) ? $params['event_ids'] : $request->get_param( 'event_ids' );
		if ( ! is_array( $event_ids ) ) {
			$event_ids = [];
		}

		$svc = new EmailSummaryService();
		$ai  = $svc->summarize_event_ids( $event_ids, get_current_user_id() );

		if ( ! empty( $ai['http_error'] ) ) {
			$status = isset( $ai['http_status'] ) ? (int) $ai['http_status'] : 400;
			$code   = isset( $ai['code'] ) ? (string) $ai['code'] : 'flux_one_error';
			$msg    = isset( $ai['message'] ) ? (string) $ai['message'] : 'Request failed.';
			return $this->create_error_response( $msg, $code, $status );
		}

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
	 * @since 1.3.0 Removes matching row from `flux_one_email_summaries` when event is deleted.
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
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Custom table from `$wpdb->prefix` + fixed suffix.
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

		( new EmailSummaryRepository() )->delete_by_event_id( $event_id );

		return $this->create_success_response(
			[
				'eventId' => $event_id,
				'to'      => (string) $user->user_email,
			],
			'Email released'
		);
	}

	/**
	 * Delete a captured email event (without releasing).
	 *
	 * Per-user: only deletes events owned by current user.
	 *
	 * @since 1.2.0
	 * @since 1.3.0 Removes matching row from `flux_one_email_summaries` when event is deleted.
	 * @param WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function delete_email( WP_REST_Request $request ) {
		global $wpdb;

		$event_id = (int) $request->get_param( 'eventId' );
		if ( $event_id <= 0 ) {
			return $this->create_error_response( 'Missing eventId.', 'flux_one_bad_request', 400 );
		}

		$user_id = (int) get_current_user_id();
		if ( $user_id <= 0 ) {
			return $this->create_error_response( 'Not logged in.', 'flux_one_forbidden', 403 );
		}

		$table = Database::events_table_name();
		$deleted = $wpdb->delete(
			$table,
			[
				'id'        => $event_id,
				'user_id'   => $user_id,
				'event_type'=> 'email',
			],
			[
				'%d',
				'%d',
				'%s',
			]
		);
		if ( false === $deleted ) {
			return $this->create_error_response( 'Delete failed.', 'flux_one_delete_failed', 500 );
		}
		if ( 0 === (int) $deleted ) {
			return $this->create_error_response( 'Email event not found.', 'flux_one_not_found', 404 );
		}

		( new EmailSummaryRepository() )->delete_by_event_id( $event_id );

		return $this->create_success_response(
			[
				'eventId' => $event_id,
			],
			'Email deleted'
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

