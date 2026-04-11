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
				'recent_commands'   => [],
				'pinned_commands'   => [],
				'frequent_entities' => [],
				'last_site_context' => '',
			]
		);
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

