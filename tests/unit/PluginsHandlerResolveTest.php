<?php
/**
 * Tests for PluginsHandler plugin file resolution.
 *
 * @package FluxOne
 * @since 1.6.3
 */

use FluxOne\App\Services\CommandHandlers\PluginsHandler;
use PHPUnit\Framework\TestCase;

final class PluginsHandlerResolveTest extends TestCase {

	protected function tearDown(): void {
		unset( $GLOBALS['flux_one_test_plugins'] );
		parent::tearDown();
	}

	/**
	 * @return string
	 */
	private function invoke_resolve( string $query ): ?string {
		$h        = new PluginsHandler();
		$ref      = new \ReflectionClass( $h );
		$m        = $ref->getMethod( 'resolve_plugin_file' );
		$m->setAccessible( true );
		$result = $m->invoke( $h, $query );
		return is_string( $result ) ? $result : null;
	}

	public function test_resolve_by_plugin_file_path(): void {
		$GLOBALS['flux_one_test_plugins'] = [
			'jhp/jason-hartman-properties.php' => [
				'Name' => 'Jason Hartman Properties',
			],
			'other/other.php'                => [
				'Name' => 'Other',
			],
		];
		$this->assertSame( 'jhp/jason-hartman-properties.php', $this->invoke_resolve( 'jhp/jason-hartman-properties.php' ) );
	}

	public function test_resolve_by_folder_slug(): void {
		$GLOBALS['flux_one_test_plugins'] = [
			'jhp/jason-hartman-properties.php' => [ 'Name' => 'Jason Hartman Properties' ],
		];
		$this->assertSame( 'jhp/jason-hartman-properties.php', $this->invoke_resolve( 'jhp' ) );
	}

	public function test_resolve_exact_name_unique(): void {
		$GLOBALS['flux_one_test_plugins'] = [
			'a/a.php' => [ 'Name' => 'Jason Hartman Properties' ],
			'b/b.php' => [ 'Name' => 'Other Plugin' ],
		];
		$this->assertSame( 'a/a.php', $this->invoke_resolve( 'jason hartman properties' ) );
	}

	public function test_resolve_ambiguous_substring_returns_null(): void {
		$GLOBALS['flux_one_test_plugins'] = [
			'a/a.php' => [ 'Name' => 'Jason Hartman Properties' ],
			'b/b.php' => [ 'Name' => 'Jason Hartman Property Proforma' ],
		];
		$this->assertNull( $this->invoke_resolve( 'jason hartman' ) );
	}

	public function test_resolve_unique_substring(): void {
		$GLOBALS['flux_one_test_plugins'] = [
			'a/a.php' => [ 'Name' => 'Jason Hartman Properties' ],
			'b/b.php' => [ 'Name' => 'Totally Different' ],
		];
		$this->assertSame( 'a/a.php', $this->invoke_resolve( 'properties' ) );
	}
}
