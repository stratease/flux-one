<?php
/**
 * Persistence for per-event AI email summaries.
 *
 * @package FluxOne
 * @since 1.3.0
 */

namespace FluxOne\App\Services;

// @since 1.5.1 Guard against direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reads and writes rows in `flux_one_email_summaries`.
 *
 * @since 1.3.0
 */
class EmailSummaryRepository {

	/**
	 * Fetch summaries for event IDs.
	 *
	 * @since 1.3.0
	 * @param int[] $event_ids Event IDs.
	 * @return array<int, array<string, mixed>> Map event_id => row fields.
	 */
	public function get_by_event_ids( array $event_ids ) {
		global $wpdb;

		$event_ids = array_values(
			array_filter(
				array_map( 'intval', $event_ids ),
				static function ( $id ) {
					return $id > 0;
				}
			)
		);
		if ( [] === $event_ids ) {
			return [];
		}

		$table = Database::email_summaries_table_name();
		$placeholders = implode( ',', array_fill( 0, count( $event_ids ), '%d' ) );
		$sql          = "SELECT event_id, summary, action, is_urgent, raw_response, summarized_at, created_at FROM {$table} WHERE event_id IN ({$placeholders})";

		$rows = $wpdb->get_results(
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Custom table + dynamic IN placeholders from sanitized IDs only.
			$wpdb->prepare( $sql, $event_ids ),
			ARRAY_A
		);

		$out = [];
		foreach ( (array) $rows as $r ) {
			$eid = (int) ( $r['event_id'] ?? 0 );
			if ( $eid <= 0 ) {
				continue;
			}
			$out[ $eid ] = [
				'event_id'       => $eid,
				'summary'        => isset( $r['summary'] ) ? (string) $r['summary'] : '',
				'action'         => isset( $r['action'] ) ? (string) $r['action'] : '',
				'is_urgent'      => ! empty( $r['is_urgent'] ),
				'raw_response'   => isset( $r['raw_response'] ) ? (string) $r['raw_response'] : '',
				'summarized_at'  => isset( $r['summarized_at'] ) ? (string) $r['summarized_at'] : '',
				'created_at'     => isset( $r['created_at'] ) ? (string) $r['created_at'] : '',
			];
		}

		return $out;
	}

	/**
	 * Insert or replace summary rows.
	 *
	 * @since 1.3.0
	 * @param array<int, array<string, mixed>> $rows Rows with keys: event_id, summary, action, is_urgent, raw_response, summarized_at.
	 * @return void
	 */
	public function upsert_rows( array $rows ) {
		global $wpdb;

		$table = Database::email_summaries_table_name();
		$now   = gmdate( 'Y-m-d H:i:s' );

		foreach ( $rows as $row ) {
			$event_id = (int) ( $row['event_id'] ?? 0 );
			if ( $event_id <= 0 ) {
				continue;
			}

			$summary       = isset( $row['summary'] ) ? (string) $row['summary'] : '';
			$action        = isset( $row['action'] ) ? (string) $row['action'] : '';
			$is_urgent     = ! empty( $row['is_urgent'] );
			$raw_response  = isset( $row['raw_response'] ) ? (string) $row['raw_response'] : '';
			$summarized_at = isset( $row['summarized_at'] ) ? (string) $row['summarized_at'] : $now;

			$wpdb->replace(
				$table,
				[
					'event_id'       => $event_id,
					'summary'        => $summary,
					'action'         => $action,
					'is_urgent'      => $is_urgent ? 1 : 0,
					'raw_response'   => $raw_response,
					'summarized_at'  => $summarized_at,
					'created_at'     => $now,
				],
				[
					'%d',
					'%s',
					'%s',
					'%d',
					'%s',
					'%s',
					'%s',
				]
			);
		}
	}

	/**
	 * Delete summary for an event (e.g. when event row removed).
	 *
	 * @since 1.3.0
	 * @param int $event_id Event ID.
	 * @return void
	 */
	public function delete_by_event_id( $event_id ) {
		global $wpdb;

		$event_id = (int) $event_id;
		if ( $event_id <= 0 ) {
			return;
		}

		$table = Database::email_summaries_table_name();
		$wpdb->delete(
			$table,
			[ 'event_id' => $event_id ],
			[ '%d' ]
		);
	}
}
