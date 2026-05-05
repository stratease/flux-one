<?php
/**
 * Registry of Flux suite plugin settings exposed to Command Bar (`config` command).
 *
 * Only entries whose plugin is active are offered. Third-party code may append
 * definitions via {@see SuiteConfigCatalog::FILTER_DEFINITIONS}.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Services;

/**
 * Describes and reads/writes suite configuration keys for inline commands.
 *
 * @since 0.1.0
 */
final class SuiteConfigCatalog {

	/**
	 * Filter: merge or replace definitions (receive list of definition arrays).
	 *
	 * @since 0.1.0
	 */
	public const FILTER_DEFINITIONS = 'flux_one_suite_config_definitions';

	/**
	 * @return list<array<string,mixed>>
	 */
	public static function get_definitions() {
		$defs = self::core_definitions();
		/**
		 * Filters suite config definitions for the `config` command.
		 *
		 * @since 0.1.0
		 * @param array $defs List of definition arrays.
		 */
		$filtered = apply_filters( self::FILTER_DEFINITIONS, $defs );
		return is_array( $filtered ) ? $filtered : $defs;
	}

	/**
	 * Definitions for plugins that are currently active.
	 *
	 * @return list<array<string,mixed>>
	 */
	public static function get_available_definitions() {
		$out = [];
		foreach ( self::get_definitions() as $def ) {
			if ( ! is_array( $def ) || empty( $def['id'] ) || empty( $def['plugin_file'] ) ) {
				continue;
			}
			if ( self::is_plugin_available( (string) $def['plugin_file'] ) ) {
				$out[] = $def;
			}
		}
		return $out;
	}

	/**
	 * @param string $plugin_file Plugin basename (e.g. flux-one/flux-one.php).
	 */
	public static function is_plugin_available( string $plugin_file ): bool {
		if ( ! function_exists( 'is_plugin_active' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}
		return (bool) is_plugin_active( $plugin_file );
	}

	/**
	 * @param string $id Definition id.
	 * @return array<string,mixed>|null
	 */
	public static function find( string $id ) {
		$id = strtolower( trim( $id ) );
		foreach ( self::get_available_definitions() as $def ) {
			if ( strtolower( (string) $def['id'] ) === $id ) {
				return $def;
			}
		}
		return null;
	}

	/**
	 * @param array<string,mixed> $def Definition.
	 * @return mixed Raw stored value.
	 */
	public static function get_value( array $def ) {
		$h = (string) ( $def['handler'] ?? '' );
		return self::invoke_get( $h );
	}

	/**
	 * @param array<string,mixed> $def Definition.
	 * @param mixed               $value Normalized value.
	 * @return true|\WP_Error
	 */
	public static function set_value( array $def, $value ) {
		$h = (string) ( $def['handler'] ?? '' );
		return self::invoke_set( $h, $value );
	}

	/**
	 * @param mixed $raw Raw value.
	 * @return mixed|string Display-safe (secrets masked).
	 */
	public static function format_display( array $def, $raw ) {
		if ( ! empty( $def['sensitive'] ) ) {
			$s = (string) $raw;
			if ( $s === '' ) {
				return '(not set)';
			}
			return '********';
		}
		if ( is_bool( $raw ) ) {
			return $raw ? 'true' : 'false';
		}
		if ( is_array( $raw ) ) {
			return wp_json_encode( $raw );
		}
		return (string) $raw;
	}

	/**
	 * @param string $token User input.
	 * @return bool|\WP_Error
	 */
	public static function parse_bool( string $token ) {
		$t = strtolower( trim( $token ) );
		if ( in_array( $t, [ '1', 'true', 'yes', 'on', 'enable', 'enabled' ], true ) ) {
			return true;
		}
		if ( in_array( $t, [ '0', 'false', 'no', 'off', 'disable', 'disabled' ], true ) ) {
			return false;
		}
		return new \WP_Error( 'flux_one_config_bool', 'Use true/false, on/off, or 1/0.' );
	}

	/**
	 * @return int|\WP_Error
	 */
	public static function parse_int( string $token, int $min, int $max ) {
		if ( ! is_numeric( trim( $token ) ) ) {
			return new \WP_Error( 'flux_one_config_int', 'Expected a number.' );
		}
		$n = (int) $token;
		if ( $n < $min || $n > $max ) {
			return new \WP_Error( 'flux_one_config_range', "Value must be between {$min} and {$max}." );
		}
		return $n;
	}

	/**
	 * @return list<array<string,mixed>>
	 */
	private static function core_definitions() {
		return array_merge(
			self::flux_one_defs(),
			self::media_optimizer_defs(),
			self::alt_creator_defs(),
			self::alt_creator_pro_defs(),
			self::unused_media_defs(),
			self::gutenberg_defs(),
			self::audit_scanner_defs()
		);
	}

	private static function flux_one_defs() {
		return [
			[
				'id'          => 'flux_one.email_capture_enabled',
				'plugin_file' => 'flux-one/flux-one.php',
				'plugin'      => 'Flux One',
				'label'       => 'Email capture (log outbound mail for your user)',
				'type'        => 'bool',
				'handler'     => 'flux_one:email_capture_enabled',
				'search'      => 'email wp_mail log capture aggregate',
				'sensitive'   => false,
			],
			[
				'id'          => 'flux_one.suppress_mail_to_self',
				'plugin_file' => 'flux-one/flux-one.php',
				'plugin'      => 'Flux One',
				'label'       => 'Suppress your addresses on outbound mail',
				'type'        => 'bool',
				'handler'     => 'flux_one:suppress_mail_to_self',
				'search'      => 'suppress self email cancel to-self',
				'sensitive'   => false,
			],
			[
				'id'          => 'flux_one.aggregate_default_days',
				'plugin_file' => 'flux-one/flux-one.php',
				'plugin'      => 'Flux One',
				'label'       => 'Default aggregate window (days)',
				'type'        => 'int',
				'min'         => 1,
				'max'         => 30,
				'handler'     => 'flux_one:aggregate_default_days',
				'search'      => 'aggregate email days window default',
				'sensitive'   => false,
			],
		];
	}

	private static function media_optimizer_defs() {
		$p = 'flux-media-optimizer/flux-media-optimizer.php';
		return [
			[
				'id'          => 'media_optimizer.image_auto_convert',
				'plugin_file' => $p,
				'plugin'      => 'Flux Media Optimizer',
				'label'       => 'Auto-convert images',
				'type'        => 'bool',
				'handler'     => 'media_optimizer:image_auto_convert',
				'search'      => 'image webp avif convert',
				'sensitive'   => false,
			],
			[
				'id'          => 'media_optimizer.video_auto_convert',
				'plugin_file' => $p,
				'plugin'      => 'Flux Media Optimizer',
				'label'       => 'Auto-convert video',
				'type'        => 'bool',
				'handler'     => 'media_optimizer:video_auto_convert',
				'search'      => 'video av1 webm convert',
				'sensitive'   => false,
			],
			[
				'id'          => 'media_optimizer.enable_logging',
				'plugin_file' => $p,
				'plugin'      => 'Flux Media Optimizer',
				'label'       => 'Enable conversion logging',
				'type'        => 'bool',
				'handler'     => 'media_optimizer:enable_logging',
				'search'      => 'log logging debug',
				'sensitive'   => false,
			],
			[
				'id'          => 'media_optimizer.external_service_enabled',
				'plugin_file' => $p,
				'plugin'      => 'Flux Media Optimizer',
				'label'       => 'External SaaS conversion service',
				'type'        => 'bool',
				'handler'     => 'media_optimizer:external_service_enabled',
				'search'      => 'saas external api cloud',
				'sensitive'   => false,
			],
			[
				'id'          => 'media_optimizer.bulk_conversion_enabled',
				'plugin_file' => $p,
				'plugin'      => 'Flux Media Optimizer',
				'label'       => 'Bulk conversion enabled',
				'type'        => 'bool',
				'handler'     => 'media_optimizer:bulk_conversion_enabled',
				'search'      => 'bulk batch',
				'sensitive'   => false,
			],
			[
				'id'          => 'media_optimizer.image_webp_quality',
				'plugin_file' => $p,
				'plugin'      => 'Flux Media Optimizer',
				'label'       => 'WebP quality (1–100)',
				'type'        => 'int',
				'min'         => 1,
				'max'         => 100,
				'handler'     => 'media_optimizer:image_webp_quality',
				'search'      => 'webp quality',
				'sensitive'   => false,
			],
			[
				'id'          => 'media_optimizer.image_avif_quality',
				'plugin_file' => $p,
				'plugin'      => 'Flux Media Optimizer',
				'label'       => 'AVIF quality (1–100)',
				'type'        => 'int',
				'min'         => 1,
				'max'         => 100,
				'handler'     => 'media_optimizer:image_avif_quality',
				'search'      => 'avif quality',
				'sensitive'   => false,
			],
		];
	}

	private static function alt_creator_defs() {
		$p = 'flux-ai-media-alt-creator/flux-ai-media-alt-creator.php';
		return [
			[
				'id'          => 'alt_creator.auto_generate_on_upload',
				'plugin_file' => $p,
				'plugin'      => 'Flux AI Alt Text',
				'label'       => 'Auto-generate alt text on upload',
				'type'        => 'bool',
				'handler'     => 'alt_creator:auto_generate_on_upload',
				'search'      => 'alt upload automatic',
				'sensitive'   => false,
			],
			[
				'id'          => 'alt_creator.provider',
				'plugin_file' => $p,
				'plugin'      => 'Flux AI Alt Text',
				'label'       => 'Vision provider',
				'type'        => 'enum',
				'choices'     => [ 'openai', 'gemini', 'claude' ],
				'handler'     => 'alt_creator:provider',
				'search'      => 'openai gemini claude vision',
				'sensitive'   => false,
			],
			[
				'id'          => 'alt_creator.openai_api_key',
				'plugin_file' => $p,
				'plugin'      => 'Flux AI Alt Text',
				'label'       => 'OpenAI API key',
				'type'        => 'secret',
				'handler'     => 'alt_creator:openai_api_key',
				'search'      => 'openai key',
				'sensitive'   => true,
			],
			[
				'id'          => 'alt_creator.gemini_api_key',
				'plugin_file' => $p,
				'plugin'      => 'Flux AI Alt Text',
				'label'       => 'Gemini API key',
				'type'        => 'secret',
				'handler'     => 'alt_creator:gemini_api_key',
				'search'      => 'gemini google key',
				'sensitive'   => true,
			],
			[
				'id'          => 'alt_creator.claude_api_key',
				'plugin_file' => $p,
				'plugin'      => 'Flux AI Alt Text',
				'label'       => 'Claude API key',
				'type'        => 'secret',
				'handler'     => 'alt_creator:claude_api_key',
				'search'      => 'anthropic claude key',
				'sensitive'   => true,
			],
		];
	}

	private static function alt_creator_pro_defs() {
		$p = 'flux-ai-media-alt-creator-pro/flux-ai-media-alt-creator-pro.php';
		return [
			[
				'id'          => 'alt_creator_pro.auto_processing',
				'plugin_file' => $p,
				'plugin'      => 'Flux AI Alt Text Pro',
				'label'       => 'Pro: auto processing',
				'type'        => 'bool',
				'handler'     => 'alt_creator_pro:auto_processing',
				'search'      => 'pro automation batch',
				'sensitive'   => false,
			],
			[
				'id'          => 'alt_creator_pro.compliance_scan_enabled',
				'plugin_file' => $p,
				'plugin'      => 'Flux AI Alt Text Pro',
				'label'       => 'Pro: compliance scan',
				'type'        => 'bool',
				'handler'     => 'alt_creator_pro:compliance_scan_enabled',
				'search'      => 'compliance scan pro',
				'sensitive'   => false,
			],
		];
	}

	private static function unused_media_defs() {
		$p = 'flux-unused-media-cleaner/flux-unused-media-cleaner.php';
		return [
			[
				'id'          => 'unused_media.scheduled_scan_enabled',
				'plugin_file' => $p,
				'plugin'      => 'Flux Unused Media Cleaner',
				'label'       => 'Scheduled scan enabled',
				'type'        => 'bool',
				'handler'     => 'unused_media:scheduled_scan_enabled',
				'search'      => 'schedule cron scan',
				'sensitive'   => false,
			],
			[
				'id'          => 'unused_media.scan_depth',
				'plugin_file' => $p,
				'plugin'      => 'Flux Unused Media Cleaner',
				'label'       => 'Scan depth',
				'type'        => 'enum',
				'choices'     => [ 'quick', 'full' ],
				'handler'     => 'unused_media:scan_depth',
				'search'      => 'depth quick full',
				'sensitive'   => false,
			],
			[
				'id'          => 'unused_media.scheduled_scan_frequency',
				'plugin_file' => $p,
				'plugin'      => 'Flux Unused Media Cleaner',
				'label'       => 'Scheduled scan frequency',
				'type'        => 'enum',
				'choices'     => [ 'daily', 'weekly', 'monthly' ],
				'handler'     => 'unused_media:scheduled_scan_frequency',
				'search'      => 'frequency daily weekly monthly',
				'sensitive'   => false,
			],
			[
				'id'          => 'unused_media.cloud_backup_enabled',
				'plugin_file' => $p,
				'plugin'      => 'Flux Unused Media Cleaner',
				'label'       => 'Cloud backup enabled',
				'type'        => 'bool',
				'handler'     => 'unused_media:cloud_backup_enabled',
				'search'      => 'cloud backup',
				'sensitive'   => false,
			],
		];
	}

	private static function gutenberg_defs() {
		$p = 'flux-ai-gutenberg-page-builder/flux-ai-gutenberg-page-builder.php';
		$models = class_exists( '\FluxAIGutenbergPageBuilder\App\Services\Settings' )
			? \FluxAIGutenbergPageBuilder\App\Services\Settings::get_allowed_models()
			: [ 'gpt-4o-mini', 'gpt-5.3', 'gpt-5.4', 'gpt-5.2' ];
		return [
			[
				'id'          => 'gutenberg.model',
				'plugin_file' => $p,
				'plugin'      => 'Flux AI Gutenberg Page Builder',
				'label'       => 'OpenAI chat model',
				'type'        => 'enum',
				'choices'     => $models,
				'handler'     => 'gutenberg:model',
				'search'      => 'gpt model openai',
				'sensitive'   => false,
			],
			[
				'id'          => 'gutenberg.token_warning_threshold',
				'plugin_file' => $p,
				'plugin'      => 'Flux AI Gutenberg Page Builder',
				'label'       => 'Token warning threshold',
				'type'        => 'int',
				'min'         => 500,
				'max'         => 1000000,
				'handler'     => 'gutenberg:token_warning_threshold',
				'search'      => 'token warning threshold',
				'sensitive'   => false,
			],
			[
				'id'          => 'gutenberg.openai_api_key',
				'plugin_file' => $p,
				'plugin'      => 'Flux AI Gutenberg Page Builder',
				'label'       => 'OpenAI API key',
				'type'        => 'secret',
				'handler'     => 'gutenberg:openai_api_key',
				'search'      => 'openai key',
				'sensitive'   => true,
			],
		];
	}

	private static function audit_scanner_defs() {
		$p = 'flux-accessibility-audit-scanner/flux-accessibility-audit-scanner.php';
		return [
			[
				'id'          => 'audit_scanner.default_max_pages',
				'plugin_file' => $p,
				'plugin'      => 'Flux Accessibility Audit Scanner',
				'label'       => 'Default max pages per audit',
				'type'        => 'int',
				'min'         => 1,
				'max'         => 500,
				'handler'     => 'audit_scanner:default_max_pages',
				'search'      => 'audit pages limit',
				'sensitive'   => false,
			],
			[
				'id'          => 'audit_scanner.default_depth',
				'plugin_file' => $p,
				'plugin'      => 'Flux Accessibility Audit Scanner',
				'label'       => 'Default crawl depth',
				'type'        => 'int',
				'min'         => 0,
				'max'         => 20,
				'handler'     => 'audit_scanner:default_depth',
				'search'      => 'depth crawl',
				'sensitive'   => false,
			],
			[
				'id'          => 'audit_scanner.pages_per_batch',
				'plugin_file' => $p,
				'plugin'      => 'Flux Accessibility Audit Scanner',
				'label'       => 'Pages per batch',
				'type'        => 'int',
				'min'         => 1,
				'max'         => 50,
				'handler'     => 'audit_scanner:pages_per_batch',
				'search'      => 'batch pages',
				'sensitive'   => false,
			],
		];
	}

	private static function invoke_get( string $handler ) {
		switch ( $handler ) {
			case 'flux_one:email_capture_enabled':
				return FluxOneSettings::is_email_capture_enabled_for_user( get_current_user_id() );
			case 'flux_one:suppress_mail_to_self':
				return FluxOneSettings::is_suppress_mail_enabled_for_user( get_current_user_id() );
			case 'flux_one:aggregate_default_days':
				return FluxOneSettings::get_aggregate_default_days();
		}

		if ( class_exists( '\FluxMedia\App\Services\Settings' ) ) {
			switch ( $handler ) {
				case 'media_optimizer:image_auto_convert':
					return (bool) \FluxMedia\App\Services\Settings::get( 'image_auto_convert' );
				case 'media_optimizer:video_auto_convert':
					return (bool) \FluxMedia\App\Services\Settings::get( 'video_auto_convert' );
				case 'media_optimizer:enable_logging':
					return (bool) \FluxMedia\App\Services\Settings::get( 'enable_logging' );
				case 'media_optimizer:external_service_enabled':
					return (bool) \FluxMedia\App\Services\Settings::get( 'external_service_enabled' );
				case 'media_optimizer:bulk_conversion_enabled':
					return (bool) \FluxMedia\App\Services\Settings::get( 'bulk_conversion_enabled' );
				case 'media_optimizer:image_webp_quality':
					return (int) \FluxMedia\App\Services\Settings::get( 'image_webp_quality' );
				case 'media_optimizer:image_avif_quality':
					return (int) \FluxMedia\App\Services\Settings::get( 'image_avif_quality' );
			}
		}

		$opt = 'flux_ai_alt_creator_settings';
		if ( class_exists( '\FluxAIMediaAltCreator\App\Services\Settings' ) ) {
			switch ( $handler ) {
				case 'alt_creator:auto_generate_on_upload':
					return \FluxAIMediaAltCreator\App\Services\Settings::get_auto_generate_on_upload();
				case 'alt_creator:provider':
					return \FluxAIMediaAltCreator\App\Services\Settings::get_vision_provider();
				case 'alt_creator:openai_api_key':
					return (string) \FluxAIMediaAltCreator\App\Services\Settings::get_openai_api_key();
				case 'alt_creator:gemini_api_key':
					$s = get_option( $opt, [] );
					return is_array( $s ) ? (string) ( $s['gemini_api_key'] ?? '' ) : '';
				case 'alt_creator:claude_api_key':
					$s = get_option( $opt, [] );
					return is_array( $s ) ? (string) ( $s['claude_api_key'] ?? '' ) : '';
			}
		}

		switch ( $handler ) {
			case 'alt_creator_pro:auto_processing':
				return (bool) get_option( 'flux_ai_alt_creator_pro_auto_processing', false );
			case 'alt_creator_pro:compliance_scan_enabled':
				return (bool) get_option( 'flux_ai_alt_creator_pro_compliance_scan_enabled', false );
		}

		if ( class_exists( '\FluxUnusedMedia\App\Services\Settings' ) ) {
			switch ( $handler ) {
				case 'unused_media:scheduled_scan_enabled':
					return \FluxUnusedMedia\App\Services\Settings::get_scheduled_scan_enabled();
				case 'unused_media:scan_depth':
					return (string) \FluxUnusedMedia\App\Services\Settings::get_scan_depth();
				case 'unused_media:scheduled_scan_frequency':
					return (string) \FluxUnusedMedia\App\Services\Settings::get_scheduled_scan_frequency();
				case 'unused_media:cloud_backup_enabled':
					return \FluxUnusedMedia\App\Services\Settings::get_cloud_backup_enabled();
			}
		}

		if ( class_exists( '\FluxAIGutenbergPageBuilder\App\Services\Settings' ) ) {
			$gs = new \FluxAIGutenbergPageBuilder\App\Services\Settings();
			switch ( $handler ) {
				case 'gutenberg:model':
					return $gs->get_model();
				case 'gutenberg:token_warning_threshold':
					return (int) $gs->get( 'token_warning_threshold', 4000 );
				case 'gutenberg:openai_api_key':
					return (string) $gs->get( 'openai_api_key', '' );
			}
		}

		if ( class_exists( '\FluxAccessibilityAuditScanner\Services\SettingsService' ) ) {
			$svc = new \FluxAccessibilityAuditScanner\Services\SettingsService();
			switch ( $handler ) {
				case 'audit_scanner:default_max_pages':
					return (int) $svc->get_value( 'default_max_pages' );
				case 'audit_scanner:default_depth':
					return (int) $svc->get_value( 'default_depth' );
				case 'audit_scanner:pages_per_batch':
					return (int) $svc->get_value( 'pages_per_batch' );
			}
		}

		return null;
	}

	/**
	 * @param mixed $value Normalized.
	 * @return true|\WP_Error
	 */
	private static function invoke_set( string $handler, $value ) {
		switch ( $handler ) {
			case 'flux_one:email_capture_enabled':
				FluxOneSettings::update_from_array( [ 'emailCaptureEnabled' => (bool) $value ] );
				return true;
			case 'flux_one:suppress_mail_to_self':
				FluxOneSettings::update_from_array( [ 'suppressMailToSelf' => (bool) $value ] );
				return true;
			case 'flux_one:aggregate_default_days':
				$d = max( 1, min( 30, (int) $value ) );
				FluxOneSettings::update_from_array( [ 'aggregateDefaultDays' => $d ] );
				return true;
		}

		if ( class_exists( '\FluxMedia\App\Services\Settings' ) ) {
			$key_map = [
				'media_optimizer:image_auto_convert'       => 'image_auto_convert',
				'media_optimizer:video_auto_convert'       => 'video_auto_convert',
				'media_optimizer:enable_logging'           => 'enable_logging',
				'media_optimizer:external_service_enabled'   => 'external_service_enabled',
				'media_optimizer:bulk_conversion_enabled'    => 'bulk_conversion_enabled',
				'media_optimizer:image_webp_quality'         => 'image_webp_quality',
				'media_optimizer:image_avif_quality'         => 'image_avif_quality',
			];
			if ( isset( $key_map[ $handler ] ) ) {
				\FluxMedia\App\Services\Settings::update( [ $key_map[ $handler ] => $value ] );
				return true;
			}
		}

		if ( class_exists( '\FluxAIMediaAltCreator\App\Services\Settings' ) ) {
			$settings = new \FluxAIMediaAltCreator\App\Services\Settings();
			switch ( $handler ) {
				case 'alt_creator:auto_generate_on_upload':
					$settings->update( [ 'auto_generate_on_upload' => (bool) $value ] );
					return true;
				case 'alt_creator:provider':
					$v = sanitize_key( (string) $value );
					if ( ! in_array( $v, [ 'openai', 'gemini', 'claude' ], true ) ) {
						return new \WP_Error( 'flux_one_config_enum', 'Provider must be openai, gemini, or claude.' );
					}
					$settings->update( [ 'provider' => $v ] );
					return true;
				case 'alt_creator:openai_api_key':
					\FluxAIMediaAltCreator\App\Services\Settings::set_openai_api_key( (string) $value );
					return true;
				case 'alt_creator:gemini_api_key':
					$settings->update( [ 'gemini_api_key' => (string) $value ] );
					return true;
				case 'alt_creator:claude_api_key':
					$settings->update( [ 'claude_api_key' => (string) $value ] );
					return true;
			}
		}

		switch ( $handler ) {
			case 'alt_creator_pro:auto_processing':
				update_option( 'flux_ai_alt_creator_pro_auto_processing', (bool) $value, false );
				return true;
			case 'alt_creator_pro:compliance_scan_enabled':
				update_option( 'flux_ai_alt_creator_pro_compliance_scan_enabled', (bool) $value, false );
				return true;
		}

		if ( class_exists( '\FluxUnusedMedia\App\Services\Settings' ) ) {
			switch ( $handler ) {
				case 'unused_media:scheduled_scan_enabled':
					\FluxUnusedMedia\App\Services\Settings::set_scheduled_scan_enabled( (bool) $value );
					return true;
				case 'unused_media:scan_depth':
					$d = sanitize_key( (string) $value );
					if ( ! in_array( $d, [ 'quick', 'full' ], true ) ) {
						return new \WP_Error( 'flux_one_config_enum', 'scan_depth must be quick or full.' );
					}
					\FluxUnusedMedia\App\Services\Settings::set_scan_depth( $d );
					return true;
				case 'unused_media:scheduled_scan_frequency':
					$f = sanitize_key( (string) $value );
					if ( ! in_array( $f, [ 'daily', 'weekly', 'monthly' ], true ) ) {
						return new \WP_Error( 'flux_one_config_enum', 'Frequency must be daily, weekly, or monthly.' );
					}
					\FluxUnusedMedia\App\Services\Settings::set_scheduled_scan_frequency( $f );
					return true;
				case 'unused_media:cloud_backup_enabled':
					\FluxUnusedMedia\App\Services\Settings::set_cloud_backup_enabled( (bool) $value );
					return true;
			}
		}

		if ( class_exists( '\FluxAIGutenbergPageBuilder\App\Services\Settings' ) ) {
			$gs = new \FluxAIGutenbergPageBuilder\App\Services\Settings();
			switch ( $handler ) {
				case 'gutenberg:model':
					$m = \FluxAIGutenbergPageBuilder\App\Services\Settings::normalize_model( (string) $value );
					$gs->update( [ 'model' => $m ] );
					return true;
				case 'gutenberg:token_warning_threshold':
					$gs->update( [ 'token_warning_threshold' => (int) $value ] );
					return true;
				case 'gutenberg:openai_api_key':
					$gs->update( [ 'openai_api_key' => (string) $value ] );
					return true;
			}
		}

		if ( class_exists( '\FluxAccessibilityAuditScanner\Services\SettingsService' ) ) {
			$svc = new \FluxAccessibilityAuditScanner\Services\SettingsService();
			switch ( $handler ) {
				case 'audit_scanner:default_max_pages':
				case 'audit_scanner:default_depth':
				case 'audit_scanner:pages_per_batch':
					$key         = str_replace( 'audit_scanner:', '', $handler );
					$cur         = $svc->get();
					$cur[ $key ] = (int) $value;
					$sanitized   = $svc->sanitize( $cur );
					update_option( \FluxAccessibilityAuditScanner\Services\SettingsService::OPTION_KEY, $sanitized, false );
					return true;
			}
		}

		return new \WP_Error( 'flux_one_config_handler', 'Setting is not writable.' );
	}
}
