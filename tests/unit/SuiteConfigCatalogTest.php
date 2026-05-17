<?php
/**
 * SuiteConfigCatalog unit tests.
 *
 * @package FluxOne
 * @since 1.6.4
 */

use FluxOne\App\Services\CommandRouter;
use FluxOne\App\Services\SuiteConfigCatalog;
use PHPUnit\Framework\TestCase;

final class SuiteConfigCatalogTest extends TestCase {

	protected function setUp(): void {
		$GLOBALS['flux_one_test_options'] = [];
		$GLOBALS['flux_one_test_posts']    = [];
	}

	public function test_wordpress_core_ids_exist_in_catalog(): void {
		$defs = SuiteConfigCatalog::get_definitions();
		$ids  = array_column( $defs, 'id' );
		$this->assertContains( 'wp.blogname', $ids );
		$this->assertContains( 'wp.permalink_structure', $ids );
	}

	public function test_config_set_wp_start_of_week_updates_option(): void {
		$router = new CommandRouter();
		$result = $router->handle( 'config set wp.start_of_week 3' );
		$this->assertSame( 'action', $result['type'] );
		$this->assertSame( 3, (int) $GLOBALS['flux_one_test_options']['start_of_week'] );
	}

	public function test_config_list_panel_rows_include_group_fields(): void {
		$router = new CommandRouter();
		$result = $router->handle( 'config list' );
		$this->assertSame( 'panel', $result['type'] );
		$data = $result['data'];
		$this->assertIsArray( $data );
		$this->assertNotEmpty( $data );
		$row = $data[0];
		$this->assertArrayHasKey( 'group', $row );
		$this->assertArrayHasKey( 'groupLabel', $row );
	}

	public function test_config_search_returns_error(): void {
		$router = new CommandRouter();
		$result = $router->handle( 'config search wp.blogname' );
		$this->assertSame( 'error', $result['type'] );
		$this->assertStringContainsString( 'config search', (string) $result['message'] );
	}
}
