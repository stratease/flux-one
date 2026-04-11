<?php
/**
 * AI summary service (feature-gated).
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Services;

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
		$license_class = '\FluxOne\FluxPlugins\Common\License\LicenseService';
		if ( ! class_exists( $license_class ) ) {
			return false;
		}
		$svc = call_user_func( [ $license_class, 'get_instance' ] );
		if ( ! is_object( $svc ) || ! method_exists( $svc, 'is_license_valid' ) ) {
			return false;
		}
		return (bool) $svc->is_license_valid();
	}

	/**
	 * Create AI summary for email aggregate.
	 *
	 * v1: Stub response until external AI integration is wired.
	 *
	 * @since 0.1.0
	 * @param array $report Aggregate report.
	 * @return array
	 */
	public function summarize_email_report( $report ) {
		if ( ! $this->is_ai_enabled() ) {
			return [
				'enabled' => false,
				'status'  => 'disabled',
				'message' => 'AI summary is unavailable (license required).',
			];
		}

		return [
			'enabled' => true,
			'status'  => 'pending',
			'message' => 'AI summary is not yet implemented.',
		];
	}
}

