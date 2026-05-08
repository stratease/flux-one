<?php
/**
 * Tests for BootstrapCommandUsagePayload.
 *
 * @package FluxOne
 * @since 1.6.0
 */

namespace FluxOne\Tests\Unit\Services;

use FluxOne\App\Services\BootstrapCommandUsagePayload;
use FluxOne\App\Services\UserCommandMemory;
use PHPUnit\Framework\TestCase;

/**
 * @covers \FluxOne\App\Services\BootstrapCommandUsagePayload
 */
class BootstrapCommandUsagePayloadTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['flux_one_test_user_meta']               = [];
		$GLOBALS['flux_one_test_current_user_id']        = 5;
	}

	protected function tearDown(): void {
		unset( $GLOBALS['flux_one_test_user_meta'] );
		parent::tearDown();
	}

	public function test_build_includes_counts_estimates_and_total() {
		$GLOBALS['flux_one_test_user_meta'][5]['_flux_one_command_memory'] = [
			'command_usage_counts' => [ 'nav' => 2 ],
		];

		$m       = new UserCommandMemory();
		$payload = BootstrapCommandUsagePayload::build( $m );

		$this->assertSame( [ 'nav' => 2 ], $payload['counts'] );
		$this->assertSame( 10, $payload['totalSecondsSaved'] );
		$this->assertArrayHasKey( 'nav', $payload['estimatesSeconds'] );
		$this->assertSame( 5, $payload['estimatesSeconds']['nav'] );
	}
}
