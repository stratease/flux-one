<?php
/**
 * Flux API client for email summarization batch endpoint.
 *
 * @package FluxOne
 * @since 1.3.0
 * @since 1.4.1 Per-call 60s timeout, compatibility gate, and structured logging for failures.
 */

namespace FluxOne\App\Services;

// @since 1.5.1 Guard against direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use FluxOne\FluxPlugins\Common\Account\AccountIdService;
use FluxOne\FluxPlugins\Common\Api\ExternalApiClient;
use FluxOne\FluxPlugins\Common\Logger\Logger;
use FluxOne\FluxPlugins\Common\Services\CompatibilityService;

/**
 * POST `/api/v1/fo/email-summaries`.
 *
 * @since 1.3.0
 * @since 1.4.1 Longer HTTP timeout and compatibility gate before outbound calls.
 */
class EmailSummariesApiClient {

	private const ROUTE = 'api/v1/fo/email-summaries';

	/**
	 * HTTP timeout (seconds) for AI summarization batch requests.
	 *
	 * @since 1.4.1
	 */
	private const REQUEST_TIMEOUT_SECONDS = 60;

	/**
	 * External API client.
	 *
	 * @since 1.3.0
	 * @var ExternalApiClient
	 */
	private $client;

	/**
	 * Suite logger.
	 *
	 * @since 1.4.1
	 * @var Logger
	 */
	private $logger;

	/**
	 * Constructor.
	 *
	 * @since 1.3.0
	 * @since 1.4.1 Use dedicated timeout for summarization requests.
	 */
	public function __construct() {
		$this->logger = Logger::get_instance();
		$this->client = new ExternalApiClient( $this->logger, null, self::REQUEST_TIMEOUT_SECONDS );
	}

	/**
	 * Request summaries for normalized email batch.
	 *
	 * @since 1.3.0
	 * @since 1.4.1 Compatibility gate and failure logging.
	 * @param string               $account_id Flux account ID.
	 * @param array<int, array<string, mixed>> $emails Email payload items.
	 * @return array{ok: bool, http_status: int|null, body: array<string, mixed>|null, error_message: string}
	 */
	public function post_email_summaries( $account_id, array $emails ) {
		$email_count = count( $emails );

		$validator = CompatibilityService::get_validator();
		if ( $validator !== null ) {
			$validator->check_compatibility();
			if ( $validator->should_block_operations() ) {
				$this->logger->warning(
					'Email summaries blocked by compatibility gate.',
					[
						'route'       => self::ROUTE,
						'email_count' => $email_count,
					]
				);
				return [
					'ok'            => false,
					'http_status'   => null,
					'body'          => null,
					'error_message' => __( 'Compatibility check failed. Please update Flux One.', 'flux-one-command-bar' ),
				];
			}
		}

		$account_id = (string) $account_id;
		if ( '' === $account_id ) {
			$this->logger->warning(
				'Email summaries request skipped: account ID missing.',
				[
					'route'       => self::ROUTE,
					'email_count' => $email_count,
				]
			);
			return [
				'ok'            => false,
				'http_status'   => null,
				'body'          => null,
				'error_message' => __( 'Account ID not available.', 'flux-one-command-bar' ),
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
			$msg  = isset( $result['message'] ) ? (string) $result['message'] : __( 'Email summarization request failed.', 'flux-one-command-bar' );
			$err  = isset( $result['error'] ) ? (string) $result['error'] : '';
			$this->logger->warning(
				'Email summaries API request failed.',
				[
					'route'            => self::ROUTE,
					'email_count'      => $email_count,
					'http_status'      => $code > 0 ? $code : null,
					'error_code'       => $err,
					'account_id'       => AccountIdService::get_instance()->obfuscate_account_id(),
					'error_message'    => $msg,
				]
			);
			return [
				'ok'            => false,
				'http_status'   => $code > 0 ? $code : null,
				'body'          => null,
				'error_message' => $msg,
			];
		}

		$data = isset( $result['data'] ) && is_array( $result['data'] ) ? $result['data'] : null;
		if ( ! is_array( $data ) ) {
			$this->logger->warning(
				'Email summaries API returned invalid response shape (expected data object).',
				[
					'route'       => self::ROUTE,
					'email_count' => $email_count,
					'account_id'  => AccountIdService::get_instance()->obfuscate_account_id(),
				]
			);
			return [
				'ok'            => false,
				'http_status'   => 200,
				'body'          => null,
				'error_message' => __( 'Invalid response from summarization service.', 'flux-one-command-bar' ),
			];
		}

		$this->logger->debug(
			'Email summaries OK.',
			[
				'route'       => self::ROUTE,
				'email_count' => $email_count,
			]
		);

		return [
			'ok'            => true,
			'http_status'   => 200,
			'body'          => $data,
			'error_message' => '',
		];
	}
}
