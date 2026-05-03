<?php
/**
 * EmailAggregationService ordering tests.
 *
 * @package FluxOne
 * @since 1.2.1
 */

use FluxOne\App\Services\EmailAggregationService;
use PHPUnit\Framework\TestCase;

/**
 * Stub wpdb that records prepared SQL templates and returns empty result sets.
 *
 * @since 1.2.1
 */
final class EmailAggregationServiceOrderingTest_WpdbStub {

	/** @var string */
	public $prefix = 'wp_';

	/** @var list<array{0: string, 1: array<int, mixed>}> */
	public $prepare_log = [];

	public function esc_like( $text ) {
		return str_replace( [ '\\', '%', '_' ], [ '\\\\', '\\%', '\\_' ], (string) $text );
	}

	/**
	 * @param mixed ...$args
	 * @return string
	 */
	public function prepare( $query, ...$args ) {
		$this->prepare_log[] = [ (string) $query, $args ];
		return (string) $query;
	}

	/**
	 * @param string $query
	 * @return int
	 */
	public function get_var( $query ) {
		return 0;
	}

	/**
	 * @param string $query
	 * @param string $output
	 * @return array<int, mixed>
	 */
	public function get_results( $query, $output = OBJECT ) {
		return [];
	}
}

final class EmailAggregationServiceOrderingTest extends TestCase {

	protected function tearDown(): void {
		unset( $GLOBALS['wpdb'] );
		parent::tearDown();
	}

	/**
	 * @return list<array{0: string, 1: array<int, mixed>}>
	 */
	private function run_get_report_and_get_prepare_log( array $opts ): array {
		$stub = new EmailAggregationServiceOrderingTest_WpdbStub();
		$GLOBALS['wpdb'] = $stub;

		$svc = new EmailAggregationService();
		$svc->get_report( 7, 1, $opts );

		return $stub->prepare_log;
	}

	/**
	 * @param list<array{0: string, 1: array<int, mixed>}> $log
	 */
	private function find_events_query_template( array $log ): string {
		foreach ( $log as $entry ) {
			$sql = $entry[0];
			if ( str_contains( $sql, 'LEFT JOIN' ) && str_contains( $sql, 'TRIM( s.summary )' ) ) {
				return $sql;
			}
		}
		$this->fail( 'No events query with summary ordering found in prepare() log.' );
	}

	public function test_events_query_orders_summaries_first_when_q_empty(): void {
		$log = $this->run_get_report_and_get_prepare_log(
			[
				'q'        => '',
				'page'     => 1,
				'perPage'  => 20,
			]
		);
		$sql = $this->find_events_query_template( $log );
		$this->assertStringContainsString( 'LEFT JOIN', $sql );
		$this->assertStringContainsString( 'TRIM( s.summary )', $sql );
		$this->assertStringContainsString( 'e.created_at DESC', $sql );
	}

	public function test_events_query_orders_summaries_first_when_q_set(): void {
		$log = $this->run_get_report_and_get_prepare_log(
			[
				'q'        => 'invoice',
				'page'     => 1,
				'perPage'  => 20,
			]
		);
		$sql = $this->find_events_query_template( $log );
		$this->assertStringContainsString( 'LEFT JOIN', $sql );
		$this->assertStringContainsString( 'TRIM( s.summary )', $sql );
		$this->assertStringContainsString( 'e.subject LIKE %s', $sql );
	}
}
