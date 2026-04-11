<?php
/**
 * Bootstrap endpoint.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Http\Controllers;

use WP_REST_Request;
use FluxOne\App\Services\CacheVersionService;

/**
 * Provides preloaded indices and flags for fast command UX.
 *
 * @since 0.1.0
 */
class BootstrapController extends BaseController {

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
			'/bootstrap',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_bootstrap' ],
					'permission_callback' => [ $this, 'check_permissions' ],
				],
			]
		);
	}

	/**
	 * Get bootstrap data.
	 *
	 * @since 0.1.0
	 * @param WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function get_bootstrap( WP_REST_Request $request ) {
		$versions = ( new CacheVersionService() )->get_versions();

		return $this->create_success_response(
			[
				'contractVersion' => 1,
				'features'        => [
					'plugins'        => [ 'enabled' => true ],
					'users'          => [ 'enabled' => true ],
					'menus'          => [ 'enabled' => true ],
					'multisite'       => [ 'enabled' => is_multisite() ],
					'aggregateEmail'  => [ 'enabled' => true ],
					'summaryEmail'    => [ 'enabled' => true ],
					'navigation'      => [ 'enabled' => true ],
				],
				'cacheVersions'   => $versions,
			],
			'Bootstrap loaded'
		);
	}
}

