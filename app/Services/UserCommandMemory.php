<?php
/**
 * Per-user command memory.
 *
 * @package FluxOne
 * @since 0.1.0
 */

namespace FluxOne\App\Services;

/**
 * Stores recent commands, pins, frequent entities, and last site context.
 *
 * @since 0.1.0
 */
class UserCommandMemory {

	/**
	 * User meta key.
	 *
	 * @since 0.1.0
	 */
	private const META_KEY = '_flux_one_command_memory';

	/**
	 * Get memory array.
	 *
	 * @since 0.1.0
	 * @return array
	 */
	public function get() {
		$user_id = get_current_user_id();
		$raw     = get_user_meta( $user_id, self::META_KEY, true );
		$mem     = is_array( $raw ) ? $raw : [];

		return wp_parse_args(
			$mem,
			[
				'recent_commands'      => [],
				'recent_navigations'   => [],
				'pinned_commands'      => [],
				'frequent_entities'    => [],
				'last_site_context'    => '',
			]
		);
	}

	/**
	 * Recent admin destinations for the dashboard widget (max 5).
	 *
	 * Each row may include `url` (visited admin screen), `command` (optional `nav …`), and `label`.
	 *
	 * @since 0.1.0
	 * @return array<int, array{label: string, url?: string, command?: string}>
	 */
	public function get_recent_navigations() {
		$mem = $this->get();
		$nav = isset( $mem['recent_navigations'] ) && is_array( $mem['recent_navigations'] )
			? $mem['recent_navigations']
			: [];

		$out = [];
		foreach ( $nav as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$url = isset( $row['url'] ) ? trim( (string) $row['url'] ) : '';
			$cmd = isset( $row['command'] ) ? trim( (string) $row['command'] ) : '';
			if ( '' === $url && '' === $cmd ) {
				continue;
			}
			$resolved = '' !== $url ? esc_url_raw( $url ) : $this->resolve_nav_command_to_url( $cmd );
			if ( '' === $resolved ) {
				continue;
			}
			$label = isset( $row['label'] ) && is_string( $row['label'] ) && $row['label'] !== ''
				? $row['label']
				: ( $cmd !== '' ? $cmd : __( 'Admin', 'flux-one' ) );

			$item = [
				'label' => $label,
				'url'   => $resolved,
			];
			if ( '' !== $cmd ) {
				$item['command'] = $cmd;
			}
			$out[] = $item;
		}

		return array_slice( $out, 0, 5 );
	}

	/**
	 * Record a visited admin URL (e.g. any wp-admin screen load).
	 *
	 * @since 0.1.0
	 * @param string      $url     Full same-origin admin URL.
	 * @param string      $label   Human-readable title.
	 * @param string|null $command Optional canonical `nav …` when known.
	 * @return void
	 */
	public function add_recent_destination( $url, $label, $command = null ) {
		$url = trim( (string) $url );
		if ( '' === $url ) {
			return;
		}

		$label = trim( (string) $label );
		if ( '' === $label ) {
			$label = __( 'Admin', 'flux-one' );
		}

		$command = null !== $command ? trim( (string) $command ) : '';
		$command = '' !== $command ? $command : null;

		$this->push_recent_destination_row(
			[
				'url'     => esc_url_raw( $url ),
				'label'   => $label,
				'command' => $command,
			]
		);
	}

	/**
	 * Record a successful `nav` command (resolves URL when possible for deduplication with page visits).
	 *
	 * @since 0.1.0
	 * @param string      $command Canonical command.
	 * @param string|null $label   Optional admin label.
	 * @param string|null $url     Optional known target URL (from NavigationHandler).
	 * @return void
	 */
	public function add_recent_navigation( $command, $label = null, $url = null ) {
		$command = trim( (string) $command );
		if ( '' === $command ) {
			return;
		}

		$command = preg_replace( '/^(go|open)\s+/i', 'nav ', $command );
		$command = trim( (string) $command );
		if ( stripos( $command, 'nav ' ) !== 0 ) {
			$command = 'nav ' . $command;
		}
		$command = trim( preg_replace( '/\s+/', ' ', $command ) );

		$resolved_url = null;
		if ( is_string( $url ) && $url !== '' ) {
			$resolved_url = esc_url_raw( $url );
		} else {
			if ( preg_match( '/^nav\s+(.+)$/i', $command, $m ) ) {
				$hit = AdminDestinations::resolve( strtolower( trim( $m[1] ) ) );
				if ( is_array( $hit ) && ! empty( $hit['url'] ) ) {
					$resolved_url = esc_url_raw( (string) $hit['url'] );
				}
			}
		}

		$label_use = is_string( $label ) && $label !== '' ? $label : $command;

		$this->push_recent_destination_row(
			[
				'url'     => $resolved_url,
				'label'   => $label_use,
				'command' => $command,
			]
		);
	}

	/**
	 * De-dupe by normalized URL (preferred) or canonical command, cap at five.
	 *
	 * @since 0.1.0
	 * @param array{url?: string|null, label: string, command?: string|null} $entry Entry.
	 * @return void
	 */
	private function push_recent_destination_row( array $entry ) {
		$key = $this->destination_dedupe_key( $entry );
		if ( '' === $key ) {
			return;
		}

		$mem  = $this->get();
		$list = isset( $mem['recent_navigations'] ) && is_array( $mem['recent_navigations'] )
			? $mem['recent_navigations']
			: [];

		$labels_for_merge = [ (string) ( $entry['label'] ?? '' ) ];
		$filtered          = [];
		foreach ( $list as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			if ( $this->destination_dedupe_key( $row ) === $key ) {
				if ( isset( $row['label'] ) && is_string( $row['label'] ) ) {
					$labels_for_merge[] = $row['label'];
				}
				continue;
			}
			$filtered[] = $row;
		}

		$resolved = $this->resolve_entry_url_for_storage( $entry );

		$store = [
			'label' => $this->pick_preferred_navigation_label( $labels_for_merge ),
		];
		if ( '' !== $resolved ) {
			$store['url'] = $resolved;
		}
		if ( ! empty( $entry['command'] ) ) {
			$store['command'] = (string) $entry['command'];
		}

		array_unshift( $filtered, $store );
		$mem['recent_navigations'] = array_slice( $filtered, 0, 5 );
		$this->save( $mem );
	}

	/**
	 * Stable key for de-duplication.
	 *
	 * @since 0.1.0
	 * @param array<string, mixed> $row Row.
	 * @return string
	 */
	private function destination_dedupe_key( array $row ) {
		$effective = $this->resolve_row_url_for_dedupe( $row );
		if ( '' !== $effective ) {
			return 'u:' . $this->normalize_visit_url_for_key( $effective );
		}
		$cmd = isset( $row['command'] ) ? trim( (string) $row['command'] ) : '';
		if ( '' !== $cmd ) {
			return 'c:' . strtolower( $cmd );
		}

		return '';
	}

	/**
	 * URL for dedupe: stored url or resolved nav target.
	 *
	 * @param array<string, mixed> $row Row.
	 * @return string
	 */
	private function resolve_row_url_for_dedupe( array $row ) {
		$url = isset( $row['url'] ) ? trim( (string) $row['url'] ) : '';
		if ( '' !== $url ) {
			return esc_url_raw( $url );
		}
		$cmd = isset( $row['command'] ) ? trim( (string) $row['command'] ) : '';
		return $this->resolve_nav_command_to_url( $cmd );
	}

	/**
	 * Best URL to persist (prefer explicit url, else resolve nav command).
	 *
	 * @param array<string, mixed> $entry Entry.
	 * @return string
	 */
	private function resolve_entry_url_for_storage( array $entry ) {
		$url = isset( $entry['url'] ) ? trim( (string) $entry['url'] ) : '';
		if ( '' === $url ) {
			$cmd = isset( $entry['command'] ) ? trim( (string) $entry['command'] ) : '';
			$url = $this->resolve_nav_command_to_url( $cmd );
		}
		if ( '' === $url ) {
			return '';
		}
		return $this->normalize_storage_url( $url );
	}

	/**
	 * Resolve `nav …` command to admin URL when possible.
	 *
	 * @param string $command Command string.
	 * @return string Escaped URL or empty.
	 */
	private function resolve_nav_command_to_url( $command ) {
		$command = trim( (string) $command );
		if ( '' === $command || ! preg_match( '/^nav\s+(.+)$/i', $command, $m ) ) {
			return '';
		}
		$hit = AdminDestinations::resolve( strtolower( trim( $m[1] ) ) );
		if ( is_array( $hit ) && ! empty( $hit['url'] ) ) {
			return esc_url_raw( (string) $hit['url'] );
		}
		return '';
	}

	/**
	 * Prefer human-looking labels (e.g. "Dashboard" over "dashboard") when merging duplicates.
	 *
	 * @param string[] $labels Candidate labels.
	 * @return string
	 */
	private function pick_preferred_navigation_label( array $labels ) {
		$labels = array_values(
			array_filter(
				array_map( 'trim', $labels ),
				static fn( $l ) => is_string( $l ) && $l !== ''
			)
		);
		if ( empty( $labels ) ) {
			return __( 'Admin', 'flux-one' );
		}
		$best       = $labels[0];
		$best_score = -1.0;
		foreach ( $labels as $l ) {
			$score = 0.0;
			if ( preg_match( '/[A-Z\x{C0}-\x{FF}]/u', $l ) ) {
				$score += 10.0;
			}
			if ( strcspn( $l, ' ' ) < strlen( $l ) ) {
				$score += 5.0;
			}
			$score += min( strlen( $l ), 40 ) / 40.0;
			if ( $score > $best_score ) {
				$best_score = $score;
				$best       = $l;
			}
		}
		return $best;
	}

	/**
	 * Normalize URL for storage and comparison.
	 *
	 * Keeps same-origin admin URLs canonical enough for dedupe without depending on exact dashboard alias shape.
	 *
	 * @since 0.1.0
	 * @param string $url URL.
	 * @return string
	 */
	private function normalize_storage_url( $url ) {
		$url = esc_url_raw( (string) $url );
		if ( '' === $url ) {
			return '';
		}

		$parts = wp_parse_url( $url );
		if ( ! is_array( $parts ) ) {
			return $url;
		}

		$scheme = isset( $parts['scheme'] ) ? strtolower( (string) $parts['scheme'] ) : 'http';
		$host   = isset( $parts['host'] ) ? strtolower( (string) $parts['host'] ) : '';
		$path   = isset( $parts['path'] ) ? (string) $parts['path'] : '';
		$path   = $this->normalize_admin_dashboard_path_for_key( $path );

		$query = [];
		if ( ! empty( $parts['query'] ) ) {
			parse_str( (string) $parts['query'], $query );
			ksort( $query );
		}

		$rebuilt = $scheme . '://' . $host . $path;
		$q       = http_build_query( $query );
		if ( '' !== $q ) {
			$rebuilt .= '?' . $q;
		}

		return $rebuilt;
	}

	/**
	 * Normalize URL for comparison (host lowercased, query args sorted).
	 *
	 * @since 0.1.0
	 * @param string $url URL.
	 * @return string
	 */
	private function normalize_visit_url_for_key( $url ) {
		$url = esc_url_raw( $url );
		$parts = wp_parse_url( $url );
		if ( ! is_array( $parts ) ) {
			return strtolower( $url );
		}

		$scheme = isset( $parts['scheme'] ) ? strtolower( (string) $parts['scheme'] ) : 'http';
		$host   = isset( $parts['host'] ) ? strtolower( (string) $parts['host'] ) : '';
		$path   = isset( $parts['path'] ) ? (string) $parts['path'] : '';
		$path   = $this->normalize_admin_dashboard_path_for_key( $path );

		$query = [];
		if ( ! empty( $parts['query'] ) ) {
			parse_str( (string) $parts['query'], $query );
			ksort( $query );
		}

		$q = http_build_query( $query );

		return $scheme . '://' . $host . $path . ( $q !== '' ? '?' . $q : '' );
	}

	/**
	 * Map wp-admin root and index.php to one canonical path for dedupe keys.
	 *
	 * @param string $path URL path.
	 * @return string
	 */
	private function normalize_admin_dashboard_path_for_key( $path ) {
		$lower = str_replace( '\\', '/', strtolower( $path ) );
		if ( preg_match( '#/wp-admin/?$#', $lower ) || preg_match( '#/wp-admin/index\.php$#', $lower ) ) {
			return preg_replace( '#/wp-admin/?(?:index\.php)?$#i', '/wp-admin/index.php', $path );
		}
		return $path;
	}

	/**
	 * Add a recent command (canonical only).
	 *
	 * @since 0.1.0
	 * @param string $command Canonical command.
	 * @return void
	 */
	public function add_recent_command( $command ) {
		$command = trim( (string) $command );
		if ( '' === $command ) {
			return;
		}

		$mem = $this->get();
		$recent = (array) $mem['recent_commands'];

		// De-dup then unshift.
		$recent = array_values( array_filter( $recent, static fn( $c ) => (string) $c !== $command ) );
		array_unshift( $recent, $command );
		$recent = array_slice( $recent, 0, 50 );

		$mem['recent_commands'] = $recent;
		$this->save( $mem );
	}

	/**
	 * Set last multisite context blog id.
	 *
	 * @since 0.1.0
	 * @param int $blog_id Blog id.
	 * @return void
	 */
	public function set_last_site_context( $blog_id ) {
		$mem = $this->get();
		$mem['last_site_context'] = (string) (int) $blog_id;
		$this->save( $mem );
	}

	/**
	 * Save memory.
	 *
	 * @since 0.1.0
	 * @param array $mem Memory.
	 * @return void
	 */
	private function save( $mem ) {
		$user_id = get_current_user_id();
		update_user_meta( $user_id, self::META_KEY, (array) $mem );
	}
}

