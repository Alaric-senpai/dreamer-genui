import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_VARS } from '../../packages/dreamer-genui/src/theme/tokens';

const base = readFileSync(join(__dirname, '../../packages/dreamer-genui/styles/base.css'), 'utf8');
const heroRule = /\.dg-text-hero\s*\{([\s\S]*?)\}/.exec(base)?.[1] ?? '';

describe('hero typography (§9.2 + review fix)', () => {
  test('long words wrap instead of overflowing a 320px viewport', () => {
    expect(heroRule).toMatch(/overflow-wrap:\s*anywhere/);
  });

  test('the exported token scale cannot drift from the stylesheet fallback', () => {
    const cssClamp = /font-size:\s*var\(--dg-text-hero,\s*(clamp\([^)]*\))\)/.exec(heroRule)?.[1]?.trim();
    expect(cssClamp).toBeTruthy();
    expect(DEFAULT_VARS['--dg-text-hero']).toBe(cssClamp);
  });
});
