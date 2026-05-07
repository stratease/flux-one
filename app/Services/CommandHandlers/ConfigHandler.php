<?php
/**
 * `config` command: list, get, set Flux suite settings (active plugins only).
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Services\CommandHandlers;

use FluxOne\App\Services\SuiteConfigCatalog;

/**
 * Handles `config …` with case-sensitive values for secrets (raw input).
 *
 * @since 0.1.0
 */
class ConfigHandler {

	/**
	 * @param string $raw_input Untrimmed original command (preserves API key casing).
	 * @return array
	 */
	public function handle_raw( string $raw_input ) {
		$raw = trim( $raw_input );
		if ( ! preg_match( '/^config(\s|$)/i', $raw ) ) {
			return [
				'type'    => 'error',
				'command' => $raw,
				'message' => 'Expected config command.',
			];
		}

		$rest = trim( (string) preg_replace( '/^config\s*/i', '', $raw ) );
		$low  = strtolower( $rest );
		$toks = $low === '' ? [] : preg_split( '/\s+/', $low );

		if ( isset( $toks[0] ) && 'search' === $toks[0] ) {
			return [
				'type'    => 'error',
				'command' => $raw,
				'message' => __( '`config search` was removed. Use `config list` for the full grid, or type `config get` / `config set` and pick a key from suggestions.', 'flux-one' ),
			];
		}

		if ( $rest === '' || ( isset( $toks[0] ) && 'list' === $toks[0] ) ) {
			return $this->panel_list();
		}

		if ( preg_match( '/^config\s+get\s+(\S+)\s*$/i', $raw, $gm ) ) {
			return $this->do_get( strtolower( $gm[1] ) );
		}

		if ( preg_match( '/^config\s+set\s+(\S+)\s*(.*)$/is', $raw, $sm ) ) {
			return $this->do_set( strtolower( trim( $sm[1] ) ), $sm[2] );
		}

		return [
			'type'    => 'error',
			'command' => $raw,
			'message' => __( 'Unknown config command. Try: `config list`, `config get {id}`, `config set {id} {value}`.', 'flux-one' ),
		];
	}

	/**
	 * Full catalog panel for `config list` (filtering is client-side via suite-config index).
	 *
	 * @since 1.7.0 Panel rows include group metadata, min/max, and choices for suite config UI.
	 * @since 1.5.0 Drops query filtering; `config search` removed.
	 */
	private function panel_list() {
		$defs = SuiteConfigCatalog::get_available_definitions();
		$rows = [];

		foreach ( $defs as $def ) {
			$raw = SuiteConfigCatalog::get_value( $def );
			$row = [
				'id'           => (string) $def['id'],
				'plugin'       => (string) ( $def['plugin'] ?? '' ),
				'label'        => (string) ( $def['label'] ?? '' ),
				'type'         => (string) ( $def['type'] ?? '' ),
				'valueDisplay' => SuiteConfigCatalog::format_display( $def, $raw ),
				'group'        => (string) ( $def['group'] ?? '' ),
				'groupLabel'   => (string) ( $def['group_label'] ?? '' ),
				'groupOrder'   => (int) ( $def['group_order'] ?? 0 ),
			];
			if ( isset( $def['min'] ) ) {
				$row['min'] = (int) $def['min'];
			}
			if ( isset( $def['max'] ) ) {
				$row['max'] = (int) $def['max'];
			}
			if ( isset( $def['choices'] ) && is_array( $def['choices'] ) ) {
				$row['choices'] = array_values(
					array_filter(
						array_map( 'strval', $def['choices'] ),
						static function ( $v ) {
							return $v !== '';
						}
					)
				);
			}
			$rows[] = $row;
		}

		return [
			'type'    => 'panel',
			'panelId' => 'suite_config',
			'command' => 'config list',
			'data'    => $rows,
		];
	}

	private function do_get( string $id ) {
		$def = SuiteConfigCatalog::find( $id );
		if ( ! $def ) {
			return [
				'type'    => 'error',
				'command' => 'config get ' . $id,
				'message' => 'Unknown or unavailable config id (is the plugin active?). Try `config list`.',
			];
		}
		$raw = SuiteConfigCatalog::get_value( $def );
		return [
			'type'    => 'action',
			'command' => 'config get ' . $def['id'],
			'status'  => 'success',
			'message' => (string) $def['label'] . ': ' . SuiteConfigCatalog::format_display( $def, $raw ),
			'data'    => [
				'id'           => (string) $def['id'],
				'type'         => (string) ( $def['type'] ?? '' ),
				'valueDisplay' => SuiteConfigCatalog::format_display( $def, $raw ),
			],
		];
	}

	private function do_set( string $id, string $value_raw ) {
		$def = SuiteConfigCatalog::find( $id );
		if ( ! $def ) {
			return [
				'type'    => 'error',
				'command' => 'config set ' . $id,
				'message' => 'Unknown or unavailable config id (is the plugin active?). Try `config list`.',
			];
		}

		$type = (string) ( $def['type'] ?? 'string' );
		$trim = trim( $value_raw );

		if ( 'bool' === $type ) {
			$parsed = SuiteConfigCatalog::parse_bool( $trim );
			if ( is_wp_error( $parsed ) ) {
				return [
					'type'    => 'error',
					'command' => 'config set ' . $id,
					'message' => $parsed->get_error_message(),
				];
			}
			$value = $parsed;
		} elseif ( 'int' === $type ) {
			$min = (int) ( $def['min'] ?? PHP_INT_MIN );
			$max = (int) ( $def['max'] ?? PHP_INT_MAX );
			$parsed = SuiteConfigCatalog::parse_int( $trim, $min, $max );
			if ( is_wp_error( $parsed ) ) {
				return [
					'type'    => 'error',
					'command' => 'config set ' . $id,
					'message' => $parsed->get_error_message(),
				];
			}
			$value = $parsed;
		} elseif ( 'enum' === $type ) {
			$v = strtolower( $trim );
			$choices = isset( $def['choices'] ) && is_array( $def['choices'] ) ? $def['choices'] : [];
			$match   = null;
			foreach ( $choices as $c ) {
				if ( strtolower( (string) $c ) === $v ) {
					$match = (string) $c;
					break;
				}
			}
			if ( $match === null ) {
				return [
					'type'    => 'error',
					'command' => 'config set ' . $id,
					'message' => 'Invalid value. Allowed: ' . implode( ', ', $choices ),
				];
			}
			$value = $match;
		} else {
			// secret / string: use raw trimmed (preserves case from original command).
			$value = $trim;
		}

		$ok = SuiteConfigCatalog::set_value( $def, $value );
		if ( is_wp_error( $ok ) ) {
			return [
				'type'    => 'error',
				'command' => 'config set ' . $id,
				'message' => $ok->get_error_message(),
			];
		}

		$after = SuiteConfigCatalog::get_value( $def );

		return [
			'type'    => 'action',
			'command' => 'config set ' . $def['id'],
			'status'  => 'success',
			'message' => 'Updated ' . (string) $def['label'] . ' → ' . SuiteConfigCatalog::format_display( $def, $after ),
			'data'    => [
				'id'           => (string) $def['id'],
				'valueDisplay' => SuiteConfigCatalog::format_display( $def, $after ),
			],
		];
	}
}
