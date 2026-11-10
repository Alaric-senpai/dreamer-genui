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
      const re = new RegExp(`var\\(${key},\\s*#([0-9a-fA-F]{3,6})\\)`);
      const got = css.match(re)?.[1];
      expect(got, `${key} fallback in base.css`).toBeDefined();
      expect(got!.toLowerCase(), key).toBe(value.replace('#', '').toLowerCase());
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
});
