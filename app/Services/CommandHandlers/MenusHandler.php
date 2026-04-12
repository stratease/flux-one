<?php
/**
 * Menus command handler.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Services\CommandHandlers;

use FluxOne\App\Services\IndexCacheService;

/**
 * Handles `menu list` / `menu show`.
 *
 * @since 0.1.0
 */
class MenusHandler {

	/**
	 * Handle tokens after "menu".
	 *
	 * @since 0.1.0
	 * @param array $tokens Tokens.
	 * @return array
	 */
	public function handle( $tokens ) {
		$tokens = array_values( (array) $tokens );
		$op     = $tokens[0] ?? '';

		if ( in_array( $op, [ 'list', 'show' ], true ) ) {
			if ( ! current_user_can( 'edit_theme_options' ) ) {
				return [
					'type'    => 'error',
					'command' => 'menu ' . $op,
					'message' => __( 'You do not have permission to manage menus.', 'flux-one' ),
				];
			}
			return [
				'type'    => 'panel',
				'panelId' => 'menus',
				'command' => 'menu ' . $op,
				'data'    => ( new IndexCacheService() )->get_menus_index(),
			];
		}

		return [
			'type'    => 'error',
			'command' => 'menu ' . implode( ' ', $tokens ),
			'message' => __( 'Try menu list.', 'flux-one' ),
		];
	}
}
