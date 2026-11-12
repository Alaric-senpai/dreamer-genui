import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_VARS } from '../../packages/dreamer-genui/src/theme/tokens';

const css = readFileSync(join(__dirname, '../../packages/dreamer-genui/styles/base.css'), 'utf8');

describe('base.css (§7.6 styling architecture)', () => {
  test('is wrapped in @layer dreamer-genui (host utilities always win)', () => {
    expect(css).toMatch(/@layer dreamer-genui;/);
    expect(css).toMatch(/@layer dreamer-genui \{/);
  });

  test('declares no --dgui- legacy variable anywhere', () => {
    expect(css.includes('--dgui-')).toBe(false);
  });

  test('every colour role default equals the engine DEFAULT_VARS (cannot drift)', () => {
    for (const [key, value] of Object.entries(DEFAULT_VARS)) {
      if (!key.startsWith('--dg-color-')) continue;
      const re = new RegExp(`var\\(${key},\\s*#([0-9a-fA-F]{3,6})\\)`, 'g');
      // every occurrence must match — one drifted fallback among many is still drift
      const fallbacks = [...css.matchAll(re)].map((m) => m[1] ?? '');
      expect(fallbacks.length, `${key} fallbacks in base.css`).toBeGreaterThan(0);
      for (const got of fallbacks) {
        expect(got.toLowerCase(), key).toBe(value.replace('#', '').toLowerCase());
      }
    }
  });

  test('declares a reduced-motion block that calms transitions and animations', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(css).toMatch(/--dg-theme-duration:\s*1ms/);
  });

  test('the board root consumes the theme-transition knobs (§6.8 tween, never a cut)', () => {
    expect(css).toMatch(/transition:[\s\S]*--dg-theme-duration/);
    expect(css).toMatch(/--dg-theme-ease/);
  });

  test('low-feel textures (grain/vignette) are not fake-implemented; surfaces stay data hooks', () => {
    expect(css).toMatch(/data-dg-surface/);
  });

  test('annotate circle/bracket have visible M3 shapes (hand-drawn strokes are M5)', () => {
    expect(css).toMatch(/\.dg-annotate-circle\s*\{[^}]*border-radius:\s*999px/);
    expect(css).toMatch(/\.dg-annotate-bracket\s*\{[^}]*border-inline:\s*2px solid/);
  });
});
