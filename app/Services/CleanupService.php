<?php
/**
 * Cleanup service.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Services;

/**
 * Daily cleanup jobs.
 *
 * @since 0.1.0
 */
class CleanupService {

	/**
	 * Cron hook.
	 *
	 * @since 0.1.0
	 */
	public const CRON_HOOK = 'flux_one_daily_cleanup';

	/**
	 * Schedule cron if needed.
	 *
	 * @since 0.1.0
	 * @return void
	 */
	public static function maybe_schedule() {
		if ( wp_next_scheduled( self::CRON_HOOK ) ) {
			return;
		}
		wp_schedule_event( time(), 'daily', self::CRON_HOOK );
	}

	/**
	 * Clear scheduled cron.
	 *
	 * @since 0.1.0
	 * @return void
	 */
	public static function clear_schedule() {
		$ts = wp_next_scheduled( self::CRON_HOOK );
		if ( ! $ts ) {
			return;
		}
		wp_unschedule_event( $ts, self::CRON_HOOK );
	}

	/**
	 * Cleanup callback.
	 *
	 * @since 0.1.0
	 * @return void
	 */
	public static function run() {
		global $wpdb;

		$table = Database::events_table_name();
		$cutoff = gmdate( 'Y-m-d H:i:s', time() - ( 7 * DAY_IN_SECONDS ) );

		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$table} WHERE created_at < %s",
				$cutoff
			)
		);
	}
}

