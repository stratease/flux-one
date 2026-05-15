<?php
/**
 * Tests content index rows include viewUrl.
 *
 * @package FluxOne
 * @since 1.6.3
 */

use FluxOne\App\Http\Controllers\IndexController;
use PHPUnit\Framework\TestCase;

/**
 * Minimal wpdb stub for {@see IndexController::content()}.
 */
final class Flux_One_Test_Wpdb_Mock {
	public $posts = 'wp_posts';

	public function esc_like( $text ) {
		return str_replace( [ '\\', '%', '_' ], [ '\\\\', '\\%', '\\_' ], (string) $text );
	}

	public function prepare( $query, ...$args ) {
		return (string) $query;
	}

	/** @var array<int, array<string, mixed>>|null */
	public $flux_results = null;

	public function get_results( $query, $output = OBJECT ) {
		return is_array( $this->flux_results ) ? $this->flux_results : [];
	}
}

final class IndexControllerContentViewUrlTest extends TestCase {

	/** @var \Flux_One_Test_Wpdb_Mock|null */
	private $wpdb_mock;

	protected function setUp(): void {
		global $wpdb;
		$this->wpdb_mock = new Flux_One_Test_Wpdb_Mock();
		$wpdb             = $this->wpdb_mock;
	}

	protected function tearDown(): void {
		global $wpdb;
		$wpdb = null;
		unset(
			$GLOBALS['flux_one_test_edit_post_caps'],
			$GLOBALS['flux_one_test_public_post'],
			$GLOBALS['flux_one_test_permalinks'],
			$GLOBALS['flux_one_test_preview_links']
		);
		parent::tearDown();
	}

	public function test_content_includes_view_url_for_public_post(): void {
		$this->wpdb_mock->flux_results = [
			[
				'ID'          => 101,
				'post_title'  => 'Hello',
				'post_name'   => 'hello',
				'post_type'   => 'post',
			],
		];
		$GLOBALS['flux_one_test_edit_post_caps'] = [ 101 => true ];
		$GLOBALS['flux_one_test_public_post']     = [ 101 => true ];
		$GLOBALS['flux_one_test_permalinks']      = [ 101 => 'https://example.test/post/hello/' ];

		$req = new WP_REST_Request( 'GET', '/flux-one/v1/index/content' );
		$req->set_param( 'q', 'hello' );
		$req->set_param( 'kind', 'any' );

		$ctrl = new IndexController();
		$res  = $ctrl->content( $req );
		$data = $res->get_data();

		$this->assertTrue( (bool) ( $data['success'] ?? false ) );
		$rows = $data['data'] ?? [];
		$this->assertCount( 1, $rows );
		$this->assertSame( 'https://example.test/post/hello/', (string) ( $rows[0]['viewUrl'] ?? '' ) );
		$this->assertNotEmpty( (string) ( $rows[0]['editUrl'] ?? '' ) );
	}

	public function test_content_uses_preview_when_not_public(): void {
		$this->wpdb_mock->flux_results = [
			[
				'ID'          => 202,
				'post_title'  => 'Drafty',
				'post_name'   => 'drafty',
				'post_type'   => 'page',
			],
		];
		$GLOBALS['flux_one_test_edit_post_caps'] = [ 202 => true ];
		$GLOBALS['flux_one_test_public_post']     = [ 202 => false ];
		$GLOBALS['flux_one_test_preview_links']   = [ 202 => 'https://example.test/?page_id=202&preview=true' ];

		$req = new WP_REST_Request( 'GET', '/flux-one/v1/index/content' );
		$req->set_param( 'q', 'draft' );
		$req->set_param( 'kind', 'page' );

		$ctrl = new IndexController();
		$res  = $ctrl->content( $req );
		$data = $res->get_data();
		$rows = $data['data'] ?? [];

		$this->assertCount( 1, $rows );
		$this->assertSame( 'https://example.test/?page_id=202&preview=true', (string) ( $rows[0]['viewUrl'] ?? '' ) );
	}
}
