<?php
/**
 * Command execution endpoint.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Http\Controllers;

use FluxOne\App\Services\CommandRouter;
use FluxOne\App\Services\UserCommandMemory;
use WP_REST_Request;

/**
 * Executes commands and returns action/panel/navigation results.
 *
 * @since 0.1.0
 */
class CommandController extends BaseController {

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
			'/command',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'execute' ],
					'permission_callback' => [ $this, 'check_permissions' ],
					'args'                => [
						'input' => [
							'type'     => 'string',
							'required' => true,
						],
					],
				],
			]
		);
	}

	/**
	 * Execute a command.
	 *
	 * @since 0.1.0
	 * @param WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function execute( WP_REST_Request $request ) {
		$input = (string) $request->get_param( 'input' );
		$input = trim( $input );

		if ( '' === $input ) {
			return $this->create_error_response( __( 'Command input is required.', 'flux-one' ), 'flux_one_empty_input', 400 );
		}

		try {
			$router = new CommandRouter();
			$result = $router->handle( $input );

			if ( isset( $result['type'] ) && 'navigation' === $result['type'] && is_array( $result['data'] ?? null ) ) {
				$label = isset( $result['data']['label'] ) ? (string) $result['data']['label'] : '';
				$nav_url = isset( $result['data']['url'] ) ? (string) $result['data']['url'] : '';
				$cmd   = isset( $result['command'] ) ? (string) $result['command'] : $input;
				( new UserCommandMemory() )->add_recent_navigation(
					$cmd,
					$label !== '' ? $label : null,
					$nav_url !== '' ? $nav_url : null
				);
			}

			return $this->create_success_response( $result, __( 'Command executed.', 'flux-one' ) );
		} catch ( \Throwable $e ) {
			return $this->create_error_response(
				__( 'Command failed.', 'flux-one' ),
				'flux_one_command_failed',
				500,
				[
					'exception' => get_class( $e ),
					'message'   => $e->getMessage(),
				]
			);
		}
	}
}

