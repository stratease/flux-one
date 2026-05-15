<?php
/**
 * Heartbeat endpoint (extensible; command usage today).
 *
 * @package FluxOne
 * @since 1.6.0
 */

namespace FluxOne\App\Http\Controllers;

// @since 1.5.1 Guard against direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use FluxOne\App\Services\BootstrapCommandUsagePayload;
use FluxOne\App\Services\UserCommandMemory;
use WP_REST_Request;

/**
 * POST /flux-one/v1/heartbeat
 *
 * @since 1.6.0
 */
class HeartbeatController extends BaseController {

	/**
	 * REST namespace.
	 *
	 * @since 1.6.0
	 * @var string
	 */
	protected $namespace = 'flux-one/v1';

	/**
	 * Register routes.
	 *
	 * @since 1.6.0
	 * @return void
	 */
	public function register_routes() {
		register_rest_route(
			$this->namespace,
			'/heartbeat',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'post_heartbeat' ],
					'permission_callback' => [ $this, 'check_permissions' ],
				],
			]
		);
	}

	/**
	 * Apply heartbeat payload (command usage batch, future keys).
	 *
	 * @since 1.6.0
	 * @param WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function post_heartbeat( WP_REST_Request $request ) {
		$body = $request->get_json_params();
		if ( ! is_array( $body ) ) {
			$body = [];
		}

		$memory = new UserCommandMemory();

		if ( isset( $body['commandUsage'] ) && is_array( $body['commandUsage'] ) ) {
			$memory->add_command_usage_batch( $body['commandUsage'] );
		}

		return $this->create_success_response(
			BootstrapCommandUsagePayload::build( $memory ),
			__( 'Heartbeat OK.', 'flux-one-command-bar' )
		);
	}
}
