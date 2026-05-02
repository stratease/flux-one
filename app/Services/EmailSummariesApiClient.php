<?php
/**
 * Flux API client for email summarization batch endpoint.
 *
 * @package FluxOne
 * @since 1.3.0
 */

namespace FluxOne\App\Services;

use FluxOne\FluxPlugins\Common\Api\ExternalApiClient;
use FluxOne\FluxPlugins\Common\Logger\Logger;

/**
 * POST `/api/v1/fo/email-summaries`.
 *
 * @since 1.3.0
 */
class EmailSummariesApiClient {

	private const ROUTE = 'api/v1/fo/email-summaries';

	/**
	 * External API client.
	 *
	 * @since 1.3.0
	 * @var ExternalApiClient
	 */
	private $client;

	/**
	 * Constructor.
	 *
	 * @since 1.3.0
	 */
	public function __construct() {
		$this->client = new ExternalApiClient( Logger::get_instance() );
	}

	/**
	 * Request summaries for normalized email batch.
	 *
	 * @since 1.3.0
	 * @param string               $account_id Flux account ID.
	 * @param array<int, array<string, mixed>> $emails Email payload items.
	 * @return array{ok: bool, http_status: int|null, body: array<string, mixed>|null, error_message: string}
	 */
	public function post_email_summaries( $account_id, array $emails ) {
		$account_id = (string) $account_id;
		if ( '' === $account_id ) {
			return [
				'ok'            => false,
				'http_status'   => null,
				'body'          => null,
				'error_message' => __( 'Account ID not available.', 'flux-one' ),
			];
		}

		$result = $this->client->post(
			self::ROUTE,
			[
				'account_id' => $account_id,
				'emails'     => $emails,
			]
		);

		if ( empty( $result['success'] ) ) {
			$code = isset( $result['status_code'] ) ? (int) $result['status_code'] : null;
			$msg  = isset( $result['message'] ) ? (string) $result['message'] : __( 'Email summarization request failed.', 'flux-one' );
			return [
				'ok'            => false,
				'http_status'   => $code > 0 ? $code : null,
				'body'          => null,
				'error_message' => $msg,
			];
		}

		$data = isset( $result['data'] ) && is_array( $result['data'] ) ? $result['data'] : null;
		if ( ! is_array( $data ) ) {
			return [
				'ok'            => false,
				'http_status'   => 200,
				'body'          => null,
				'error_message' => __( 'Invalid response from summarization service.', 'flux-one' ),
			];
		}

		return [
			'ok'            => true,
			'http_status'   => 200,
			'body'          => $data,
			'error_message' => '',
		];
	}
}
