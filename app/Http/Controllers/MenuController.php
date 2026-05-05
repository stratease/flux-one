<?php
/**
 * Menu management endpoints.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Http\Controllers;

use WP_Post;
use WP_REST_Request;
use WP_REST_Server;

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

		register_rest_route(
			$this->namespace,
			'/menus/(?P<id>\d+)/items',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'add_menu_item' ],
					'permission_callback' => static function () {
						return current_user_can( 'edit_theme_options' );
					},
					'args'                => [
						'title' => [
							'type'     => 'string',
							'required' => true,
						],
						'url'     => [
							'type'     => 'string',
							'required' => true,
						],
					],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/menus/(?P<id>\d+)/items/(?P<item_id>\d+)',
			[
				[
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => [ $this, 'delete_menu_item' ],
					'permission_callback' => static function () {
						return current_user_can( 'edit_theme_options' );
					},
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
	 * @since 1.4.2 Merges existing nav menu fields before {@see wp_update_nav_menu_item()} so partial payloads do not clear titles or URLs.
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

		if ( ! function_exists( 'wp_update_nav_menu_item' ) ) {
			require_once ABSPATH . 'wp-admin/includes/nav-menu.php';
		}

		foreach ( $items as $row ) {
			$item_id = (int) ( $row['id'] ?? 0 );
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

			$base_args = $this->get_existing_nav_menu_item_args( $item_id );
			if ( null === $base_args ) {
				return $this->create_error_response( 'Invalid menu item.', 'flux_one_menu_item_invalid', 400 );
			}

			$result = wp_update_nav_menu_item(
				$menu_id,
				$item_id,
				array_merge(
					$base_args,
					[
						'menu-item-position'  => $order,
						'menu-item-parent-id' => $parent,
					]
				)
			);

			if ( is_wp_error( $result ) ) {
				return $this->create_error_response(
					$result->get_error_message(),
					'flux_one_menu_save_failed',
					500
				);
			}
		}

		return $this->menu( $request );
	}

	/**
	 * Build full {@see wp_update_nav_menu_item()} args from stored post/meta.
	 *
	 * Passing only position/parent omits other keys; WordPress merges defaults where
	 * `menu-item-title` and `menu-item-url` default to empty strings and wipes labels.
	 *
	 * @since 1.4.2
	 * @param int $item_id Menu item post ID.
	 * @return array<string, int|string>|null Arguments or null if not a nav_menu_item post.
	 */
	private function get_existing_nav_menu_item_args( int $item_id ): ?array {
		$post = get_post( $item_id );
		if ( ! ( $post instanceof WP_Post ) || 'nav_menu_item' !== $post->post_type ) {
			return null;
		}

		$type      = (string) get_post_meta( $item_id, '_menu_item_type', true );
		$object    = (string) get_post_meta( $item_id, '_menu_item_object', true );
		$object_id = (int) get_post_meta( $item_id, '_menu_item_object_id', true );
		$url       = (string) get_post_meta( $item_id, '_menu_item_url', true );
		$target    = (string) get_post_meta( $item_id, '_menu_item_target', true );
		$xfn       = (string) get_post_meta( $item_id, '_menu_item_xfn', true );
		$classes   = get_post_meta( $item_id, '_menu_item_classes', true );
		if ( is_array( $classes ) ) {
			$classes = implode( ' ', array_map( 'sanitize_html_class', $classes ) );
		} else {
			$classes = is_string( $classes ) ? $classes : '';
		}

		// Core expects these strings pre-slashed (see wp_update_nav_menu_item() docblock).
		$title_raw = (string) get_post_field( 'post_title', $item_id, 'raw' );
		$content   = (string) $post->post_content;
		$excerpt   = (string) $post->post_excerpt;

		$status           = get_post_status( $item_id );
		$menu_item_status = ( 'draft' === $status ) ? 'draft' : '';

		return [
			'menu-item-type'          => '' !== $type ? $type : 'custom',
			'menu-item-object'        => $object,
			'menu-item-object-id'     => $object_id,
			'menu-item-title'         => wp_slash( $title_raw ),
			'menu-item-url'           => $url,
			'menu-item-description'   => wp_slash( $content ),
			'menu-item-attr-title'    => wp_slash( $excerpt ),
			'menu-item-target'        => $target,
			'menu-item-classes'       => $classes,
			'menu-item-xfn'           => $xfn,
			'menu-item-status'        => $menu_item_status,
		];
	}

	/**
	 * Add a custom-link item to a nav menu.
	 *
	 * @since 1.4.0
	 * @param WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function add_menu_item( WP_REST_Request $request ) {
		$menu_id = (int) $request['id'];
		$menu    = wp_get_nav_menu_object( $menu_id );
		if ( ! $menu ) {
			return $this->create_error_response( 'Menu not found.', 'flux_one_menu_not_found', 404 );
		}

		$title = sanitize_text_field( (string) $request->get_param( 'title' ) );
		$url   = esc_url_raw( (string) $request->get_param( 'url' ) );
		if ( '' === $title ) {
			return $this->create_error_response( 'Title is required.', 'flux_one_menu_title_required', 400 );
		}
		if ( '' === $url ) {
			return $this->create_error_response( 'URL is required.', 'flux_one_menu_url_required', 400 );
		}

		if ( ! function_exists( 'wp_update_nav_menu_item' ) ) {
			require_once ABSPATH . 'wp-admin/includes/nav-menu.php';
		}

		$new_id = wp_update_nav_menu_item(
			$menu_id,
			0,
			[
				'menu-item-title'  => $title,
				'menu-item-url'    => $url,
				'menu-item-status' => 'publish',
				'menu-item-type'   => 'custom',
			]
		);

		if ( is_wp_error( $new_id ) ) {
			return $this->create_error_response(
				$new_id->get_error_message(),
				'flux_one_menu_item_create_failed',
				400
			);
		}

		return $this->menu( $request );
	}

	/**
	 * Remove a menu item from a nav menu (deletes the nav_menu_item post).
	 *
	 * @since 1.4.0
	 * @param WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function delete_menu_item( WP_REST_Request $request ) {
		$menu_id = (int) $request['id'];
		$item_id = (int) $request['item_id'];
		$menu    = wp_get_nav_menu_object( $menu_id );
		if ( ! $menu ) {
			return $this->create_error_response( 'Menu not found.', 'flux_one_menu_not_found', 404 );
		}

		if ( $item_id <= 0 ) {
			return $this->create_error_response( 'Invalid menu item id.', 'flux_one_menu_item_invalid', 400 );
		}

		$existing_items = wp_get_nav_menu_items( $menu_id, [ 'update_post_term_cache' => false ] );
		$allowed_ids    = array_map( static fn( $i ) => (int) $i->ID, (array) $existing_items );
		if ( ! in_array( $item_id, $allowed_ids, true ) ) {
			return $this->create_error_response( 'Menu item not in this menu.', 'flux_one_menu_item_wrong_menu', 400 );
		}

		$post = get_post( $item_id );
		if ( ! ( $post instanceof WP_Post ) || 'nav_menu_item' !== $post->post_type ) {
			return $this->create_error_response( 'Invalid menu item.', 'flux_one_menu_item_invalid', 400 );
		}

		$deleted = wp_delete_post( $item_id, true );
		if ( ! $deleted ) {
			return $this->create_error_response( 'Could not delete menu item.', 'flux_one_menu_item_delete_failed', 500 );
		}

		return $this->create_success_response(
			[
				'deleted' => true,
				'id'      => $item_id,
			],
			'Menu item removed'
		);
	}
}

