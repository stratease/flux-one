import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DEV_UI_REGISTRY } from './registry';

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.')) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...walkFiles(full));
      continue;
    }
    out.push(full);
  }
  return out;
}

function normalizeSlash(p: string): string {
  return p.replace(/\\/g, '/');
}

describe('DEV_UI_REGISTRY completeness', () => {
  it('covers all ui source files', () => {
    const repoRoot = path.resolve(__dirname, '../../../../..');
    const uiRoot = path.join(repoRoot, 'assets/js/src/ui');

    const files = walkFiles(uiRoot)
      .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
      .filter((f) => !/\.test\.(ts|tsx)$/.test(f))
      .map((f) => normalizeSlash(path.relative(repoRoot, f)));

    const registered = new Set(DEV_UI_REGISTRY.map((r) => r.file));

    const missing = files.filter((f) => !registered.has(f));
    expect(missing).toEqual([]);
  });
});

