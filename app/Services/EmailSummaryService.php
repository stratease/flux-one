<?php
/**
 * Orchestrates email AI summaries: cache, Flux API, persistence.
 *
 * @package FluxOne
 * @since 1.3.0
 * @since 1.4.1 Logging for Flux Services API failures and persist edge cases.
 */

namespace FluxOne\App\Services;

use FluxOne\FluxPlugins\Common\Account\AccountIdService;
use FluxOne\FluxPlugins\Common\License\LicenseService;
use FluxOne\FluxPlugins\Common\Logger\Logger;

/**
 * Email summary orchestration.
 *
 * @since 1.3.0
 * @since 1.4.1 Suite logger for summarization API integration.
 */
class EmailSummaryService {

	private const MAX_IDS = 25;

	/**
	 * External ID prefix for Flux API.
	 *
	 * @since 1.3.0
	 * @var string
	 */
	private const EXTERNAL_ID_PREFIX = 'wp_event_';

	/**
	 * Repository.
	 *
	 * @since 1.3.0
	 * @var EmailSummaryRepository
	 */
	private $repo;

	/**
	 * API client.
	 *
	 * @since 1.3.0
	 * @var EmailSummariesApiClient
	 */
	private $api;

	/**
	 * Suite logger.
	 *
	 * @since 1.4.1
	 * @var Logger
	 */
	private $logger;

	/**
	 * Constructor.
	 *
	 * @since 1.3.0
	 * @since 1.4.1 Optional logger injection.
	 * @param EmailSummaryRepository|null  $repo Repository.
	 * @param EmailSummariesApiClient|null $api  API client.
	 * @param Logger|null                  $logger Suite logger.
	 */
	public function __construct( EmailSummaryRepository $repo = null, EmailSummariesApiClient $api = null, Logger $logger = null ) {
		$this->repo   = $repo ?? new EmailSummaryRepository();
		$this->api    = $api ?? new EmailSummariesApiClient();
		$this->logger = $logger ?? Logger::get_instance();
	}

	/**
	 * Whether AI summarization is allowed (suite license).
	 *
	 * @since 1.3.0
	 * @return bool
	 */
	public function is_ai_enabled() {
		return (bool) LicenseService::get_instance()->is_license_valid();
	}

	/**
	 * Summarize email events by ID for current user.
	 *
	 * @since 1.3.0
	 * @param array $event_ids Raw event IDs from request.
	 * @param int   $user_id   Current user ID.
	 * @return array
	 */
	public function summarize_event_ids( $event_ids, $user_id ) {
		$user_id = (int) $user_id;
		if ( $user_id <= 0 ) {
			return $this->disabled_payload( __( 'Not logged in.', 'flux-one' ) );
		}

		$ids = $this->normalize_event_ids( $event_ids );
		if ( [] === $ids ) {
			return [
				'http_error'  => true,
				'code'        => 'flux_one_bad_request',
				'message'     => __( 'Provide between 1 and 25 event IDs.', 'flux-one' ),
				'http_status' => 422,
			];
		}

		if ( ! $this->is_ai_enabled() ) {
			return $this->disabled_payload( __( 'AI summary is unavailable (license required).', 'flux-one' ) );
		}

		$events = $this->load_events_for_user( $ids, $user_id );
		if ( count( $events ) !== count( $ids ) ) {
			return [
				'http_error'  => true,
				'code'        => 'flux_one_bad_request',
				'message'     => __( 'One or more email events were not found or are not accessible.', 'flux-one' ),
				'http_status' => 422,
			];
		}

		$cached = $this->repo->get_by_event_ids( $ids );
		$missing_ids = [];
		foreach ( $ids as $eid ) {
			if ( ! isset( $cached[ $eid ] ) || '' === trim( (string) ( $cached[ $eid ]['summary'] ?? '' ) ) ) {
				$missing_ids[] = $eid;
			}
		}

		if ( [] !== $missing_ids ) {
			$api_result = $this->call_flux_api( $events, $missing_ids );
			if ( isset( $api_result['http_error'] ) && $api_result['http_error'] ) {
				return $api_result;
			}
		}

		$fresh = $this->repo->get_by_event_ids( $ids );
		return $this->success_payload( $ids, $fresh );
	}

	/**
	 * @since 1.3.0
	 * @param array $event_ids Event IDs.
	 * @return int[]
	 */
	private function normalize_event_ids( $event_ids ) {
		if ( ! is_array( $event_ids ) ) {
			return [];
		}
		$out = [];
		foreach ( $event_ids as $raw ) {
			$n = (int) $raw;
			if ( $n > 0 ) {
				$out[ $n ] = $n;
			}
		}
		$out = array_values( $out );
		if ( count( $out ) > self::MAX_IDS ) {
			return [];
		}
		return $out;
	}

	/**
	 * @since 1.3.0
	 * @param int[] $ids     IDs.
	 * @param int   $user_id User ID.
	 * @return array<int, array<string, mixed>>
	 */
	private function load_events_for_user( array $ids, $user_id ) {
		global $wpdb;

		$table        = Database::events_table_name();
		$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
		$sql          = "SELECT id, subject, payload, created_at FROM {$table} WHERE id IN ({$placeholders}) AND user_id = %d AND event_type = %s";
		$args         = array_merge( $ids, [ $user_id, 'email' ] );

		$rows = $wpdb->get_results( $wpdb->prepare( $sql, $args ), ARRAY_A );

		$by_id = [];
		foreach ( (array) $rows as $r ) {
			$id = (int) ( $r['id'] ?? 0 );
			if ( $id > 0 ) {
				$by_id[ $id ] = $r;
			}
		}

		return $by_id;
	}

	/**
	 * @since 1.3.0
	 * @param array<int, array<string, mixed>> $events_by_id Full event rows keyed by id.
	 * @param int[]                            $missing_ids  IDs needing API.
	 * @return array
	 */
	private function call_flux_api( array $events_by_id, array $missing_ids ) {
		$account_id = AccountIdService::get_instance()->get_account_id();
		if ( '' === (string) $account_id ) {
			return [
				'http_error'  => true,
				'code'        => 'flux_one_account_required',
				'message'     => __( 'Account ID not available.', 'flux-one' ),
				'http_status' => 400,
			];
		}

		$emails = [];
		foreach ( $missing_ids as $eid ) {
			$row = $events_by_id[ $eid ] ?? null;
			if ( ! is_array( $row ) ) {
				continue;
			}
			$body = $this->build_body_text( $row );
			if ( '' === $body ) {
				return [
					'http_error'  => true,
					'code'        => 'flux_one_bad_request',
					'message'     => sprintf(
						/* translators: %d: event id */
						__( 'Email event %d has no summarizable body text.', 'flux-one' ),
						$eid
					),
					'http_status' => 422,
				];
			}
			$emails[] = [
				'external_id'  => self::EXTERNAL_ID_PREFIX . $eid,
				'subject'      => (string) ( $row['subject'] ?? '' ),
				'body_text'    => $body,
				'received_at'  => $this->created_at_to_iso_z( (string) ( $row['created_at'] ?? '' ) ),
			];
		}

		$result = $this->api->post_email_summaries( $account_id, $emails );
		if ( ! $result['ok'] ) {
			$this->logger->warning(
				'Email summary orchestration: summarization API returned transport or HTTP failure.',
				[
					'missing_id_count' => count( $missing_ids ),
					'http_status'      => isset( $result['http_status'] ) ? $result['http_status'] : null,
					'error_message'    => isset( $result['error_message'] ) ? (string) $result['error_message'] : '',
					'account_id'       => AccountIdService::get_instance()->obfuscate_account_id(),
				]
			);
			return $this->map_api_transport_error( $result );
		}

		$body = $result['body'];
		if ( isset( $body['success'] ) && false === $body['success'] ) {
			$msg = isset( $body['error'] ) && is_string( $body['error'] ) ? $body['error'] : __( 'Failed to summarize emails.', 'flux-one' );
			$this->logger->warning(
				'Email summary orchestration: summarization API returned success=false.',
				[
					'error'            => $msg,
					'requested_count'  => count( $missing_ids ),
					'account_id'       => AccountIdService::get_instance()->obfuscate_account_id(),
				]
			);
			return [
				'http_error'  => true,
				'code'        => 'flux_one_summary_failed',
				'message'     => $msg,
				'http_status' => 502,
			];
		}

		$this->persist_api_response( $body, $missing_ids );

		return [];
	}

	/**
	 * @since 1.3.0
	 * @since 1.4.1 Log when no rows persisted for requested IDs.
	 * @param array<string, mixed> $body API JSON body.
	 * @param int[]                $requested_ids IDs sent.
	 * @return void
	 */
	private function persist_api_response( array $body, array $requested_ids ) {
		$by_external = [];

		$urgent = isset( $body['urgent_items'] ) && is_array( $body['urgent_items'] ) ? $body['urgent_items'] : [];
		foreach ( $urgent as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			$eid = $this->parse_external_id( isset( $item['external_id'] ) ? (string) $item['external_id'] : '' );
			if ( $eid <= 0 ) {
				continue;
			}
			$by_external[ $eid ] = [
				'summary' => isset( $item['summary'] ) ? (string) $item['summary'] : '',
				'action'  => isset( $item['action'] ) ? (string) $item['action'] : '',
				'urgent'  => true,
				'raw'     => wp_json_encode( $item ),
			];
		}

		$all = isset( $body['all_items'] ) && is_array( $body['all_items'] ) ? $body['all_items'] : [];
		foreach ( $all as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			$eid = $this->parse_external_id( isset( $item['external_id'] ) ? (string) $item['external_id'] : '' );
			if ( $eid <= 0 ) {
				continue;
			}
			if ( isset( $by_external[ $eid ] ) ) {
				continue;
			}
			$by_external[ $eid ] = [
				'summary' => isset( $item['summary'] ) ? (string) $item['summary'] : '',
				'action'  => '',
				'urgent'  => false,
				'raw'     => wp_json_encode( $item ),
			];
		}

		$rows = [];
		$now  = gmdate( 'Y-m-d H:i:s' );
		foreach ( $requested_ids as $eid ) {
			if ( ! isset( $by_external[ $eid ] ) ) {
				continue;
			}
			$hit = $by_external[ $eid ];
			$rows[] = [
				'event_id'       => $eid,
				'summary'        => $hit['summary'],
				'action'         => $hit['action'],
				'is_urgent'      => $hit['urgent'],
				'raw_response'   => $hit['raw'],
				'summarized_at'  => $now,
			];
		}

		if ( [] !== $rows ) {
			$this->repo->upsert_rows( $rows );
			return;
		}

		if ( [] !== $requested_ids ) {
			$this->logger->warning(
				'Email summary orchestration: summarization API response produced no persistable rows for requested event IDs.',
				[
					'requested_count' => count( $requested_ids ),
					'account_id'      => AccountIdService::get_instance()->obfuscate_account_id(),
				]
			);
		}
	}

	/**
	 * @since 1.3.0
	 * @param string $external_id External ID from API.
	 * @return int
	 */
	private function parse_external_id( $external_id ) {
		$external_id = (string) $external_id;
		if ( strpos( $external_id, self::EXTERNAL_ID_PREFIX ) !== 0 ) {
			return 0;
		}
		$rest = substr( $external_id, strlen( self::EXTERNAL_ID_PREFIX ) );
		$n    = (int) $rest;
		return $n > 0 ? $n : 0;
	}

	/**
	 * @since 1.3.0
	 * @since 1.4.1 Debug log for operator-facing message mapping.
	 * @param array<string, mixed> $result API client result.
	 * @return array
	 */
	private function map_api_transport_error( array $result ) {
		$code = isset( $result['http_status'] ) ? (int) $result['http_status'] : 0;
		$msg  = isset( $result['error_message'] ) ? (string) $result['error_message'] : __( 'Email summarization request failed.', 'flux-one' );

		switch ( $code ) {
			case 403:
				$msg = __( 'License is not active for this site.', 'flux-one' );
				break;
			case 429:
				$msg = __( 'Monthly summarization quota exceeded.', 'flux-one' );
				break;
			case 413:
				$msg = __( 'Request payload too large.', 'flux-one' );
				break;
			case 422:
				$msg = __( 'Invalid summarization request.', 'flux-one' );
				break;
			case 500:
				$msg = __( 'Summarization service error. Try again later.', 'flux-one' );
				break;
			default:
				break;
		}

		$out_status = $code > 0 ? $code : 502;
		$this->logger->debug(
			'Email summary orchestration: mapped summarization API error to client response.',
			[
				'http_status'   => $out_status,
				'user_message'  => $msg,
			]
		);

		return [
			'http_error' => true,
			'code'       => 'flux_one_summary_api_error',
			'message'    => $msg,
			'http_status' => $out_status,
		];
	}

	/**
	 * @since 1.3.0
	 * @param array<string, mixed> $row Event row.
	 * @return string
	 */
	private function build_body_text( array $row ) {
		$payload = json_decode( (string) ( $row['payload'] ?? '' ), true );
		$payload = is_array( $payload ) ? $payload : [];

		$message = isset( $payload['message'] ) ? (string) $payload['message'] : '';
		if ( '' !== trim( $message ) ) {
			return $this->normalize_whitespace( $message );
		}

		$html = isset( $payload['messageHtml'] ) ? (string) $payload['messageHtml'] : '';
		if ( '' !== trim( $html ) ) {
			$plain = wp_strip_all_tags( $html );
			return $this->normalize_whitespace( $plain );
		}

		return '';
	}

	/**
	 * @since 1.3.0
	 * @param string $s Text.
	 * @return string
	 */
	private function normalize_whitespace( $s ) {
		$s = preg_replace( '/\s+/', ' ', (string) $s );
		return trim( (string) $s );
	}

	/**
	 * @since 1.3.0
	 * @param string $mysql_gmt `Y-m-d H:i:s` UTC.
	 * @return string ISO-8601 Z.
	 */
	private function created_at_to_iso_z( $mysql_gmt ) {
		$mysql_gmt = trim( (string) $mysql_gmt );
		if ( '' === $mysql_gmt ) {
			return gmdate( 'Y-m-d\TH:i:s\Z' );
		}
		$ts = strtotime( $mysql_gmt . ' UTC' );
		if ( false === $ts ) {
			return gmdate( 'Y-m-d\TH:i:s\Z' );
		}
		return gmdate( 'Y-m-d\TH:i:s\Z', $ts );
	}

	/**
	 * @since 1.3.0
	 * @param string $message Message.
	 * @return array
	 */
	private function disabled_payload( $message ) {
		return [
			'enabled' => false,
			'status'  => 'disabled',
			'message' => (string) $message,
			'summaries' => [
				'by_event_id'      => [],
				'urgent_event_ids' => [],
			],
		];
	}

	/**
	 * @since 1.3.0
	 * @param int[]                          $ids   Ordered event IDs.
	 * @param array<int, array<string, mixed>> $fresh Rows from DB.
	 * @return array
	 */
	private function success_payload( array $ids, array $fresh ) {
		$by_event_id      = [];
		$urgent_event_ids = [];

		foreach ( $ids as $eid ) {
			if ( ! isset( $fresh[ $eid ] ) ) {
				continue;
			}
			$r = $fresh[ $eid ];
			$by_event_id[ (string) $eid ] = [
				'summary'       => (string) ( $r['summary'] ?? '' ),
				'action'        => (string) ( $r['action'] ?? '' ),
				'isUrgent'      => ! empty( $r['is_urgent'] ),
				'summarizedAt'  => (string) ( $r['summarized_at'] ?? '' ),
			];
			if ( ! empty( $r['is_urgent'] ) ) {
				$urgent_event_ids[] = $eid;
			}
		}

		$has_any = false;
		foreach ( $ids as $eid ) {
			$key = (string) $eid;
			if ( isset( $by_event_id[ $key ] ) && '' !== trim( (string) ( $by_event_id[ $key ]['summary'] ?? '' ) ) ) {
				$has_any = true;
				break;
			}
		}

		$message = $has_any
			? __( 'Summaries loaded.', 'flux-one' )
			: __( 'Summary: none generated yet.', 'flux-one' );

		return [
			'enabled'   => true,
			'status'    => $has_any ? 'ok' : 'empty',
			'message'   => $message,
			'summaries' => [
				'by_event_id'      => $by_event_id,
				'urgent_event_ids' => $urgent_event_ids,
			],
		];
	}
}
