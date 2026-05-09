import { describe, expect, it } from 'vitest';
import { DEV_UI_REGISTRY } from './registry';

describe('DEV_UI_REGISTRY shape', () => {
  it('has unique name+file and render function', () => {
    const seen = new Set<string>();
    for (const item of DEV_UI_REGISTRY) {
      expect(typeof item.name).toBe('string');
      expect(item.name.trim().length).toBeGreaterThan(0);
      expect(typeof item.file).toBe('string');
      expect(item.file.includes('assets/js/src/ui/')).toBe(true);
      expect(typeof item.render).toBe('function');

      const key = `${item.name}@@${item.file}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

