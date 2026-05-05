<?php
/**
 * REST: Flux One operational settings.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Http\Controllers;

use FluxOne\App\Services\FluxOneSettings;
use WP_REST_Request;

/**
 * Email capture / aggregate defaults for Command Bar.
 *
 * @since 0.1.0
 */
class SettingsController extends BaseController {

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
			'/settings',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_settings' ],
					'permission_callback' => [ $this, 'check_permissions' ],
				],
				[
					'methods'             => 'PUT',
					'callback'            => [ $this, 'put_settings' ],
					'permission_callback' => [ $this, 'check_permissions' ],
				],
			]
		);
	}

	/**
	 * Get settings object.
	 *
	 * @since 0.1.0
	 * @return \WP_REST_Response
	 */
	public function get_settings() {
		return $this->create_success_response( FluxOneSettings::get_all(), 'Settings loaded' );
	}

	/**
	 * Partial update.
	 *
	 * @since 0.1.0
	 * @param WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function put_settings( WP_REST_Request $request ) {
		$body = $request->get_json_params();
		if ( ! is_array( $body ) ) {
			$body = [];
		}

		$updated = FluxOneSettings::update_from_array( $body );

		return $this->create_success_response( $updated, 'Settings saved' );
	}
}
