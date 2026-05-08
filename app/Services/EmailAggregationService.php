<?php
/**
 * Email aggregation service.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Services;

// @since 1.5.1 Guard against direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Builds non-AI aggregate report for email events.
 *
 * @since 0.1.0
 */
class EmailAggregationService {

	private const DEFAULT_DAYS    = 7;
	private const MAX_DAYS        = 365;
	private const DEFAULT_PER_PAGE = 20;
	private const MIN_PER_PAGE     = 5;
	private const MAX_PER_PAGE     = 100;
	private const MAX_GROUPS       = 50;

	/**
	 * Get aggregate report for last N days (only events captured for this user).
	 *
	 * The events page lists rows with a non-empty cached AI summary first (newest within that set),
	 * then remaining rows (newest first), whether or not `q` is set, so the UI can keep summarized
	 * matches above unsummarized matches on every page.
	 *
	 * @since 0.1.0
	 * @since 1.2.0 Search (`q`): prioritize events that have a cached summary row with non-empty `summary`.
	 * @since 1.2.1 Summary-first ordering for the events page applies for all requests, not only when `q` is set.
	 * @param int $days    Days.
	 * @param int $user_id WordPress user ID.
	 * @param array $opts  Options: q, page, perPage.
	 * @return array
	 */
	public function get_report( $days = 7, $user_id = 0, $opts = [] ) {
		global $wpdb;

		$user_id = (int) $user_id;
		$opts    = is_array( $opts ) ? $opts : [];

		$days = (int) $days;
		if ( $days <= 0 ) {
			$days = self::DEFAULT_DAYS;
		}
		if ( $days > self::MAX_DAYS ) {
			$days = self::MAX_DAYS;
		}

		$page = (int) ( $opts['page'] ?? 1 );
		if ( $page <= 0 ) {
			$page = 1;
		}
		$per_page = (int) ( $opts['perPage'] ?? self::DEFAULT_PER_PAGE );
		if ( $per_page < self::MIN_PER_PAGE ) {
			$per_page = self::MIN_PER_PAGE;
		}
		if ( $per_page > self::MAX_PER_PAGE ) {
			$per_page = self::MAX_PER_PAGE;
		}
		$offset = ( $page - 1 ) * $per_page;

		$q = trim( (string) ( $opts['q'] ?? '' ) );
		$like = '';
		if ( '' !== $q ) {
			$like = '%' . $wpdb->esc_like( $q ) . '%';
		}
		$has_search = ( '' !== $like );

		if ( $user_id <= 0 ) {
			return [
				'meta'    => [
					'days'       => (int) $days,
					'page'       => (int) $page,
					'perPage'    => (int) $per_page,
					'total'      => 0,
					'totalPages' => 0,
					'eventsCount'=> 0,
				],
				'summary' => sprintf( '0 email event(s) in the last %d day(s).', (int) $days ),
				'groups'  => [],
				'events'  => [],
			];
		}

		$table  = Database::events_table_name();
		$cutoff = gmdate( 'Y-m-d H:i:s', time() - ( (int) $days * DAY_IN_SECONDS ) );

		$where_plain   = "event_type = %s AND user_id = %d AND created_at >= %s";
		$where_aliased = "e.event_type = %s AND e.user_id = %d AND e.created_at >= %s";
		$args          = [ 'email', $user_id, $cutoff ];
		if ( '' !== $like ) {
			$where_plain   .= " AND (subject LIKE %s OR payload LIKE %s)";
			$where_aliased .= " AND (e.subject LIKE %s OR e.payload LIKE %s)";
			$args[]         = $like;
			$args[]         = $like;
		}

		$count_from = $has_search ? "{$table} e" : $table;
		$count_where = $has_search ? $where_aliased : $where_plain;

		$total = (int) $wpdb->get_var(
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Tables and WHERE fragments built from prefix + fixed names and placeholder clauses.
			$wpdb->prepare(
				"SELECT COUNT(1) FROM {$count_from} WHERE {$count_where}",
				$args
			)
		);
		$total_pages = (int) ceil( $total / max( 1, $per_page ) );
		if ( $total_pages <= 0 ) {
			$total_pages = 0;
		}
		if ( $total_pages > 0 && $page > $total_pages ) {
			$page   = $total_pages;
			$offset = ( $page - 1 ) * $per_page;
		}

		$summaries_table = Database::email_summaries_table_name();
		$rows_sql        = "SELECT e.id, e.source, e.event_type, e.subject, e.payload, e.created_at
			FROM {$table} e
			LEFT JOIN {$summaries_table} s ON s.event_id = e.id
			WHERE {$where_aliased}
			ORDER BY (
				CASE
					WHEN s.summary IS NOT NULL AND TRIM( s.summary ) <> '' THEN 0
					ELSE 1
				END
			) ASC, e.created_at DESC
			LIMIT %d OFFSET %d";

		$rows = $wpdb->get_results(
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- JOIN targets use trusted table names; values use placeholders.
			$wpdb->prepare(
				$rows_sql,
				array_merge( $args, [ $per_page, $offset ] )
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

		if ( $has_search ) {
			$group_sql = "SELECT
					COALESCE(NULLIF(TRIM(e.subject), ''), '(no subject)') AS subjectKey,
					COUNT(1) AS cnt,
					MAX(e.created_at) AS latest
				 FROM {$table} e
				 WHERE {$where_aliased}
				 GROUP BY subjectKey
				 ORDER BY cnt DESC
				 LIMIT %d";
		} else {
			$group_sql = "SELECT
					COALESCE(NULLIF(TRIM(subject), ''), '(no subject)') AS subjectKey,
					COUNT(1) AS cnt,
					MAX(created_at) AS latest
				 FROM {$table}
				 WHERE {$where_plain}
				 GROUP BY subjectKey
				 ORDER BY cnt DESC
				 LIMIT %d";
		}

		$group_rows = $wpdb->get_results(
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Custom events table from `$wpdb->prefix` + fixed suffix.
			$wpdb->prepare(
				$group_sql,
				array_merge( $args, [ self::MAX_GROUPS ] )
			),
			ARRAY_A
		);
		$groups = array_map(
			static function ( $r ) {
				return [
					'subject' => (string) ( $r['subjectKey'] ?? '' ),
					'count'   => (int) ( $r['cnt'] ?? 0 ),
					'latest'  => isset( $r['latest'] ) ? (string) $r['latest'] : null,
				];
			},
			(array) $group_rows
		);

		return [
			'meta'   => [
				'days'       => (int) $days,
				'page'       => (int) $page,
				'perPage'    => (int) $per_page,
				'total'      => (int) $total,
				'totalPages' => (int) $total_pages,
				'eventsCount'=> (int) count( $events ),
			],
			'summary' => sprintf( '%d email event(s) in the last %d day(s).', (int) $total, (int) $days ),
			'groups' => $groups,
			'events' => $events,
		];
	}
}

