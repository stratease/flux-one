<?php
/**
 * Index endpoints for autocomplete and entity resolution.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Http\Controllers;

use FluxOne\App\Services\AdminDestinations;
use FluxOne\App\Services\IndexCacheService;
use FluxOne\App\Services\SuiteConfigCatalog;
use WP_REST_Request;

/**
 * Index controller.
 *
 * @since 0.1.0
 */
class IndexController extends BaseController {

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
			'/index/plugins',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'plugins' ],
					'permission_callback' => [ $this, 'check_permissions' ],
					'args'                => [
						'q' => [
							'type'     => 'string',
							'required' => false,
						],
					],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/index/users',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'users' ],
					'permission_callback' => [ $this, 'check_permissions' ],
					'args'                => [
						'q' => [
							'type'     => 'string',
							'required' => false,
						],
					],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/index/menus',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'menus' ],
					'permission_callback' => [ $this, 'check_permissions' ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/index/sites',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'sites' ],
					'permission_callback' => [ $this, 'check_permissions' ],
					'args'                => [
						'q' => [
							'type'     => 'string',
							'required' => false,
						],
					],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/index/destinations',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'destinations' ],
					'permission_callback' => [ $this, 'check_permissions' ],
					'args'                => [
						'q' => [
							'type'     => 'string',
							'required' => false,
						],
					],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/index/suite-config',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'suite_config' ],
					'permission_callback' => [ $this, 'check_permissions' ],
				],
			]
		);
	}

	/**
	 * Search plugins index.
	 *
	 * @since 0.1.0
	 * @param WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function plugins( WP_REST_Request $request ) {
		$q = strtolower( trim( (string) $request->get_param( 'q' ) ) );
		$index = ( new IndexCacheService() )->get_plugins_index();

		if ( '' === $q ) {
			return $this->create_success_response( $index, 'Plugins index' );
		}

		$filtered = array_values(
			array_filter(
				$index,
				static function ( $p ) use ( $q ) {
					$hay = strtolower( (string) ( $p['name'] ?? '' ) . ' ' . (string) ( $p['pluginFile'] ?? '' ) );
					return false !== strpos( $hay, $q );
				}
			)
		);

		return $this->create_success_response( array_slice( $filtered, 0, 100 ), 'Plugins results' );
	}

	/**
	 * Search users index.
	 *
	 * @since 0.1.0
	 * @param WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function users( WP_REST_Request $request ) {
		$q = strtolower( trim( (string) $request->get_param( 'q' ) ) );

		$index = ( new IndexCacheService() )->get_users_index();
		if ( '' === $q ) {
			return $this->create_success_response( $index, 'Users index' );
		}

		$filtered = array_values(
			array_filter(
				$index,
				static function ( $u ) use ( $q ) {
					$hay = strtolower( (string) ( $u['email'] ?? '' ) . ' ' . (string) ( $u['displayName'] ?? '' ) . ' ' . (string) ( $u['login'] ?? '' ) );
					return false !== strpos( $hay, $q );
				}
			)
		);

		return $this->create_success_response( array_slice( $filtered, 0, 50 ), 'Users results' );
	}

	/**
	 * Menus index.
	 *
	 * @since 0.1.0
	 * @param WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function menus( WP_REST_Request $request ) {
		$index = ( new IndexCacheService() )->get_menus_index();
		return $this->create_success_response( $index, 'Menus index' );
	}

	/**
	 * Sites index (multisite only).
	 *
	 * @since 0.1.0
	 * @param WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function sites( WP_REST_Request $request ) {
		$q = strtolower( trim( (string) $request->get_param( 'q' ) ) );
		$index = ( new IndexCacheService() )->get_multisite_index();
		$sites = (array) ( $index['sites'] ?? [] );

		if ( '' === $q ) {
			return $this->create_success_response( $sites, 'Sites index' );
		}

		$filtered = array_values(
			array_filter(
				$sites,
				static function ( $s ) use ( $q ) {
					$hay = strtolower( (string) ( $s['domain'] ?? '' ) . (string) ( $s['path'] ?? '' ) );
					return false !== strpos( $hay, $q );
				}
			)
		);

		return $this->create_success_response( array_slice( $filtered, 0, 100 ), 'Sites results' );
	}

	/**
	 * Destinations index (static mapping).
	 *
	 * @since 0.1.0
	 * @param WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function destinations( WP_REST_Request $request ) {
		$q = strtolower( trim( (string) $request->get_param( 'q' ) ) );

		$destinations = AdminDestinations::get_index_entries();

		if ( '' === $q ) {
			return $this->create_success_response( $destinations, 'Destinations index' );
		}

		$filtered = array_values(
			array_filter(
				$destinations,
				static function ( $d ) use ( $q ) {
					$url = (string) ( $d['url'] ?? '' );
					$url_q = '';
					$parts = wp_parse_url( $url );
					if ( is_array( $parts ) && isset( $parts['query'] ) && is_string( $parts['query'] ) ) {
						$url_q = strtolower( (string) $parts['query'] );
					}

					$hay = strtolower(
						(string) ( $d['id'] ?? '' ) . ' ' .
						(string) ( $d['label'] ?? '' ) . ' ' .
						(string) ( $d['value'] ?? '' ) . ' ' .
						(string) ( $d['searchText'] ?? '' ) . ' ' .
						$url_q
					);
					return false !== strpos( $hay, $q );
				}
			)
		);

		return $this->create_success_response( $filtered, 'Destinations results' );
	}

	/**
	 * Keys for `config` command autocomplete (active Flux suite plugins only).
	 *
	 * @since 0.1.0
	 * @return \WP_REST_Response
	 */
	public function suite_config() {
		$rows = [];
		foreach ( SuiteConfigCatalog::get_available_definitions() as $def ) {
			if ( empty( $def['id'] ) ) {
				continue;
			}
			$row = [
				'id'         => (string) $def['id'],
				'label'      => (string) ( $def['label'] ?? '' ),
				'plugin'     => (string) ( $def['plugin'] ?? '' ),
				'type'       => (string) ( $def['type'] ?? '' ),
				'searchText' => trim( (string) ( $def['id'] ?? '' ) . ' ' . (string) ( $def['label'] ?? '' ) . ' ' . (string) ( $def['plugin'] ?? '' ) . ' ' . (string) ( $def['search'] ?? '' ) ),
			];
			if ( isset( $def['choices'] ) && is_array( $def['choices'] ) ) {
				$choices = array_values(
					array_filter(
						array_map( 'strval', $def['choices'] ),
						static function ( $v ) {
							return $v !== '';
						}
					)
				);
				if ( [] !== $choices ) {
					$row['choices'] = $choices;
				}
			}
			$rows[] = $row;
		}

		return $this->create_success_response( $rows, 'Suite config index' );
	}
}

