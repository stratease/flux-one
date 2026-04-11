<?php
/**
 * Aggregation endpoints.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Http\Controllers;

use FluxOne\App\Services\AiSummaryService;
use FluxOne\App\Services\EmailAggregationService;
use WP_REST_Request;

/**
 * Aggregation controller.
 *
 * @since 0.1.0
 */
class AggregationController extends BaseController {

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

		$svc = new EmailAggregationService();
		$report = $svc->get_report( $days );

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
		$report = ( new EmailAggregationService() )->get_report( 7 );
		$ai     = ( new AiSummaryService() )->summarize_email_report( $report );

		return $this->create_success_response(
			[
				'ai' => $ai,
			],
			'Email AI summary'
		);
	}
}

