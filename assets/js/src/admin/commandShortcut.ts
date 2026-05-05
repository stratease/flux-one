/**
 * Shared shortcut parsing for admin loader and Command Bar.
 *
 * @since 1.2.1
 */

export function parseShortcut(raw: string) {
  const s = String(raw || '')
    .toLowerCase()
    .trim();
  const parts = s ? s.split('+').map((p) => p.trim()).filter(Boolean) : [];
  const hasMod = parts.includes('mod');
  const hasShift = parts.includes('shift');
  const hasAlt = parts.includes('alt') || parts.includes('option');
  const key =
    parts.find((p) => !['mod', 'shift', 'alt', 'option', 'ctrl', 'cmd', 'meta'].includes(p)) || '';
  return { hasMod, hasShift, hasAlt, key };
}

/**
 * ASCII admin bar hotkey (Ctrl vs Cmd words, "+" separators).
 *
 * @since 1.2.1
 */
export function formatAdminBarHotkeyText(raw: string, modifierWord: 'ctrl' | 'cmd'): string {
  const shortcutRaw = String(raw || '').trim();
  const effective =
    shortcutRaw && shortcutRaw.toLowerCase().includes('mod+') ? shortcutRaw : 'mod+.';
  const { hasMod, hasShift, hasAlt, key } = parseShortcut(effective);
  const parts: string[] = [];
  if (hasMod) {
    parts.push(modifierWord === 'cmd' ? 'Cmd' : 'Ctrl');
  }
  if (hasShift) {
    parts.push('Shift');
  }
  if (hasAlt) {
    parts.push('Alt');
  }
  const k = key ? (key.length === 1 ? key.toUpperCase() : key) : '.';
  parts.push(k);
  return parts.join('+');
}
