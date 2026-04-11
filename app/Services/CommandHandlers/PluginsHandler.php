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
	 * Render plugins panel payload.
	 *
	 * @since 0.1.0
	 * @return array
	 */
	public function show_plugins_panel() {
		return [
			'type'    => 'panel',
			'panelId' => 'plugins',
			'command' => 'plugins',
			'data'    => ( new IndexCacheService() )->get_plugins_index(),
		];
	}

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

		return [
			'type'    => 'error',
			'command' => 'plugin ' . implode( ' ', $tokens ),
			'message' => 'Unknown plugin command.',
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
				'message' => 'You do not have permission to update plugins.',
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
				'message' => 'Plugin not found.',
			];
		}

		wp_update_plugins();
		$upgrader = new \Plugin_Upgrader( new \Automatic_Upgrader_Skin() );
		$ok       = $upgrader->upgrade( $plugin_file );

		return [
			'type'    => 'action',
			'command' => 'plugin update ' . $query,
			'status'  => $ok ? 'success' : 'error',
			'message' => $ok ? 'Plugin updated.' : 'Plugin update failed.',
			'data'    => [
				'pluginFile' => (string) $plugin_file,
				'success'    => (bool) $ok,
			],
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
				'message' => 'You do not have permission to update plugins.',
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
			return [
				'type'    => 'action',
				'command' => 'plugin update all',
				'status'  => 'success',
				'message' => 'No plugin updates available.',
				'data'    => [],
			];
		}

		$upgrader = new \Plugin_Upgrader( new \Automatic_Upgrader_Skin() );
		$results  = [];

		foreach ( $to_update as $plugin_file ) {
			$ok = $upgrader->upgrade( $plugin_file );
			$results[] = [
				'pluginFile' => (string) $plugin_file,
				'success'    => (bool) $ok,
			];
		}

		$success_count = count( array_filter( $results, static fn( $r ) => ! empty( $r['success'] ) ) );

		return [
			'type'    => 'action',
			'command' => 'plugin update all',
			'status'  => 'success',
			'message' => sprintf( '%d plugin(s) updated.', (int) $success_count ),
			'data'    => [
				'results' => $results,
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
}

