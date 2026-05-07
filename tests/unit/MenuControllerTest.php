<?php
/**
 * MenuController unit tests.
 *
 * @package FluxOne
 * @since 1.4.3
 */

use FluxOne\App\Http\Controllers\MenuController;
use PHPUnit\Framework\TestCase;

final class MenuControllerTest extends TestCase {

	public function test_build_menu_item_position_map_depth_first_unique_positions(): void {
		$controller = new MenuController();

		$items = [
			[ 'id' => 10, 'parentId' => 0, 'order' => 0 ], // Home
			[ 'id' => 11, 'parentId' => 0, 'order' => 1 ], // About
			[ 'id' => 12, 'parentId' => 10, 'order' => 0 ], // Child of Home
			[ 'id' => 13, 'parentId' => 10, 'order' => 1 ], // Child of Home
			[ 'id' => 14, 'parentId' => 12, 'order' => 0 ], // Grandchild
			[ 'id' => 15, 'parentId' => 11, 'order' => 0 ], // Child of About
		];

		$method = new ReflectionMethod( $controller, 'build_menu_item_position_map' );
		$method->setAccessible( true );
		$map = $method->invoke( $controller, $items );

		$this->assertIsArray( $map );
		$this->assertSame( [ 10, 12, 14, 13, 11, 15 ], $this->ids_sorted_by_position( $map ) );
		$this->assertSame( count( $items ), count( array_unique( array_values( $map ) ) ) );
	}

	/**
	 * @param array<int,int> $map Map of id => position.
	 * @return int[]
	 */
	private function ids_sorted_by_position( array $map ): array {
		asort( $map );
		return array_map( 'intval', array_keys( $map ) );
	}
}

