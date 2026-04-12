<?php
/**
 * CommandRouter unit tests.
 *
 * @package FluxOne
 * @since 0.1.0
 */

use FluxOne\App\Services\CommandRouter;
use PHPUnit\Framework\TestCase;

final class CommandRouterTest extends TestCase {

	public function test_summary_email_routes_to_aggregate_panel_with_ai_requested(): void {
		$router = new CommandRouter();
		$result = $router->handle( 'summary email' );

		$this->assertSame( 'panel', $result['type'] );
		$this->assertSame( 'aggregate_email', $result['panelId'] );
		$this->assertSame( 'summary email', $result['command'] );
		$this->assertTrue( (bool) ( $result['data']['aiRequested'] ?? false ) );
	}

	public function test_aggregate_email_routes_to_aggregate_panel_without_ai(): void {
		$router = new CommandRouter();
		$result = $router->handle( 'aggregate email' );

		$this->assertSame( 'panel', $result['type'] );
		$this->assertSame( 'aggregate_email', $result['panelId'] );
		$this->assertSame( 'aggregate email', $result['command'] );
		$this->assertFalse( (bool) ( $result['data']['aiRequested'] ?? true ) );
	}

	public function test_email_aggregate_alias_canonicalizes_to_aggregate_email(): void {
		$router = new CommandRouter();
		$result = $router->handle( 'email aggregate' );

		$this->assertSame( 'panel', $result['type'] );
		$this->assertSame( 'aggregate_email', $result['panelId'] );
		$this->assertSame( 'aggregate email', $result['command'] );
	}

	public function test_aggregate_emails_alias_canonicalizes_to_aggregate_email(): void {
		$router = new CommandRouter();
		$result = $router->handle( 'aggregate emails' );

		$this->assertSame( 'panel', $result['type'] );
		$this->assertSame( 'aggregate_email', $result['panelId'] );
		$this->assertSame( 'aggregate email', $result['command'] );
	}

	public function test_email_summary_alias_canonicalizes_to_summary_email(): void {
		$router = new CommandRouter();
		$result = $router->handle( 'email summary' );

		$this->assertSame( 'panel', $result['type'] );
		$this->assertSame( 'aggregate_email', $result['panelId'] );
		$this->assertSame( 'summary email', $result['command'] );
		$this->assertTrue( (bool) ( $result['data']['aiRequested'] ?? false ) );
	}

	public function test_nav_dashboard_returns_navigation(): void {
		$router = new CommandRouter();
		$result = $router->handle( 'nav dashboard' );

		$this->assertSame( 'navigation', $result['type'] );
		$this->assertArrayHasKey( 'url', $result['data'] );
		$this->assertStringContainsString( 'wp-admin', (string) $result['data']['url'] );
	}

	public function test_open_alias_normalizes_to_nav(): void {
		$router = new CommandRouter();
		$result = $router->handle( 'open settings' );

		$this->assertSame( 'navigation', $result['type'] );
		$this->assertStringContainsString( 'options-general', (string) $result['data']['url'] );
	}

	public function test_bare_plugin_returns_hint_error(): void {
		$router = new CommandRouter();
		$result = $router->handle( 'plugin' );

		$this->assertSame( 'error', $result['type'] );
		$this->assertStringContainsString( 'plugin list', strtolower( (string) $result['message'] ) );
	}

	public function test_user_lock_and_lock_user_alias_same_outcome(): void {
		$router  = new CommandRouter();
		$email   = 'flux-one-lock-alias-test-' . uniqid( '', true ) . '@example.com';
		$primary = $router->handle( 'user lock ' . $email );
		$alias   = $router->handle( 'lock user ' . $email );

		$this->assertSame( $primary['type'], $alias['type'] );
		$this->assertSame( $primary['command'] ?? '', $alias['command'] ?? '' );
	}

	public function test_user_unlock_and_unlock_user_alias_same_outcome(): void {
		$router  = new CommandRouter();
		$email   = 'flux-one-unlock-alias-test-' . uniqid( '', true ) . '@example.com';
		$primary = $router->handle( 'user unlock ' . $email );
		$alias   = $router->handle( 'unlock user ' . $email );

		$this->assertSame( $primary['type'], $alias['type'] );
		$this->assertSame( $primary['command'] ?? '', $alias['command'] ?? '' );
	}

	public function test_config_list_returns_suite_config_panel(): void {
		$router = new CommandRouter();
		$result = $router->handle( 'config list' );

		$this->assertSame( 'panel', $result['type'] );
		$this->assertSame( 'suite_config', $result['panelId'] );
		$this->assertIsArray( $result['data'] ?? null );
	}

	public function test_user_role_set_and_role_set_alias_same_outcome(): void {
		$router  = new CommandRouter();
		$email   = 'flux-one-role-alias-test-' . uniqid( '', true ) . '@example.com';
		$primary = $router->handle( 'user role set ' . $email . ' author' );
		$alias   = $router->handle( 'role set ' . $email . ' author' );

		$this->assertSame( $primary['type'], $alias['type'] );
		$this->assertSame( $primary['command'] ?? '', $alias['command'] ?? '' );
	}
}

