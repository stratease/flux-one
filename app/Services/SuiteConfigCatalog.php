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

// @since 1.5.1 Guard against direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Describes and reads/writes suite configuration keys for inline commands.
 *
 * @since 0.1.0
 */
final class SuiteConfigCatalog {

	/**
	 * Suite config definition applies only when its plugin is active.
	 *
	 * @since 1.6.4
	 */
	public const SUITE_SCOPE_PLUGIN = 'plugin';

	/**
	 * Suite config definition for WordPress core options (requires manage_options).
	 *
	 * @since 1.6.4
	 */
	public const SUITE_SCOPE_WORDPRESS_CORE = 'wordpress_core';

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
		$list = is_array( $filtered ) ? $filtered : $defs;
		$out    = [];
		foreach ( $list as $def ) {
			if ( is_array( $def ) ) {
				$out[] = self::normalize_definition( $def );
			}
		}
		return $out;
	}

	/**
	 * Numeric sort order for config list grouping (lower first).
	 *
	 * @since 1.6.4
	 */
	public static function get_group_sort_order( string $group ): int {
		static $orders = [
			'flux_one'               => 10,
			'flux_media_optimizer'   => 20,
			'flux_ai_alt_text'       => 30,
			'flux_ai_alt_text_pro'   => 40,
			'flux_unused_media'      => 50,
			'flux_gutenberg'         => 60,
			'flux_audit_scanner'     => 70,
			'wp_general'             => 100,
			'wp_reading'             => 110,
			'wp_permalinks'          => 120,
		];
		return $orders[ $group ] ?? 500;
	}

	/**
	 * @since 1.6.4
	 * @param array<string,mixed> $def Definition.
	 * @return array<string,mixed>
	 */
	private static function normalize_definition( array $def ): array {
		if ( ! isset( $def['suite_scope'] ) ) {
			$def['suite_scope'] = self::SUITE_SCOPE_PLUGIN;
		}
		if ( ! empty( $def['group'] ) && empty( $def['group_label'] ) ) {
			$def['group_label'] = self::resolve_group_label( (string) $def['group'] );
		}
		if ( ! empty( $def['group'] ) && ! isset( $def['group_order'] ) ) {
			$def['group_order'] = self::get_group_sort_order( (string) $def['group'] );
		}
		return $def;
	}

	/**
	 * @since 1.6.4
	 */
	private static function resolve_group_label( string $group ): string {
		static $map = [
			'flux_one'             => 'Flux One',
			'flux_media_optimizer' => 'Flux Media Optimizer',
			'flux_ai_alt_text'     => 'Flux AI Alt Text',
			'flux_ai_alt_text_pro' => 'Flux AI Alt Text Pro',
			'flux_unused_media'    => 'Flux Unused Media Cleaner',
			'flux_gutenberg'       => 'Flux AI Gutenberg Page Builder',
			'flux_audit_scanner'   => 'Flux Accessibility Audit Scanner',
			'wp_general'           => 'WordPress — General',
			'wp_reading'           => 'WordPress — Reading',
			'wp_permalinks'        => 'WordPress — Permalinks',
		];
		return $map[ $group ] ?? $group;
	}

	/**
	 * Definitions for plugins that are currently active.
	 *
	 * @return list<array<string,mixed>>
	 */
	public static function get_available_definitions() {
		$out = [];
		foreach ( self::get_definitions() as $def ) {
			if ( ! is_array( $def ) || empty( $def['id'] ) ) {
				continue;
			}
			$scope = (string) ( $def['suite_scope'] ?? self::SUITE_SCOPE_PLUGIN );
			if ( self::SUITE_SCOPE_WORDPRESS_CORE === $scope ) {
				if ( current_user_can( 'manage_options' ) ) {
					$out[] = $def;
				}
				continue;
			}
			if ( empty( $def['plugin_file'] ) ) {
				continue;
			}
			if ( self::is_plugin_available( (string) $def['plugin_file'] ) ) {
				$out[] = $def;
			}
		}
		return self::sort_definitions( $out );
	}

	/**
	 * Stable sort: group order, then label.
	 *
	 * @since 1.6.4
	 * @param list<array<string,mixed>> $defs Definitions.
	 * @return list<array<string,mixed>>
	 */
	public static function sort_definitions( array $defs ): array {
		usort(
			$defs,
			static function ( $a, $b ) {
				if ( ! is_array( $a ) || ! is_array( $b ) ) {
					return 0;
				}
				$go = (int) ( $a['group_order'] ?? 0 ) <=> (int) ( $b['group_order'] ?? 0 );
				if ( 0 !== $go ) {
					return $go;
				}
				return strcasecmp( (string) ( $a['label'] ?? '' ), (string) ( $b['label'] ?? '' ) );
			}
		);
		return $defs;
	}

	/**
	 * @since 1.6.4 Clarified example uses {@see plugin_basename()} form (directory may differ from marketing slug).
	 * @param string $plugin_file Plugin basename (e.g. result of `plugin_basename( __FILE__ )` for the main plugin file).
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
			self::audit_scanner_defs(),
			self::wordpress_core_defs()
		);
	}

	/**
	 * Flux One suite config rows (active-plugin check uses main plugin basename).
	 *
	 * @since 0.1.0
	 * @since 1.6.4 Use {@see FLUX_ONE_PLUGIN_BASENAME} for `plugin_file` so installs match any plugin directory name.
	 * @return list<array<string,mixed>>
	 */
	private static function flux_one_defs() {
		return [
			[
				'group'       => 'flux_one',
				'id'          => 'flux_one.email_capture_enabled',
				'plugin_file' => \FLUX_ONE_PLUGIN_BASENAME,
				'plugin'      => 'Flux One',
				'label'       => 'Email capture (log outbound mail for your user)',
				'type'        => 'bool',
				'handler'     => 'flux_one:email_capture_enabled',
				'search'      => 'email wp_mail log capture aggregate',
				'sensitive'   => false,
			],
			[
				'group'       => 'flux_one',
				'id'          => 'flux_one.suppress_mail_to_self',
				'plugin_file' => \FLUX_ONE_PLUGIN_BASENAME,
				'plugin'      => 'Flux One',
				'label'       => 'Suppress your addresses on outbound mail',
				'type'        => 'bool',
				'handler'     => 'flux_one:suppress_mail_to_self',
				'search'      => 'suppress self email cancel to-self',
				'sensitive'   => false,
			],
		];
	}

	private static function media_optimizer_defs() {
		$p = 'flux-media-optimizer/flux-media-optimizer.php';
		return [
			[
				'id'          => 'media_optimizer.image_auto_convert',
				'group'       => 'flux_media_optimizer',
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
				'group'       => 'flux_media_optimizer',
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
				'group'       => 'flux_media_optimizer',
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
				'group'       => 'flux_media_optimizer',
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
				'group'       => 'flux_media_optimizer',
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
				'group'       => 'flux_media_optimizer',
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
				'group'       => 'flux_media_optimizer',
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
				'group'       => 'flux_ai_alt_text',
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
				'group'       => 'flux_ai_alt_text',
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
				'group'       => 'flux_ai_alt_text',
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
				'group'       => 'flux_ai_alt_text',
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
				'group'       => 'flux_ai_alt_text',
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
				'group'       => 'flux_ai_alt_text_pro',
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
				'group'       => 'flux_ai_alt_text_pro',
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
				'group'       => 'flux_unused_media',
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
				'group'       => 'flux_unused_media',
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
				'group'       => 'flux_unused_media',
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
				'group'       => 'flux_unused_media',
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
				'group'       => 'flux_gutenberg',
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
				'group'       => 'flux_gutenberg',
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
				'group'       => 'flux_gutenberg',
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
				'group'       => 'flux_audit_scanner',
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
				'group'       => 'flux_audit_scanner',
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
				'group'       => 'flux_audit_scanner',
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

	/**
	 * Curated WordPress options from Settings → General, Reading, Permalinks.
	 *
	 * @since 1.6.4
	 * @return list<array<string,mixed>>
	 */
	private static function wordpress_core_defs() {
		return [
			[
				'id'           => 'wp.blogname',
				'suite_scope'  => self::SUITE_SCOPE_WORDPRESS_CORE,
				'plugin'       => 'WordPress',
				'group'        => 'wp_general',
				'label'        => 'Site title',
				'type'         => 'string',
				'handler'      => 'wordpress:blogname',
				'search'       => 'blog title site name general options',
				'sensitive'    => false,
			],
			[
				'id'           => 'wp.blogdescription',
				'suite_scope'  => self::SUITE_SCOPE_WORDPRESS_CORE,
				'plugin'       => 'WordPress',
				'group'        => 'wp_general',
				'label'        => 'Tagline',
				'type'         => 'string',
				'handler'      => 'wordpress:blogdescription',
				'search'       => 'tagline description general',
				'sensitive'    => false,
			],
			[
				'id'           => 'wp.admin_email',
				'suite_scope'  => self::SUITE_SCOPE_WORDPRESS_CORE,
				'plugin'       => 'WordPress',
				'group'        => 'wp_general',
				'label'        => 'Administration email address',
				'type'         => 'string',
				'handler'      => 'wordpress:admin_email',
				'search'       => 'admin email general',
				'sensitive'    => false,
			],
			[
				'id'           => 'wp.timezone_string',
				'suite_scope'  => self::SUITE_SCOPE_WORDPRESS_CORE,
				'plugin'       => 'WordPress',
				'group'        => 'wp_general',
				'label'        => 'Timezone string',
				'type'         => 'string',
				'handler'      => 'wordpress:timezone_string',
				'search'       => 'timezone utc general',
				'sensitive'    => false,
			],
			[
				'id'           => 'wp.date_format',
				'suite_scope'  => self::SUITE_SCOPE_WORDPRESS_CORE,
				'plugin'       => 'WordPress',
				'group'        => 'wp_general',
				'label'        => 'Date format',
				'type'         => 'string',
				'handler'      => 'wordpress:date_format',
				'search'       => 'date format general',
				'sensitive'    => false,
			],
			[
				'id'           => 'wp.time_format',
				'suite_scope'  => self::SUITE_SCOPE_WORDPRESS_CORE,
				'plugin'       => 'WordPress',
				'group'        => 'wp_general',
				'label'        => 'Time format',
				'type'         => 'string',
				'handler'      => 'wordpress:time_format',
				'search'       => 'time format general',
				'sensitive'    => false,
			],
			[
				'id'           => 'wp.start_of_week',
				'suite_scope'  => self::SUITE_SCOPE_WORDPRESS_CORE,
				'plugin'       => 'WordPress',
				'group'        => 'wp_general',
				'label'        => 'Week starts on',
				'type'         => 'int',
				'min'          => 0,
				'max'          => 6,
				'handler'      => 'wordpress:start_of_week',
				'search'       => 'week calendar start general',
				'sensitive'    => false,
			],
			[
				'id'           => 'wp.show_on_front',
				'suite_scope'  => self::SUITE_SCOPE_WORDPRESS_CORE,
				'plugin'       => 'WordPress',
				'group'        => 'wp_reading',
				'label'        => 'Your homepage displays',
				'type'         => 'enum',
				'choices'      => [ 'posts', 'page' ],
				'handler'      => 'wordpress:show_on_front',
				'search'       => 'homepage front page reading static posts',
				'sensitive'    => false,
			],
			[
				'id'           => 'wp.page_on_front',
				'suite_scope'  => self::SUITE_SCOPE_WORDPRESS_CORE,
				'plugin'       => 'WordPress',
				'group'        => 'wp_reading',
				'label'        => 'Homepage (page ID)',
				'type'         => 'int',
				'min'          => 0,
				'max'          => 2147483647,
				'handler'      => 'wordpress:page_on_front',
				'search'       => 'home page id reading static',
				'sensitive'    => false,
			],
			[
				'id'           => 'wp.page_for_posts',
				'suite_scope'  => self::SUITE_SCOPE_WORDPRESS_CORE,
				'plugin'       => 'WordPress',
				'group'        => 'wp_reading',
				'label'        => 'Posts page (page ID)',
				'type'         => 'int',
				'min'          => 0,
				'max'          => 2147483647,
				'handler'      => 'wordpress:page_for_posts',
				'search'       => 'blog posts page id reading',
				'sensitive'    => false,
			],
			[
				'id'           => 'wp.posts_per_page',
				'suite_scope'  => self::SUITE_SCOPE_WORDPRESS_CORE,
				'plugin'       => 'WordPress',
				'group'        => 'wp_reading',
				'label'        => 'Blog pages show at most',
				'type'         => 'int',
				'min'          => 1,
				'max'          => 500,
				'handler'      => 'wordpress:posts_per_page',
				'search'       => 'posts per page reading syndication',
				'sensitive'    => false,
			],
			[
				'id'           => 'wp.permalink_structure',
				'suite_scope'  => self::SUITE_SCOPE_WORDPRESS_CORE,
				'plugin'       => 'WordPress',
				'group'        => 'wp_permalinks',
				'label'        => 'Permalink structure',
				'type'         => 'string',
				'handler'      => 'wordpress:permalink_structure',
				'search'       => 'permalink rewrite slug pretty links',
				'sensitive'    => false,
			],
		];
	}

	/**
	 * Read WordPress core option values for suite config.
	 *
	 * @since 1.6.4
	 * @return mixed|null Null when this handler is not a WordPress core option.
	 */
	private static function wordpress_core_invoke_get( string $handler ) {
		switch ( $handler ) {
			case 'wordpress:blogname':
				return (string) get_option( 'blogname', '' );
			case 'wordpress:blogdescription':
				return (string) get_option( 'blogdescription', '' );
			case 'wordpress:admin_email':
				return (string) get_option( 'admin_email', '' );
			case 'wordpress:timezone_string':
				return (string) get_option( 'timezone_string', '' );
			case 'wordpress:date_format':
				return (string) get_option( 'date_format', '' );
			case 'wordpress:time_format':
				return (string) get_option( 'time_format', '' );
			case 'wordpress:start_of_week':
				return (int) get_option( 'start_of_week', 1 );
			case 'wordpress:show_on_front':
				return (string) get_option( 'show_on_front', 'posts' );
			case 'wordpress:page_on_front':
				return (int) get_option( 'page_on_front', 0 );
			case 'wordpress:page_for_posts':
				return (int) get_option( 'page_for_posts', 0 );
			case 'wordpress:posts_per_page':
				return (int) get_option( 'posts_per_page', 10 );
			case 'wordpress:permalink_structure':
				return (string) get_option( 'permalink_structure', '' );
			default:
				return null;
		}
	}

	/**
	 * Persist WordPress core option values for suite config.
	 *
	 * @since 1.6.4
	 * @param mixed $value Normalized value.
	 * @return true|\WP_Error|null Null when handler is not WordPress core.
	 */
	private static function wordpress_core_invoke_set( string $handler, $value ) {
		switch ( $handler ) {
			case 'wordpress:blogname':
				update_option( 'blogname', sanitize_text_field( (string) $value ), true );
				return true;
			case 'wordpress:blogdescription':
				$s = function_exists( 'sanitize_textarea_field' )
					? sanitize_textarea_field( (string) $value )
					: sanitize_text_field( (string) $value );
				update_option( 'blogdescription', $s, true );
				return true;
			case 'wordpress:admin_email':
				$email = sanitize_email( (string) $value );
				if ( ! is_email( $email ) ) {
					return new \WP_Error( 'flux_one_wp_admin_email', 'Invalid email address.' );
				}
				update_option( 'admin_email', $email, true );
				return true;
			case 'wordpress:timezone_string':
				update_option( 'timezone_string', sanitize_text_field( (string) $value ), true );
				return true;
			case 'wordpress:date_format':
				update_option( 'date_format', sanitize_text_field( (string) $value ), true );
				return true;
			case 'wordpress:time_format':
				update_option( 'time_format', sanitize_text_field( (string) $value ), true );
				return true;
			case 'wordpress:start_of_week':
				update_option( 'start_of_week', (int) $value, true );
				return true;
			case 'wordpress:show_on_front':
				$v = sanitize_key( (string) $value );
				if ( ! in_array( $v, [ 'posts', 'page' ], true ) ) {
					return new \WP_Error( 'flux_one_wp_show_on_front', 'Use posts or page.' );
				}
				update_option( 'show_on_front', $v, true );
				return true;
			case 'wordpress:page_on_front':
				$n = (int) $value;
				if ( $n < 0 ) {
					return new \WP_Error( 'flux_one_wp_page', 'Page ID must be zero or positive.' );
				}
				if ( $n > 0 ) {
					$post = get_post( $n );
					if ( ! $post || 'page' !== $post->post_type ) {
						return new \WP_Error( 'flux_one_wp_page', 'Homepage must be a published page ID.' );
					}
				}
				update_option( 'page_on_front', $n, true );
				return true;
			case 'wordpress:page_for_posts':
				$n = (int) $value;
				if ( $n < 0 ) {
					return new \WP_Error( 'flux_one_wp_page', 'Page ID must be zero or positive.' );
				}
				if ( $n > 0 ) {
					$post = get_post( $n );
					if ( ! $post || 'page' !== $post->post_type ) {
						return new \WP_Error( 'flux_one_wp_page', 'Posts page must be a published page ID.' );
					}
				}
				update_option( 'page_for_posts', $n, true );
				return true;
			case 'wordpress:posts_per_page':
				update_option( 'posts_per_page', (int) $value, true );
				return true;
			case 'wordpress:permalink_structure':
				$raw_ps = (string) $value;
				$clean_ps = function_exists( 'sanitize_option' )
					? sanitize_option( 'permalink_structure', $raw_ps )
					: $raw_ps;
				update_option( 'permalink_structure', $clean_ps, true );
				if ( function_exists( 'flush_rewrite_rules' ) ) {
					flush_rewrite_rules( false );
				}
				return true;
			default:
				return null;
		}
	}

	private static function invoke_get( string $handler ) {
		switch ( $handler ) {
			case 'flux_one:email_capture_enabled':
				return FluxOneSettings::is_email_capture_enabled_for_user( get_current_user_id() );
			case 'flux_one:suppress_mail_to_self':
				return FluxOneSettings::is_suppress_mail_enabled_for_user( get_current_user_id() );
		}

		$wp_read = self::wordpress_core_invoke_get( $handler );
		if ( null !== $wp_read ) {
			return $wp_read;
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
		}

		$wp_set = self::wordpress_core_invoke_set( $handler, $value );
		if ( null !== $wp_set ) {
			return $wp_set;
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
