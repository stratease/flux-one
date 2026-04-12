<?php
/**
 * Admin destinations index shape.
 *
 * @package FluxOne
 */

use PHPUnit\Framework\TestCase;
use FluxOne\App\Services\AdminDestinations;

/**
 * @covers \FluxOne\App\Services\AdminDestinations::get_index_entries
 */
class AdminDestinationsIndexTest extends TestCase {

	public function test_index_entries_include_absolute_admin_url(): void {
		$entries = AdminDestinations::get_index_entries();
		$this->assertNotEmpty( $entries, 'Expected at least one destination for stubbed caps.' );
		foreach ( $entries as $row ) {
			$this->assertArrayHasKey( 'id', $row );
			$this->assertArrayHasKey( 'label', $row );
			$this->assertArrayHasKey( 'value', $row );
			$this->assertArrayHasKey( 'url', $row );
			$this->assertIsString( $row['url'] );
			$this->assertStringStartsWith( 'https://example.test/wp-admin/', $row['url'] );
		}
	}
}
