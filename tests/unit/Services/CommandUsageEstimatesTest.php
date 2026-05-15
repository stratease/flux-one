<?php
/**
 * Tests for CommandUsageEstimates.
 *
 * @package FluxOne
 * @since 1.6.0
 */

namespace FluxOne\Tests\Unit\Services;

use FluxOne\App\Services\CommandUsageEstimates;
use PHPUnit\Framework\TestCase;

/**
 * @covers \FluxOne\App\Services\CommandUsageEstimates
 */
class CommandUsageEstimatesTest extends TestCase {

	public function test_seconds_per_root_has_nine_balanced_keys() {
		$map = CommandUsageEstimates::seconds_per_root();
		$this->assertCount( 9, $map );
		$this->assertSame( 5, $map['nav'] );
		$this->assertSame( 5, $map['pnav'] );
		$this->assertSame( 8, $map['edit'] );
		$this->assertSame( 15, $map['plugin'] );
		$this->assertSame( 20, $map['user'] );
		$this->assertSame( 30, $map['menu'] );
		$this->assertSame( 15, $map['config'] );
		$this->assertSame( 60, $map['aggregate'] );
		$this->assertSame( 90, $map['summary'] );
	}

	public function test_total_seconds_saved_balanced_example() {
		$this->assertSame(
			45,
			CommandUsageEstimates::total_seconds_saved(
				[
					'nav'  => 3,
					'menu' => 1,
				]
			)
		);
	}

	public function test_get_allowed_roots_matches_map_keys() {
		$roots = CommandUsageEstimates::get_allowed_roots();
		$this->assertSame( array_keys( CommandUsageEstimates::seconds_per_root() ), $roots );
	}

	public function test_total_seconds_saved_ignores_unknown_roots() {
		$this->assertSame(
			15,
			CommandUsageEstimates::total_seconds_saved(
				[
					'plugin' => 1,
					'bogus'  => 999,
				]
			)
		);
	}
}
