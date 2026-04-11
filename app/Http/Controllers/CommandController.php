<?php
/**
 * Command execution endpoint.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Http\Controllers;

use FluxOne\App\Services\CommandRouter;
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
			return $this->create_error_response( 'Command input is required.', 'flux_one_empty_input', 400 );
		}

		try {
			$router = new CommandRouter();
			$result = $router->handle( $input );

			return $this->create_success_response( $result, 'Command executed' );
		} catch ( \Throwable $e ) {
			return $this->create_error_response(
				'Command failed.',
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

