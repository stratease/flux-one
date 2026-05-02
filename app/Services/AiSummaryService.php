<?php
/**
 * AI summary service (feature-gated).
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Services;

use FluxOne\FluxPlugins\Common\License\LicenseService;

/**
 * Produces AI summaries for supported aggregate reports.
 *
 * @since 0.1.0
 */
class AiSummaryService {

	/**
	 * Determine if license is valid for AI features.
	 *
	 * @since 0.1.0
	 * @return bool
	 */
	public function is_ai_enabled() {
		return (bool) LicenseService::get_instance()->is_license_valid();
	}

	/**
	 * Legacy: summarize from aggregate report rows.
	 *
	 * @since 1.3.0
	 * @param array $report Aggregate report from {@see EmailAggregationService::get_report()}.
	 * @return array
	 */
	public function summarize_email_report( $report ) {
		$report = is_array( $report ) ? $report : [];
		$events = isset( $report['events'] ) && is_array( $report['events'] ) ? $report['events'] : [];
		$ids    = [];
		foreach ( $events as $ev ) {
			if ( is_array( $ev ) && isset( $ev['id'] ) ) {
				$ids[] = (int) $ev['id'];
			}
		}
		$ids = array_values(
			array_unique(
				array_filter(
					$ids,
					static function ( $id ) {
						return $id > 0;
					}
				)
			)
		);
		$ids = array_slice( $ids, 0, 25 );

		return ( new EmailSummaryService() )->summarize_event_ids( $ids, get_current_user_id() );
	}
}
