<?php
/**
 * Flux One site options for email capture and aggregation defaults.
 *
 * ## Plan (Command Central + suite)
 *
 * - **This class** remains the single source of truth for Flux One’s own options
 *   (see constants below). Values are exposed via REST (`SettingsController`) and
 *   mirrored in the inline **`config`** command through {@see SuiteConfigCatalog}
 *   (ids: `flux_one.*`).
 * - **Suite-wide settings** live in each plugin’s `Settings` service / options;
 *   {@see SuiteConfigCatalog} lists keys for every Flux suite plugin in this repo
 *   that should be discoverable from Command Central. Entries are **omitted until
 *   the plugin is active** (`is_plugin_active`).
 * - **Extending:** other plugins (or custom code) can add definitions with
 *   `add_filter( \FluxOne\App\Services\SuiteConfigCatalog::FILTER_DEFINITIONS, … )`
 *   (hook tag: `flux_one_suite_config_definitions`) using the same shape as core
 *   definitions (`id`, `plugin_file`, `label`, `type`, `handler`, …).
 * - **Secrets:** API keys are type `secret` in the catalog; `config list` masks them.
 *   `config set` passes the raw value from the original command (case preserved).
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Services;

/**
 * Option names and helpers for Command Central email features.
 *
 * @since 0.1.0
 */
class FluxOneSettings {

	/**
	 * When false, skip logging outbound mail (wp_mail filter short-circuits before insert).
	 *
	 * @since 0.1.0
	 */
	public const OPTION_EMAIL_CAPTURE_ENABLED = 'flux_one_email_capture_enabled';

	/**
	 * When true, cancel wp_mail when the current user's email appears in To (after logging).
	 *
	 * @since 0.1.0
	 */
	public const OPTION_SUPPRESS_MAIL_TO_SELF = 'flux_one_suppress_mail_to_self';

	/**
	 * Default window in days for aggregate UI (max 30, enforced server-side).
	 *
	 * @since 0.1.0
	 */
	public const OPTION_AGGREGATE_DEFAULT_DAYS = 'flux_one_aggregate_default_days';

	/**
	 * Register WordPress settings (for discoverability; REST is authoritative for updates).
	 *
	 * @since 0.1.0
	 * @return void
	 */
	public static function register_settings() {
		register_setting(
			'flux_one_settings',
			self::OPTION_EMAIL_CAPTURE_ENABLED,
			[
				'type'              => 'boolean',
				'default'           => true,
				'sanitize_callback' => static function ( $v ) {
					return (bool) $v;
				},
			]
		);

		register_setting(
			'flux_one_settings',
			self::OPTION_SUPPRESS_MAIL_TO_SELF,
			[
				'type'              => 'boolean',
				'default'           => false,
				'sanitize_callback' => static function ( $v ) {
					return (bool) $v;
				},
			]
		);

		register_setting(
			'flux_one_settings',
			self::OPTION_AGGREGATE_DEFAULT_DAYS,
			[
				'type'              => 'integer',
				'default'           => 7,
				'sanitize_callback' => static function ( $v ) {
					$n = (int) $v;
					return max( 1, min( 30, $n ) );
				},
			]
		);
	}

	/**
	 * Public shape for REST and admin UI.
	 *
	 * @since 0.1.0
	 * @return array
	 */
	public static function get_all() {
		return [
			'emailCaptureEnabled'   => self::is_email_capture_enabled(),
			'suppressMailToSelf'    => self::is_suppress_mail_to_self_enabled(),
			'aggregateDefaultDays'  => self::get_aggregate_default_days(),
		];
	}

	/**
	 * Merge partial update (only known keys).
	 *
	 * @since 0.1.0
	 * @param array $patch Patch.
	 * @return array Updated public shape.
	 */
	public static function update_from_array( $patch ) {
		$patch = is_array( $patch ) ? $patch : [];

		if ( array_key_exists( 'emailCaptureEnabled', $patch ) ) {
			update_option( self::OPTION_EMAIL_CAPTURE_ENABLED, (bool) $patch['emailCaptureEnabled'], false );
		}
		if ( array_key_exists( 'suppressMailToSelf', $patch ) ) {
			update_option( self::OPTION_SUPPRESS_MAIL_TO_SELF, (bool) $patch['suppressMailToSelf'], false );
		}
		if ( array_key_exists( 'aggregateDefaultDays', $patch ) ) {
			$d = (int) $patch['aggregateDefaultDays'];
			$d = max( 1, min( 30, $d ) );
			update_option( self::OPTION_AGGREGATE_DEFAULT_DAYS, $d, false );
		}

		return self::get_all();
	}

	/**
	 * Whether wp_mail events are logged.
	 *
	 * @since 0.1.0
	 * @return bool
	 */
	public static function is_email_capture_enabled() {
		return (bool) get_option( self::OPTION_EMAIL_CAPTURE_ENABLED, true );
	}

	/**
	 * Whether to block sends addressed to the logged-in user (after logging).
	 *
	 * @since 0.1.0
	 * @return bool
	 */
	public static function is_suppress_mail_to_self_enabled() {
		return (bool) get_option( self::OPTION_SUPPRESS_MAIL_TO_SELF, false );
	}

	/**
	 * Default aggregate window (days).
	 *
	 * @since 0.1.0
	 * @return int
	 */
	public static function get_aggregate_default_days() {
		$d = (int) get_option( self::OPTION_AGGREGATE_DEFAULT_DAYS, 7 );
		return max( 1, min( 30, $d ) );
	}
}
