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
use FluxOne\App\Services\FluxOneSettings;
use FluxOne\App\Services\UserCommandMemory;
use FluxOne\FluxPlugins\Common\License\LicenseService;

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
		$memory   = new UserCommandMemory();
		$license_valid = (bool) LicenseService::get_instance()->is_license_valid();

		if ( ! function_exists( 'get_editable_roles' ) ) {
			require_once ABSPATH . 'wp-admin/includes/user.php';
		}
		$editable_roles = function_exists( 'get_editable_roles' )
			? array_keys( get_editable_roles() )
			: [];

		return $this->create_success_response(
			[
				'contractVersion' => 1,
				'editableRoles'   => array_values( array_map( 'strval', $editable_roles ) ),
				'features'        => [
					'plugins'        => [ 'enabled' => true ],
					'users'          => [ 'enabled' => true ],
					'menus'          => [ 'enabled' => true ],
					'multisite'       => [ 'enabled' => is_multisite() ],
					'aggregateEmail'  => [ 'enabled' => true ],
					'summaryEmail'    => [ 'enabled' => $license_valid ],
					'navigation'      => [ 'enabled' => true ],
					'suiteConfig'     => [ 'enabled' => true ],
				],
				'cacheVersions'   => $versions,
				'commandMemory'   => [
					'recentNavigations' => $memory->get_recent_navigations(),
				],
				'emailPrefs'      => [
					'emailCaptureEnabled' => FluxOneSettings::is_email_capture_enabled_for_user( get_current_user_id() ),
				],
				'uiPrefs'         => [
					'commandShortcut' => FluxOneSettings::get_command_shortcut_for_user( get_current_user_id() ),
				],
				'license'         => [
					'valid' => $license_valid,
				],
			],
			'Bootstrap loaded'
		);
	}
}

