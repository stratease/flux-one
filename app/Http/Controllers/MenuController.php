<?php
/**
 * Menu management endpoints.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Http\Controllers;

use WP_REST_Request;

/**
 * Menu controller.
 *
 * @since 0.1.0
 */
class MenuController extends BaseController {

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
			'/menus',
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
			'/menus/(?P<id>\d+)',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'menu' ],
					'permission_callback' => static function () {
						return current_user_can( 'edit_theme_options' );
					},
				],
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'save_menu' ],
					'permission_callback' => static function () {
						return current_user_can( 'edit_theme_options' );
					},
					'args'                => [
						'items' => [
							'type'     => 'array',
							'required' => true,
						],
					],
				],
			]
		);
	}

	/**
	 * List menus.
	 *
	 * @since 0.1.0
	 * @param WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function menus( WP_REST_Request $request ) {
		$menus = wp_get_nav_menus();

		return $this->create_success_response(
			array_map(
				static function ( $m ) {
					return [
						'id'   => (int) $m->term_id,
						'name' => (string) $m->name,
						'slug' => (string) $m->slug,
					];
				},
				$menus
			),
			'Menus'
		);
	}

	/**
	 * Get menu tree.
	 *
	 * @since 0.1.0
	 * @param WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function menu( WP_REST_Request $request ) {
		$menu_id = (int) $request['id'];
		$menu    = wp_get_nav_menu_object( $menu_id );
		if ( ! $menu ) {
			return $this->create_error_response( 'Menu not found.', 'flux_one_menu_not_found', 404 );
		}

		$items = wp_get_nav_menu_items( $menu_id, [ 'update_post_term_cache' => false ] );
		$payload_items = [];
		foreach ( (array) $items as $item ) {
			$payload_items[] = [
				'id'       => (int) $item->ID,
				'title'    => (string) $item->title,
				'type'     => (string) $item->type,
				'url'      => (string) $item->url,
				'parentId' => (int) $item->menu_item_parent,
				'order'    => (int) $item->menu_order,
			];
		}

		return $this->create_success_response(
			[
				'menu'  => [
					'id'   => (int) $menu->term_id,
					'name' => (string) $menu->name,
				],
				'items' => $payload_items,
			],
			'Menu'
		);
	}

	/**
	 * Save menu ordering/parenting.
	 *
	 * Expects `items` as an array of: { id, parentId, order }.
	 *
	 * @since 0.1.0
	 * @param WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function save_menu( WP_REST_Request $request ) {
		$menu_id = (int) $request['id'];
		$menu    = wp_get_nav_menu_object( $menu_id );
		if ( ! $menu ) {
			return $this->create_error_response( 'Menu not found.', 'flux_one_menu_not_found', 404 );
		}

		$items = (array) $request->get_param( 'items' );
		if ( empty( $items ) ) {
			return $this->create_error_response( 'Items are required.', 'flux_one_menu_items_required', 400 );
		}

		$existing_items = wp_get_nav_menu_items( $menu_id, [ 'update_post_term_cache' => false ] );
		$existing_ids   = array_map( static fn( $i ) => (int) $i->ID, (array) $existing_items );
		$existing_ids   = array_flip( $existing_ids );

		foreach ( $items as $row ) {
			$item_id  = (int) ( $row['id'] ?? 0 );
			$parent   = (int) ( $row['parentId'] ?? 0 );
			$order    = (int) ( $row['order'] ?? 0 );

			if ( $item_id <= 0 || ! isset( $existing_ids[ $item_id ] ) ) {
				return $this->create_error_response( 'Invalid menu item id.', 'flux_one_menu_item_invalid', 400 );
			}
			if ( $parent !== 0 && ! isset( $existing_ids[ $parent ] ) ) {
				return $this->create_error_response( 'Invalid parent id.', 'flux_one_menu_parent_invalid', 400 );
			}
			if ( $order < 0 ) {
				$order = 0;
			}

			wp_update_nav_menu_item(
				$menu_id,
				$item_id,
				[
					'menu-item-position'  => $order,
					'menu-item-parent-id' => $parent,
				]
			);
		}

		return $this->menu( $request );
	}
}

