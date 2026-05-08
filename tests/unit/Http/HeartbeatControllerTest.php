<?php
/**
 * Tests for HeartbeatController.
 *
 * @package FluxOne
 * @since 1.6.0
 */

namespace FluxOne\Tests\Unit\Http;

use FluxOne\App\Http\Controllers\HeartbeatController;
use PHPUnit\Framework\TestCase;
use WP_REST_Request;

/**
 * @covers \FluxOne\App\Http\Controllers\HeartbeatController
 */
class HeartbeatControllerTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['flux_one_test_user_meta']                         = [];
		$GLOBALS['flux_one_test_current_user_id']                   = 7;
		$GLOBALS['flux_one_test_current_user_can_manage_options'] = true;
	}

	protected function tearDown(): void {
		unset(
			$GLOBALS['flux_one_test_user_meta'],
			$GLOBALS['flux_one_test_current_user_can_manage_options']
		);
		parent::tearDown();
	}

	public function test_post_heartbeat_applies_command_usage_and_filters_unknown() {
		$controller = new HeartbeatController();
		$request    = new WP_REST_Request();
		$request->set_json_params(
			[
				'commandUsage' => [
					'nav'   => 2,
					'bogus' => 5,
				],
			]
		);

		$response = $controller->post_heartbeat( $request );
		$this->assertSame( 200, $response->get_status() );

		$body = $response->get_data();
		$this->assertTrue( $body['success'] );
		$this->assertSame( 10, $body['data']['totalSecondsSaved'] );
		$this->assertSame( [ 'nav' => 2 ], $body['data']['counts'] );
	}

	public function test_post_heartbeat_accumulates_on_repeat() {
		$controller = new HeartbeatController();
		$request    = new WP_REST_Request();
		$request->set_json_params( [ 'commandUsage' => [ 'nav' => 1 ] ] );
		$controller->post_heartbeat( $request );

		$request2 = new WP_REST_Request();
		$request2->set_json_params( [ 'commandUsage' => [ 'nav' => 1 ] ] );
		$response = $controller->post_heartbeat( $request2 );

		$this->assertSame( [ 'nav' => 2 ], $response->get_data()['data']['counts'] );
		$this->assertSame( 10, $response->get_data()['data']['totalSecondsSaved'] );
	}

	public function test_post_heartbeat_empty_body_succeeds() {
		$controller = new HeartbeatController();
		$request    = new WP_REST_Request();
		$request->set_json_params( [] );

		$response = $controller->post_heartbeat( $request );
		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( [], $response->get_data()['data']['counts'] );
	}

	public function test_check_permissions_false_when_manage_options_denied() {
		$GLOBALS['flux_one_test_current_user_can_manage_options'] = false;
		$controller = new HeartbeatController();
		$this->assertFalse( $controller->check_permissions( new WP_REST_Request() ) );
	}
}
