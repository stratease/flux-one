<?php
/**
 * EmailAggregationService pagination meta tests.
 *
 * @package FluxOne
 * @since 1.5.0
 */

use FluxOne\App\Services\EmailAggregationService;
use PHPUnit\Framework\TestCase;

/**
 * Stub wpdb that records prepare() args and allows configuring COUNT(1) result.
 *
 * @since 1.5.0
 */
final class EmailAggregationServicePaginationMetaTest_WpdbStub {

	/** @var string */
	public $prefix = 'wp_';

	/** @var int */
	public $count_total = 0;

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
		return (int) $this->count_total;
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

final class EmailAggregationServicePaginationMetaTest extends TestCase {

	protected function tearDown(): void {
		unset( $GLOBALS['wpdb'] );
		parent::tearDown();
	}

	/**
	 * @return array{0: array<string, mixed>, 1: list<array{0: string, 1: array<int, mixed>}>}
	 */
	private function run_get_report_with_count_and_get_log( int $count_total, array $opts ): array {
		$stub              = new EmailAggregationServicePaginationMetaTest_WpdbStub();
		$stub->count_total = $count_total;
		$GLOBALS['wpdb']   = $stub;

		$svc    = new EmailAggregationService();
		$report = $svc->get_report( 7, 1, $opts );

		return [ is_array( $report ) ? $report : [], $stub->prepare_log ];
	}

	/**
	 * @param list<array{0: string, 1: array<int, mixed>}> $log
	 * @return array<int, mixed> Args passed to prepare() for events query.
	 */
	private function find_events_query_args( array $log ): array {
		foreach ( $log as $entry ) {
			$sql  = (string) $entry[0];
			$args = $entry[1];
			if ( str_contains( $sql, 'LEFT JOIN' ) && str_contains( $sql, 'LIMIT %d OFFSET %d' ) ) {
				// EmailAggregationService passes merged args as a single array arg to prepare().
				if ( isset( $args[0] ) && is_array( $args[0] ) ) {
					return $args[0];
				}
				return $args;
			}
		}
		$this->fail( 'No events query with LIMIT/OFFSET found in prepare() log.' );
	}

	public function test_meta_page_and_total_pages_for_middle_page(): void {
		[ $report, $log ] = $this->run_get_report_with_count_and_get_log(
			45,
			[
				'q'       => '',
				'page'    => 2,
				'perPage' => 20,
			]
		);

		$meta = isset( $report['meta'] ) && is_array( $report['meta'] ) ? $report['meta'] : [];
		$this->assertSame( 2, (int) ( $meta['page'] ?? 0 ) );
		$this->assertSame( 3, (int) ( $meta['totalPages'] ?? 0 ) );
		$this->assertSame( 45, (int) ( $meta['total'] ?? 0 ) );
		$this->assertSame( 20, (int) ( $meta['perPage'] ?? 0 ) );

		$args = $this->find_events_query_args( $log );
		$limit  = (int) ( $args[ count( $args ) - 2 ] ?? -1 );
		$offset = (int) ( $args[ count( $args ) - 1 ] ?? -1 );
		$this->assertSame( 20, $limit );
		$this->assertSame( 20, $offset );
	}

	public function test_page_is_clamped_to_last_page_when_out_of_range(): void {
		[ $report, $log ] = $this->run_get_report_with_count_and_get_log(
			45,
			[
				'q'       => 'invoice',
				'page'    => 99,
				'perPage' => 20,
			]
		);

		$meta = isset( $report['meta'] ) && is_array( $report['meta'] ) ? $report['meta'] : [];
		$this->assertSame( 3, (int) ( $meta['page'] ?? 0 ) );
		$this->assertSame( 3, (int) ( $meta['totalPages'] ?? 0 ) );

		$args = $this->find_events_query_args( $log );
		$limit  = (int) ( $args[ count( $args ) - 2 ] ?? -1 );
		$offset = (int) ( $args[ count( $args ) - 1 ] ?? -1 );
		$this->assertSame( 20, $limit );
		$this->assertSame( 40, $offset );
	}
}

