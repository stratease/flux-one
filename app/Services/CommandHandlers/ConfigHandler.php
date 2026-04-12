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

		if ( $rest === '' || ( isset( $toks[0] ) && 'list' === $toks[0] ) ) {
			return $this->panel_list();
		}

		if ( isset( $toks[0] ) && 'search' === $toks[0] ) {
			$q = trim( (string) preg_replace( '/^search\s*/i', '', $rest ) );
			return $this->panel_list( $q );
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
			'message' => 'Unknown config command. Try: config list, config search {query}, config get {id}, config set {id} {value}',
		];
	}

	private function panel_list( string $query = '' ) {
		$defs = SuiteConfigCatalog::get_available_definitions();
		$q    = strtolower( trim( $query ) );
		$rows = [];

		foreach ( $defs as $def ) {
			$hay = strtolower(
				( $def['id'] ?? '' ) . ' ' .
				( $def['label'] ?? '' ) . ' ' .
				( $def['plugin'] ?? '' ) . ' ' .
				( $def['search'] ?? '' )
			);
			if ( $q !== '' && strpos( $hay, $q ) === false ) {
				continue;
			}
			$raw = SuiteConfigCatalog::get_value( $def );
			$rows[] = [
				'id'          => (string) $def['id'],
				'plugin'      => (string) ( $def['plugin'] ?? '' ),
				'label'       => (string) ( $def['label'] ?? '' ),
				'type'        => (string) ( $def['type'] ?? '' ),
				'valueDisplay' => SuiteConfigCatalog::format_display( $def, $raw ),
			];
		}

		return [
			'type'    => 'panel',
			'panelId' => 'suite_config',
			'command' => $q === '' ? 'config list' : 'config search ' . $query,
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
