<?php
/**
 * Tests for UserCommandMemory usage counters.
 *
 * @package FluxOne
 * @since 1.6.0
 */

namespace FluxOne\Tests\Unit\Services;

use FluxOne\App\Services\UserCommandMemory;
use PHPUnit\Framework\TestCase;

/**
 * @covers \FluxOne\App\Services\UserCommandMemory
 */
class UserCommandMemoryTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['flux_one_test_user_meta']                  = [];
		$GLOBALS['flux_one_test_current_user_id']           = 42;
		$GLOBALS['flux_one_test_current_user_can_manage_options'] = true;
	}

	protected function tearDown(): void {
		unset(
			$GLOBALS['flux_one_test_user_meta'],
			$GLOBALS['flux_one_test_current_user_can_manage_options']
		);
		parent::tearDown();
	}

	public function test_add_command_usage_batch_accumulates() {
		$m = new UserCommandMemory();
		$m->add_command_usage_batch( [ 'nav' => 2, 'menu' => 1 ] );
		$m->add_command_usage_batch( [ 'nav' => 1 ] );

		$this->assertSame(
			[
				'nav'  => 3,
				'menu' => 1,
			],
			$m->get_command_usage_counts()
		);
	}

	public function test_add_command_usage_batch_filters_unknown_roots() {
		$m = new UserCommandMemory();
		$m->add_command_usage_batch( [ 'nav' => 1, 'bogus' => 99 ] );

		$this->assertSame( [ 'nav' => 1 ], $m->get_command_usage_counts() );
	}

	public function test_add_command_usage_batch_coerces_invalid_deltas() {
		$m = new UserCommandMemory();
		$m->add_command_usage_batch(
			[
				'plugin' => -5,
				'user'   => 'not-int',
				'menu'   => '4',
			]
		);

		$this->assertSame( [ 'menu' => 4 ], $m->get_command_usage_counts() );
	}

	public function test_usage_counts_leave_recent_commands_untouched() {
		$GLOBALS['flux_one_test_user_meta'][42]['_flux_one_command_memory'] = [
			'recent_commands' => [ 'plugin list' ],
		];

		$m = new UserCommandMemory();
		$m->add_command_usage_batch( [ 'nav' => 1 ] );

		$meta = $GLOBALS['flux_one_test_user_meta'][42]['_flux_one_command_memory'];
		$this->assertSame( [ 'plugin list' ], $meta['recent_commands'] );
		$this->assertSame( [ 'nav' => 1 ], $meta['command_usage_counts'] );
	}
}
