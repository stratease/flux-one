<?php
/**
 * Admin bar hotkey label (Ctrl-first; client may swap to Cmd on Apple-like platforms).
 *
 * @package FluxOne
 * @since 1.2.1
 */

namespace FluxOne\App\Services;

/**
 * Builds ASCII hotkey text for the Flux One admin bar item.
 *
 * @since 1.2.1
 */
final class AdminBarHotkeyDisplay {

	/**
	 * Normalize stored shortcut string for parsing.
	 *
	 * @since 1.2.1
	 * @param string $raw Raw user shortcut setting.
	 * @return string Lowercase, no spaces; defaults to mod+. when invalid.
	 */
	public static function normalize_shortcut_raw( string $raw ): string {
		$raw = strtolower( trim( $raw ) );
		$raw = (string) preg_replace( '/\s+/', '', $raw );
		if ( '' === $raw || false === strpos( $raw, 'mod+' ) ) {
			return 'mod+.';
		}
		return $raw;
	}

	/**
	 * Build inner hotkey fragment for parentheses, e.g. Ctrl+. — uses Ctrl for mod (client refines to Cmd when appropriate).
	 *
	 * @since 1.2.1
	 * @param string $normalized_raw Output of normalize_shortcut_raw().
	 * @return string Inner label without outer parentheses.
	 */
	public static function inner_text_from_normalized_raw( string $normalized_raw ): string {
		$parts = array_values( array_filter( array_map( 'trim', explode( '+', $normalized_raw ) ) ) );
		$key   = '';
		$mods  = [];
		foreach ( $parts as $p ) {
			if ( in_array( $p, [ 'mod', 'shift', 'alt', 'option', 'ctrl', 'cmd', 'meta' ], true ) ) {
				$mods[] = $p;
				continue;
			}
			$key = $p;
		}
		$label_parts = [];
		if ( in_array( 'mod', $mods, true ) ) {
			$label_parts[] = 'Ctrl';
		}
		if ( in_array( 'shift', $mods, true ) ) {
			$label_parts[] = 'Shift';
		}
		if ( in_array( 'alt', $mods, true ) || in_array( 'option', $mods, true ) ) {
			$label_parts[] = 'Alt';
		}
		$key = $key ? ( 1 === strlen( $key ) ? strtoupper( $key ) : $key ) : '.';
		$label_parts[] = $key;
		return implode( '+', $label_parts );
	}
}
