<?php
/**
 * Database service.
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
 * Handles custom tables for Flux One.
 *
 * @since 0.1.0
 */
class Database {

	/**
	 * DB version option key.
	 *
	 * @since 0.1.0
	 */
	private const DB_VERSION_OPTION = 'flux_one_db_version';

	/**
	 * Current DB version.
	 *
	 * @since 0.1.0
	 */
	private const DB_VERSION = '0.2.0';

	/**
	 * Create/update tables as needed.
	 *
	 * @since 0.1.0
	 * @return void
	 */
	public static function maybe_update_database() {
		$installed = (string) get_option( self::DB_VERSION_OPTION, '' );
		if ( version_compare( $installed, self::DB_VERSION, '>=' ) ) {
			return;
		}

		self::create_tables();
		update_option( self::DB_VERSION_OPTION, self::DB_VERSION );
	}

	/**
	 * Create tables.
	 *
	 * @since 0.1.0
	 * @return void
	 */
	public static function create_tables() {
		global $wpdb;

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$table_name      = self::events_table_name();
		$summaries_table = self::email_summaries_table_name();
		$charset_collate = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE {$table_name} (
			id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
			user_id BIGINT(20) UNSIGNED NULL,
			source VARCHAR(50) NOT NULL DEFAULT '',
			event_type VARCHAR(50) NOT NULL DEFAULT '',
			subject TEXT NULL,
			payload LONGTEXT NULL,
			created_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			KEY created_at (created_at),
			KEY user_id (user_id),
			KEY source (source),
			KEY event_type (event_type)
		) {$charset_collate};";

		dbDelta( $sql );

		// @since 1.3.0 Per-event AI summary cache (no account_id column; scoped by table prefix).
		$sql_summaries = "CREATE TABLE {$summaries_table} (
			id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
			event_id BIGINT(20) UNSIGNED NOT NULL,
			summary TEXT NULL,
			action TEXT NULL,
			is_urgent TINYINT(1) NOT NULL DEFAULT 0,
			raw_response LONGTEXT NULL,
			summarized_at DATETIME NOT NULL,
			created_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY event_id (event_id),
			KEY summarized_at (summarized_at)
		) {$charset_collate};";

		dbDelta( $sql_summaries );
	}

	/**
	 * Drop tables.
	 *
	 * @since 0.1.0
	 * @return void
	 */
	public static function drop_tables() {
		global $wpdb;

		$table_name = self::events_table_name();
		$wpdb->query( "DROP TABLE IF EXISTS {$table_name}" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.SchemaChange,WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$summaries = self::email_summaries_table_name();
		$wpdb->query( "DROP TABLE IF EXISTS {$summaries}" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.SchemaChange,WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		delete_option( self::DB_VERSION_OPTION );
	}

	/**
	 * Get events table name.
	 *
	 * @since 0.1.0
	 * @return string
	 */
	public static function events_table_name() {
		global $wpdb;
		return $wpdb->prefix . 'flux_one_events';
	}

	/**
	 * Email summaries table name.
	 *
	 * @since 1.3.0
	 * @return string
	 */
	public static function email_summaries_table_name() {
		global $wpdb;
		return $wpdb->prefix . 'flux_one_email_summaries';
	}
}

