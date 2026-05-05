<?php
/**
 * Admin bar hotkey display strings.
 *
 * @package FluxOne
 */

use PHPUnit\Framework\TestCase;
use FluxOne\App\Services\AdminBarHotkeyDisplay;

/**
 * @covers \FluxOne\App\Services\AdminBarHotkeyDisplay
 */
class AdminBarHotkeyDisplayTest extends TestCase {

	public function test_mod_default_uses_ctrl_not_slash_cmd(): void {
		$normalized = AdminBarHotkeyDisplay::normalize_shortcut_raw( '' );
		$this->assertSame( 'mod+.', $normalized );
		$inner = AdminBarHotkeyDisplay::inner_text_from_normalized_raw( $normalized );
		$this->assertStringStartsWith( 'Ctrl', $inner );
		$this->assertStringNotContainsString( 'Ctrl/Cmd', $inner );
		$this->assertSame( 'Ctrl+.', $inner );
	}

	public function test_mod_shift_k_ctrl_first(): void {
		$normalized = AdminBarHotkeyDisplay::normalize_shortcut_raw( 'mod+shift+k' );
		$this->assertSame( 'mod+shift+k', $normalized );
		$inner = AdminBarHotkeyDisplay::inner_text_from_normalized_raw( $normalized );
		$this->assertSame( 'Ctrl+Shift+K', $inner );
	}
}
