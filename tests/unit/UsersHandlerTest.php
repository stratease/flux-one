<?php
/**
 * UsersHandler unit tests.
 *
 * @package FluxOne
 * @since 1.4.0
 */

use FluxOne\App\Services\CommandHandlers\UsersHandler;
use PHPUnit\Framework\TestCase;

final class UsersHandlerTest extends TestCase {

	public function test_email_as_first_token_is_unknown_command_not_user_panel(): void {
		$handler = new UsersHandler();
		$result  = $handler->handle( [ 'operator@example.com' ] );

		$this->assertSame( 'error', $result['type'] );
		$this->assertStringContainsString( 'user list', strtolower( (string) ( $result['message'] ?? '' ) ) );
	}

	public function test_lock_own_account_returns_error(): void {
		$user = new WP_User();
		$user->ID           = 7;
		$user->user_email   = 'self@example.com';
		$GLOBALS['flux_one_test_get_user_by_user'] = $user;
		$GLOBALS['flux_one_test_current_user_id']   = 7;

		$handler = new UsersHandler();
		$result  = $handler->handle( [ 'lock', 'self@example.com' ] );

		unset( $GLOBALS['flux_one_test_get_user_by_user'], $GLOBALS['flux_one_test_current_user_id'] );

		$this->assertSame( 'error', $result['type'] );
		$this->assertSame( 'flux_one_user_lock_self', (string) ( $result['error_code'] ?? '' ) );
	}
}
