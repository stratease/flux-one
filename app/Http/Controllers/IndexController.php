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
use WP_Post;

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
					'permission_callback' => static function () {
						return current_user_can( 'edit_theme_options' );
					},
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

		register_rest_route(
			$this->namespace,
			'/index/content',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'content' ],
					'permission_callback' => [ $this, 'check_permissions' ],
					'args'                => [
						'q'    => [
							'type'     => 'string',
							'required' => false,
						],
						'kind' => [
							'type'     => 'string',
							'required' => false,
						],
					],
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
			return $this->create_success_response( $index, __( 'Plugins index.', 'flux-one' ) );
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

		return $this->create_success_response( array_slice( $filtered, 0, 100 ), __( 'Plugins results.', 'flux-one' ) );
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
			return $this->create_success_response( $index, __( 'Users index.', 'flux-one' ) );
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

		return $this->create_success_response( array_slice( $filtered, 0, 50 ), __( 'Users results.', 'flux-one' ) );
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
		return $this->create_success_response( $index, __( 'Menus index.', 'flux-one' ) );
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
			return $this->create_success_response( $sites, __( 'Sites index.', 'flux-one' ) );
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

		return $this->create_success_response( array_slice( $filtered, 0, 100 ), __( 'Sites results.', 'flux-one' ) );
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
			return $this->create_success_response( $destinations, __( 'Destinations index.', 'flux-one' ) );
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

		return $this->create_success_response( $filtered, __( 'Destinations results.', 'flux-one' ) );
	}

	/**
	 * Keys for `config` command autocomplete (active suite plugins + WordPress core subset).
	 *
	 * @since 0.1.0
	 * @since 1.7.0 Adds group metadata and WordPress core definitions via SuiteConfigCatalog.
	 * @since 1.5.0 searchText includes group and group label for Command Bar entity matching.
	 * @return \WP_REST_Response
	 */
	public function suite_config() {
		$rows = [];
		foreach ( SuiteConfigCatalog::get_available_definitions() as $def ) {
			if ( empty( $def['id'] ) ) {
				continue;
			}
			$row = [
				'id'           => (string) $def['id'],
				'label'        => (string) ( $def['label'] ?? '' ),
				'plugin'       => (string) ( $def['plugin'] ?? '' ),
				'type'         => (string) ( $def['type'] ?? '' ),
				'group'        => (string) ( $def['group'] ?? '' ),
				'groupLabel'   => (string) ( $def['group_label'] ?? '' ),
				'groupOrder'   => (int) ( $def['group_order'] ?? 0 ),
				'searchText'   => trim(
					(string) ( $def['id'] ?? '' ) . ' ' .
					(string) ( $def['label'] ?? '' ) . ' ' .
					(string) ( $def['plugin'] ?? '' ) . ' ' .
					(string) ( $def['group'] ?? '' ) . ' ' .
					(string) ( $def['group_label'] ?? '' ) . ' ' .
					(string) ( $def['search'] ?? '' )
				),
			];
			if ( isset( $def['min'] ) ) {
				$row['min'] = (int) $def['min'];
			}
			if ( isset( $def['max'] ) ) {
				$row['max'] = (int) $def['max'];
			}
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

		return $this->create_success_response( $rows, __( 'Suite config index.', 'flux-one' ) );
	}

	/**
	 * Search content (posts/pages) by title + slug only.
	 *
	 * @since 0.1.0
	 * @param WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function content( WP_REST_Request $request ) {
		global $wpdb;

		$q    = strtolower( trim( (string) $request->get_param( 'q' ) ) );
		$kind = strtolower( trim( (string) $request->get_param( 'kind' ) ) );

		if ( '' === $q ) {
			return $this->create_success_response( [], __( 'Content results.', 'flux-one' ) );
		}

		$post_types = [ 'post', 'page' ];
		if ( 'post' === $kind ) {
			$post_types = [ 'post' ];
		}
		if ( 'page' === $kind ) {
			$post_types = [ 'page' ];
		}

		$like = '%' . $wpdb->esc_like( $q ) . '%';

		// Title/slug only; return candidate IDs then filter by edit capability.
		$placeholders = implode( ',', array_fill( 0, count( $post_types ), '%s' ) );
		$sql          = $wpdb->prepare(
			"SELECT ID, post_title, post_name, post_type
			 FROM {$wpdb->posts}
			 WHERE post_type IN ($placeholders)
			   AND (LOWER(post_title) LIKE %s OR LOWER(post_name) LIKE %s)
			 ORDER BY post_date DESC
			 LIMIT 40",
			...array_merge( $post_types, [ $like, $like ] )
		);

		$rows = $wpdb->get_results( $sql, ARRAY_A );
		if ( ! is_array( $rows ) ) {
			$rows = [];
		}

		$out = [];
		foreach ( $rows as $row ) {
			$id = isset( $row['ID'] ) ? (int) $row['ID'] : 0;
			if ( $id <= 0 ) {
				continue;
			}
			if ( ! current_user_can( 'edit_post', $id ) ) {
				continue;
			}

			$title    = isset( $row['post_title'] ) ? (string) $row['post_title'] : '';
			$slug     = isset( $row['post_name'] ) ? (string) $row['post_name'] : '';
			$postType = isset( $row['post_type'] ) ? (string) $row['post_type'] : '';
			$title    = trim( wp_strip_all_tags( $title ) );
			$slug     = trim( $slug );

			$edit_url = get_edit_post_link( $id, '' );
			if ( ! is_string( $edit_url ) || '' === $edit_url ) {
				$edit_url = admin_url( 'post.php?post=' . $id . '&action=edit' );
			}

			$out[] = [
				'id'         => $id,
				'postType'   => in_array( $postType, [ 'post', 'page' ], true ) ? $postType : 'post',
				'title'      => $title !== '' ? $title : '(no title)',
				'slug'       => $slug,
				'editUrl'    => (string) $edit_url,
				'searchText' => trim( strtolower( $title . ' ' . $slug ) ),
			];

			if ( count( $out ) >= 25 ) {
				break;
			}
		}

		return $this->create_success_response( $out, __( 'Content results.', 'flux-one' ) );
	}
}

