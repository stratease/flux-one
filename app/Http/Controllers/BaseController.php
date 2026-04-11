<?php
/**
 * Base REST controller.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Http\Controllers;

use WP_REST_Controller;
use WP_REST_Response;

/**
 * Shared REST helpers.
 *
 * @since 0.1.0
 */
abstract class BaseController extends WP_REST_Controller {

	/**
	 * Default permission check.
	 *
	 * @since 0.1.0
	 * @param \WP_REST_Request $request Request.
	 * @return bool
	 */
	public function check_permissions( $request ) {
		return current_user_can( 'manage_options' );
	}

	/**
	 * Create success envelope.
	 *
	 * @since 0.1.0
	 * @param mixed  $data Data.
	 * @param string $message Message.
	 * @param int    $http_status HTTP status.
	 * @return WP_REST_Response
	 */
	protected function create_success_response( $data = null, $message = 'Success', $http_status = 200 ) {
		return new WP_REST_Response(
			[
				'success'   => true,
				'message'   => (string) $message,
				'timestamp' => gmdate( 'c' ),
				'data'      => $data,
			],
			(int) $http_status
		);
	}

	/**
	 * Create error envelope.
	 *
	 * @since 0.1.0
	 * @param string $message Message.
	 * @param string $error_code Error code.
	 * @param int    $http_status HTTP status.
	 * @param array  $context Log context.
	 * @return WP_REST_Response
	 */
	protected function create_error_response( $message, $error_code = 'flux_one_error', $http_status = 400, $context = [] ) {
		try {
			$logger_class = '\FluxOne\FluxPlugins\Common\Logger\Logger';
			if ( class_exists( $logger_class ) ) {
				$logger = call_user_func( [ $logger_class, 'get_instance' ] );
				if ( is_object( $logger ) && method_exists( $logger, 'error' ) ) {
					$logger->error(
						'Flux One REST error',
						array_merge(
							[
								'error_code'  => (string) $error_code,
								'http_status' => (int) $http_status,
								'message'     => (string) $message,
							],
							(array) $context
						)
					);
				}
			}
		} catch ( \Throwable $e ) {
			// If logger isn't available yet, fail silently.
		}

		return new WP_REST_Response(
			[
				'success'    => false,
				'message'    => (string) $message,
				'error_code' => (string) $error_code,
			],
			(int) $http_status
		);
	}
}

