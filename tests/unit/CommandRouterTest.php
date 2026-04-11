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
}

