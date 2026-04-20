<?php
/**
 * Plugins handler.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Services\CommandHandlers;

use FluxOne\App\Services\IndexCacheService;

/**
 * Handles plugin management commands.
 *
 * @since 0.1.0
 */
class PluginsHandler {

	/**
	 * Handle plugin subcommands.
	 *
	 * Supported (v1): update all, activate/deactivate/delete {query}.
	 *
	 * @since 0.1.0
	 * @param array $tokens Tokens after "plugin".
	 * @return array
	 */
	public function handle( $tokens ) {
		$tokens = array_values( (array) $tokens );
		$op     = $tokens[0] ?? '';

		if ( in_array( $op, [ 'list', 'show' ], true ) ) {
			if ( ! current_user_can( 'activate_plugins' ) ) {
				return [
					'type'    => 'error',
					'command' => 'plugin ' . $op,
					'message' => __( 'You do not have permission to view plugins.', 'flux-one' ),
				];
			}
			return [
				'type'    => 'panel',
				'panelId' => 'plugins',
				'command' => 'plugin ' . $op,
				'data'    => ( new IndexCacheService() )->get_plugins_index(),
			];
		}

		if ( 'update' === $op && 'all' === ( $tokens[1] ?? '' ) ) {
			return $this->update_all();
		}

		if ( 'update' === $op ) {
			$query = trim( implode( ' ', array_slice( $tokens, 1 ) ) );
			if ( '' === $query ) {
				return [
					'type'    => 'error',
					'command' => 'plugin update',
					'message' => 'Plugin name is required.',
				];
			}
			return $this->update_one( $query );
		}

		if ( in_array( $op, [ 'activate', 'deactivate', 'delete' ], true ) ) {
			$query = trim( implode( ' ', array_slice( $tokens, 1 ) ) );
			if ( '' === $query ) {
				return [
					'type'    => 'error',
					'command' => 'plugin ' . $op,
					'message' => 'Plugin name is required.',
				];
			}
			return $this->mutate_plugin( $op, $query );
		}

		if ( in_array( $op, [ 'upload', 'install' ], true ) ) {
			if ( ! current_user_can( 'install_plugins' ) ) {
				return [
					'type'    => 'error',
					'command' => 'plugin ' . $op,
					'message' => __( 'You do not have permission to install plugins.', 'flux-one' ),
				];
			}
			return [
				'type'    => 'navigation',
				'command' => 'plugin ' . $op,
				'data'    => [
					'url' => admin_url( 'plugin-install.php?tab=upload' ),
				],
			];
		}

		if ( '' === $op ) {
			return [
				'type'    => 'error',
				'command' => 'plugin',
				'message' => __( 'Try plugin list.', 'flux-one' ),
			];
		}

		return [
			'type'    => 'error',
			'command' => 'plugin ' . implode( ' ', $tokens ),
			'message' => __( 'Unknown plugin command. Try plugin list.', 'flux-one' ),
		];
	}

	/**
	 * Update a single plugin.
	 *
	 * @since 0.1.0
	 * @param string $query Plugin query.
	 * @return array
	 */
	private function update_one( $query ) {
		if ( ! current_user_can( 'update_plugins' ) ) {
			return [
				'type'    => 'error',
				'command' => 'plugin update ' . $query,
				'message' => __( 'You do not have permission to update plugins.', 'flux-one' ),
			];
		}

		require_once ABSPATH . 'wp-admin/includes/update.php';
		require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
		require_once ABSPATH . 'wp-admin/includes/plugin.php';

		$plugin_file = $this->resolve_plugin_file( $query );
		if ( ! $plugin_file ) {
			return [
				'type'    => 'error',
				'command' => 'plugin update ' . $query,
				'message' => __( 'Plugin not found.', 'flux-one' ),
			];
		}

		wp_update_plugins();
		$updates = get_site_transient( 'update_plugins' );
		if (
			! is_object( $updates )
			|| ! isset( $updates->response )
			|| ! is_array( $updates->response )
			|| ! isset( $updates->response[ $plugin_file ] )
		) {
			$msg = __( 'No update is available for this plugin.', 'flux-one' );
			return [
				'type'    => 'action',
				'command' => 'plugin update ' . $query,
				'status'  => 'error',
				'message' => $msg,
				'data'    => [
					'pluginFile'  => (string) $plugin_file,
					'success'     => false,
					'userMessage' => $msg,
					'message'     => $msg,
					'error_code'  => 'flux_one_plugin_no_update',
				],
			];
		}

		if ( ! $this->ensure_wp_filesystem_for_plugin_updates() ) {
			$msg = __( 'Could not access the filesystem to update plugins.', 'flux-one' );
			return [
				'type'    => 'action',
				'command' => 'plugin update ' . $query,
				'status'  => 'error',
				'message' => $msg,
				'data'    => [
					'pluginFile'  => (string) $plugin_file,
					'success'     => false,
					'userMessage' => $msg,
					'message'     => $msg,
					'error_code'  => 'flux_one_fs_credentials',
				],
			];
		}

		$upgrader = new \Plugin_Upgrader( new \Automatic_Upgrader_Skin() );
		$result   = $upgrader->upgrade( $plugin_file );
		$ok       = ( true === $result );

		if ( $ok ) {
			$msg = __( 'Plugin updated.', 'flux-one' );
			return [
				'type'    => 'action',
				'command' => 'plugin update ' . $query,
				'status'  => 'success',
				'message' => $msg,
				'data'    => [
					'pluginFile'  => (string) $plugin_file,
					'success'     => true,
					'userMessage' => $msg,
				],
			];
		}

		$failure = $this->interpret_plugin_upgrade_failure( $upgrader, $result );
		$this->log_plugin_upgrade_failure_if_unknown( $failure['error_code'], $plugin_file, $failure['debug'] );

		$data = [
			'pluginFile'  => (string) $plugin_file,
			'success'     => false,
			'userMessage' => $failure['userMessage'],
			'message'     => $failure['userMessage'],
			'error_code'  => $failure['error_code'],
		];
		if ( $this->should_expose_action_debug() && ! empty( $failure['debug'] ) ) {
			$data['debug'] = $failure['debug'];
		}

		return [
			'type'    => 'action',
			'command' => 'plugin update ' . $query,
			'status'  => 'error',
			'message' => $failure['userMessage'],
			'data'    => $data,
		];
	}

	/**
	 * Update all plugins with updates.
	 *
	 * @since 0.1.0
	 * @return array
	 */
	private function update_all() {
		if ( ! current_user_can( 'update_plugins' ) ) {
			return [
				'type'    => 'error',
				'command' => 'plugin update all',
				'message' => __( 'You do not have permission to update plugins.', 'flux-one' ),
			];
		}

		require_once ABSPATH . 'wp-admin/includes/update.php';
		require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
		require_once ABSPATH . 'wp-admin/includes/plugin.php';

		wp_update_plugins();
		$updates = get_site_transient( 'update_plugins' );
		$to_update = [];
		if ( isset( $updates->response ) && is_array( $updates->response ) ) {
			$to_update = array_keys( $updates->response );
		}

		if ( empty( $to_update ) ) {
			$msg = __( 'No plugin updates available.', 'flux-one' );
			return [
				'type'    => 'action',
				'command' => 'plugin update all',
				'status'  => 'success',
				'message' => $msg,
				'data'    => [
					'userMessage' => $msg,
					'results'     => [],
				],
			];
		}

		if ( ! $this->ensure_wp_filesystem_for_plugin_updates() ) {
			$msg = __( 'Could not access the filesystem to update plugins.', 'flux-one' );
			return [
				'type'    => 'action',
				'command' => 'plugin update all',
				'status'  => 'error',
				'message' => $msg,
				'data'    => [
					'success'     => false,
					'userMessage' => $msg,
					'message'     => $msg,
					'error_code'  => 'flux_one_fs_credentials',
					'results'     => [],
				],
			];
		}

		$results = [];

		foreach ( $to_update as $plugin_file ) {
			$upgrader = new \Plugin_Upgrader( new \Automatic_Upgrader_Skin() );
			$result   = $upgrader->upgrade( $plugin_file );
			$ok       = ( true === $result );

			$row = [
				'pluginFile' => (string) $plugin_file,
				'success'    => $ok,
			];

			if ( ! $ok ) {
				$failure = $this->interpret_plugin_upgrade_failure( $upgrader, $result );
				$this->log_plugin_upgrade_failure_if_unknown( $failure['error_code'], $plugin_file, $failure['debug'] );
				$row['userMessage'] = $failure['userMessage'];
				$row['message']     = $failure['userMessage'];
				$row['error_code']  = $failure['error_code'];
				if ( $this->should_expose_action_debug() && ! empty( $failure['debug'] ) ) {
					$row['debug'] = $failure['debug'];
				}
			}

			$results[] = $row;
		}

		$success_count = count( array_filter( $results, static fn( $r ) => ! empty( $r['success'] ) ) );
		$fail_count    = count( $results ) - $success_count;

		if ( 0 === $fail_count ) {
			/* translators: %d: number of plugins updated. */
			$msg = sprintf( __( '%d plugin(s) updated.', 'flux-one' ), (int) $success_count );
			return [
				'type'    => 'action',
				'command' => 'plugin update all',
				'status'  => 'success',
				'message' => $msg,
				'data'    => [
					'userMessage' => $msg,
					'results'     => $results,
				],
			];
		}

		if ( 0 === $success_count ) {
			$summary = __( 'No plugins could be updated.', 'flux-one' );
			$code    = 'flux_one_plugin_bulk_all_failed';
		} else {
			/* translators: 1: number succeeded, 2: number failed. */
			$summary = sprintf( __( '%1$d updated, %2$d failed.', 'flux-one' ), (int) $success_count, (int) $fail_count );
			$code    = 'flux_one_plugin_bulk_partial_failure';
		}

		return [
			'type'    => 'action',
			'command' => 'plugin update all',
			'status'  => 'error',
			'message' => $summary,
			'data'    => [
				'userMessage' => $summary,
				'message'     => $summary,
				'error_code'  => $code,
				'results'     => $results,
			],
		];
	}

	/**
	 * Activate/deactivate/delete a resolved plugin.
	 *
	 * @since 0.1.0
	 * @param string $op Operation.
	 * @param string $query Query.
	 * @return array
	 */
	private function mutate_plugin( $op, $query ) {
		if ( ! function_exists( 'get_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$plugin_file = $this->resolve_plugin_file( $query );
		if ( ! $plugin_file ) {
			return [
				'type'    => 'error',
				'command' => 'plugin ' . $op . ' ' . $query,
				'message' => 'Plugin not found.',
			];
		}

		if ( 'activate' === $op ) {
			if ( ! current_user_can( 'activate_plugins' ) ) {
				return [
					'type'    => 'error',
					'command' => 'plugin activate ' . $query,
					'message' => 'You do not have permission to activate plugins.',
				];
			}
			$result = activate_plugin( $plugin_file );
			if ( is_wp_error( $result ) ) {
				return [
					'type'    => 'error',
					'command' => 'plugin activate ' . $query,
					'message' => $result->get_error_message(),
				];
			}
			return [
				'type'    => 'action',
				'command' => 'plugin activate ' . $query,
				'status'  => 'success',
				'message' => 'Plugin activated.',
				'data'    => [
					'pluginFile' => $plugin_file,
				],
			];
		}

		if ( 'deactivate' === $op ) {
			if ( ! current_user_can( 'activate_plugins' ) ) {
				return [
					'type'    => 'error',
					'command' => 'plugin deactivate ' . $query,
					'message' => 'You do not have permission to deactivate plugins.',
				];
			}
			deactivate_plugins( $plugin_file, false, is_multisite() );
			return [
				'type'    => 'action',
				'command' => 'plugin deactivate ' . $query,
				'status'  => 'success',
				'message' => 'Plugin deactivated.',
				'data'    => [
					'pluginFile' => $plugin_file,
				],
			];
		}

		if ( 'delete' === $op ) {
			if ( ! current_user_can( 'delete_plugins' ) ) {
				return [
					'type'    => 'error',
					'command' => 'plugin delete ' . $query,
					'message' => 'You do not have permission to delete plugins.',
				];
			}

			require_once ABSPATH . 'wp-admin/includes/file.php';
			require_once ABSPATH . 'wp-admin/includes/plugin.php';

			$deleted = delete_plugins( [ $plugin_file ] );
			if ( is_wp_error( $deleted ) ) {
				return [
					'type'    => 'error',
					'command' => 'plugin delete ' . $query,
					'message' => $deleted->get_error_message(),
				];
			}
			return [
				'type'    => 'action',
				'command' => 'plugin delete ' . $query,
				'status'  => 'success',
				'message' => 'Plugin deleted.',
				'data'    => [
					'pluginFile' => $plugin_file,
				],
			];
		}

		return [
			'type'    => 'error',
			'command' => 'plugin ' . $op . ' ' . $query,
			'message' => 'Unsupported operation.',
		];
	}

	/**
	 * Resolve plugin file from a fuzzy query.
	 *
	 * @since 0.1.0
	 * @param string $query Query.
	 * @return string|null
	 */
	private function resolve_plugin_file( $query ) {
		$query = strtolower( trim( $query ) );
		if ( '' === $query ) {
			return null;
		}

		$plugins = get_plugins();

		// Direct plugin file match.
		foreach ( $plugins as $plugin_file => $meta ) {
			if ( strtolower( $plugin_file ) === $query ) {
				return (string) $plugin_file;
			}
		}

		// Match by folder slug.
		foreach ( $plugins as $plugin_file => $meta ) {
			$folder = strtolower( dirname( $plugin_file ) );
			if ( '.' !== $folder && $folder === $query ) {
				return (string) $plugin_file;
			}
		}

		// Match by display name.
		foreach ( $plugins as $plugin_file => $meta ) {
			$name = strtolower( (string) ( $meta['Name'] ?? '' ) );
			if ( '' !== $name && false !== strpos( $name, $query ) ) {
				return (string) $plugin_file;
			}
		}

		return null;
	}

	/**
	 * Whether to include debug details in REST action payloads.
	 *
	 * @since 0.1.0
	 * @return bool
	 */
	private function should_expose_action_debug() {
		return defined( 'WP_DEBUG' ) && WP_DEBUG;
	}

	/**
	 * Initialize WP_Filesystem for plugin directory updates (no interactive credentials).
	 *
	 * @since 0.1.0
	 * @return bool
	 */
	private function ensure_wp_filesystem_for_plugin_updates() {
		if ( ! function_exists( 'WP_Filesystem' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}
		ob_start();
		$ok = WP_Filesystem( false, WP_PLUGIN_DIR, true );
		ob_end_clean();
		return (bool) $ok;
	}

	/**
	 * Normalize text for a single user-visible sentence.
	 *
	 * @since 0.1.0
	 * @param string $text Raw text.
	 * @param int    $max  Max length.
	 * @return string
	 */
	private function shorten_user_sentence( $text, $max = 200 ) {
		$text = wp_strip_all_tags( (string) $text );
		$text = preg_replace( '/\s+/', ' ', $text );
		$text = trim( $text );
		if ( strlen( $text ) > $max ) {
			$text = substr( $text, 0, $max - 1 ) . '…';
		}
		return $text;
	}

	/**
	 * Derive user-facing upgrade failure from upgrader state.
	 *
	 * @since 0.1.0
	 * @param \Plugin_Upgrader      $upgrader Upgrader instance.
	 * @param bool|\WP_Error|null   $result   Return value from upgrade().
	 * @return array{ userMessage: string, error_code: string, debug: array }
	 */
	private function interpret_plugin_upgrade_failure( $upgrader, $result ) {
		$debug = [];

		if ( is_wp_error( $result ) ) {
			$debug['wp_error_code']    = $result->get_error_code();
			$debug['wp_error_message'] = $result->get_error_message();
			$msg                       = $this->shorten_user_sentence( $result->get_error_message(), 180 );
			return [
				'userMessage' => '' !== $msg ? $msg : __( 'Update could not be completed.', 'flux-one' ),
				'error_code'  => 'flux_one_plugin_wp_error',
				'debug'       => $debug,
			];
		}

		$skin     = isset( $upgrader->skin ) ? $upgrader->skin : null;
		$messages = ( $skin && method_exists( $skin, 'get_upgrade_messages' ) )
			? (array) $skin->get_upgrade_messages()
			: [];

		$last_skin = '';
		foreach ( array_reverse( $messages ) as $m ) {
			$plain = $this->shorten_user_sentence( $m, 500 );
			if ( '' !== $plain ) {
				$last_skin = $plain;
				break;
			}
		}

		if ( '' !== $last_skin ) {
			$debug['skin_message'] = $last_skin;
			$lower                 = strtolower( $last_skin );
			if ( false !== strpos( $lower, 'latest version' ) || false !== strpos( $lower, 'up to date' ) ) {
				$msg = __( 'No update is available for this plugin.', 'flux-one' );
				return [
					'userMessage' => $msg,
					'error_code'  => 'flux_one_plugin_no_update',
					'debug'       => $debug,
				];
			}
			return [
				'userMessage' => $this->shorten_user_sentence( $last_skin, 160 ),
				'error_code'  => 'flux_one_plugin_upgrade_failed',
				'debug'       => $debug,
			];
		}

		return [
			'userMessage' => __( 'Update could not be completed.', 'flux-one' ),
			'error_code'  => 'flux_one_plugin_upgrade_unknown',
			'debug'       => $debug,
		];
	}

	/**
	 * Log unknown plugin upgrade outcomes for support.
	 *
	 * @since 0.1.0
	 * @param string $error_code  Machine code.
	 * @param string $plugin_file Plugin file.
	 * @param array  $debug       Debug context.
	 * @return void
	 */
	private function log_plugin_upgrade_failure_if_unknown( $error_code, $plugin_file, $debug ) {
		if ( 'flux_one_plugin_upgrade_unknown' !== $error_code ) {
			return;
		}
		try {
			$logger_class = '\FluxOne\FluxPlugins\Common\Logger\Logger';
			if ( class_exists( $logger_class ) ) {
				$logger = call_user_func( [ $logger_class, 'get_instance' ] );
				if ( is_object( $logger ) && method_exists( $logger, 'warning' ) ) {
					$logger->warning(
						'Flux One plugin upgrade failed without skin detail',
						array_merge(
							[
								'plugin_file' => (string) $plugin_file,
								'user_id'     => get_current_user_id(),
							],
							(array) $debug
						)
					);
				}
			}
		} catch ( \Throwable $e ) {
			// Logger optional.
		}
	}
}

