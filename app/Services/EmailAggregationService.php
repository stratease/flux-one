<?php
/**
 * Email aggregation service.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Services;

/**
 * Builds non-AI aggregate report for email events.
 *
 * @since 0.1.0
 */
class EmailAggregationService {

	/**
	 * Get aggregate report for last N days (only events captured for this user).
	 *
	 * @since 0.1.0
	 * @param int $days    Days.
	 * @param int $user_id WordPress user ID.
	 * @return array
	 */
	public function get_report( $days = 7, $user_id = 0 ) {
		global $wpdb;

		$user_id = (int) $user_id;
		if ( $user_id <= 0 ) {
			return [
				'meta'    => [
					'days'        => (int) $days,
					'eventsCount' => 0,
				],
				'summary' => sprintf( '0 email event(s) in the last %d day(s).', (int) $days ),
				'groups'  => [],
				'events'  => [],
			];
		}

		$table  = Database::events_table_name();
		$cutoff = gmdate( 'Y-m-d H:i:s', time() - ( (int) $days * DAY_IN_SECONDS ) );

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, source, event_type, subject, payload, created_at FROM {$table} WHERE event_type = %s AND user_id = %d AND created_at >= %s ORDER BY created_at DESC LIMIT 500",
				'email',
				$user_id,
				$cutoff
			),
			ARRAY_A
		);

		$events = array_map(
			static function ( $r ) {
				return [
					'id'        => (int) $r['id'],
					'source'    => (string) $r['source'],
					'type'      => (string) $r['event_type'],
					'subject'   => (string) $r['subject'],
					'payload'   => json_decode( (string) $r['payload'], true ),
					'createdAt' => (string) $r['created_at'],
				];
			},
			(array) $rows
		);

		$by_subject = [];
		foreach ( $events as $e ) {
			$key = trim( (string) ( $e['subject'] ?? '' ) );
			if ( '' === $key ) {
				$key = '(no subject)';
			}
			if ( ! isset( $by_subject[ $key ] ) ) {
				$by_subject[ $key ] = [
					'subject' => $key,
					'count'   => 0,
					'latest'  => null,
				];
			}
			$by_subject[ $key ]['count']++;
			if ( null === $by_subject[ $key ]['latest' ] ) {
				$by_subject[ $key ]['latest' ] = $e['createdAt'];
			}
		}

		$groups = array_values( $by_subject );
		usort(
			$groups,
			static function ( $a, $b ) {
				return (int) $b['count'] <=> (int) $a['count'];
			}
		);

		return [
			'meta'   => [
				'days'        => (int) $days,
				'eventsCount' => count( $events ),
			],
			'summary' => sprintf( '%d email event(s) in the last %d day(s).', (int) count( $events ), (int) $days ),
			'groups' => array_slice( $groups, 0, 50 ),
			'events' => $events,
		];
	}
}

