<?php
/**
 * REST: per-user command memory helpers.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Http\Controllers;

// @since 1.5.1 Guard against direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use FluxOne\App\Services\AdminVisitRecorder;
use FluxOne\App\Services\UserCommandMemory;
use WP_REST_Request;

/**
 * Records recent admin destinations from client-side nav fast paths.
 *
 * @since 0.1.0
 */
class MemoryController extends BaseController {

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
			'/memory/recent-navigation',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'record_recent_navigation' ],
					'permission_callback' => [ $this, 'check_permissions' ],
					'args'                => [
						'url'     => [
							'type'     => 'string',
							'required' => false,
						],
						'command' => [
							'type'     => 'string',
							'required' => false,
						],
						'label'   => [
							'type'     => 'string',
							'required' => false,
						],
					],
				],
			]
		);
	}

	/**
	 * Append a recent destination (admin URL and/or `nav` command).
	 *
	 * @since 0.1.0
	 * @param WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function record_recent_navigation( WP_REST_Request $request ) {
		$url     = $request->get_param( 'url' );
		$url     = is_string( $url ) ? trim( $url ) : '';
		$command = $request->get_param( 'command' );
		$command = is_string( $command ) ? trim( $command ) : '';
		$label   = $request->get_param( 'label' );
		$label   = is_string( $label ) ? trim( $label ) : '';

		if ( '' === $url && '' === $command ) {
			return $this->create_error_response(
				__( 'A URL or command is required.', 'flux-one-command-bar' ),
				'flux_one_memory_bad_request',
				400
			);
		}

		if ( '' !== $url && ! AdminVisitRecorder::is_valid_saved_destination_url( $url ) ) {
			return $this->create_error_response(
				__( 'Invalid admin URL.', 'flux-one-command-bar' ),
				'flux_one_memory_invalid_url',
				400
			);
		}

		$memory = new UserCommandMemory();
		if ( '' !== $url ) {
			$memory->add_recent_destination(
				esc_url_raw( $url ),
				$label !== '' ? $label : __( 'Admin', 'flux-one-command-bar' ),
				$command !== '' ? $command : null
			);
		} else {
			$memory->add_recent_navigation( $command, $label !== '' ? $label : null, null );
		}

		return $this->create_success_response( [ 'ok' => true ], __( 'Recorded.', 'flux-one-command-bar' ) );
	}
}
