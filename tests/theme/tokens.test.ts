// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import {
  DEFAULT_VARS,
  resolveTheme,
  tokensToVars,
  type CssTokens,
} from '../../packages/dreamer-genui/src/theme/tokens';
import { DEFAULT_TOKENS } from '../../packages/dreamer-genui/src/theme/presets';

/** All `--dg-*` variables must be unparsed, protocol-safe values (no url()/var() chains). */
describe('CSS token map (§7.6 — name map logged in DECISIONS.md)', () => {
  test('DEFAULT_VARS covers every colour role from the theme resolver', () => {
    for (const [role, value] of Object.entries(DEFAULT_TOKENS)) {
      expect(DEFAULT_VARS[`--dg-color-${role}`]).toBe(value);
    }
  });

  test('the light preset carries typography, type scale, shape, space, motion and texture tokens', () => {
    const required = [
      '--dg-font-display', '--dg-font-body', '--dg-font-mono',
      '--dg-text-hero', '--dg-text-heading', '--dg-text-body', '--dg-text-small', '--dg-text-kicker',
      '--dg-radius-sm', '--dg-radius-md', '--dg-radius-lg',
      '--dg-space-scale',
      '--dg-motion-speed', '--dg-motion-ease', '--dg-motion-duration-base',
      '--dg-texture-grain', '--dg-texture-vignette',
    ];
    for (const key of required) {
      expect(DEFAULT_VARS[key], key).toBeDefined();
    }
  });

  test('every name uses the --dg- prefix — nothing may keep the old --dgui- names', () => {
    for (const key of Object.keys(DEFAULT_VARS)) {
      expect(key.startsWith('--dg-')).toBe(true);
      expect(key.startsWith('--dgui-')).toBe(false);
    }
  });

  test('dark preset differs from light on bg/ink and keeps all tokens defined', () => {
    const light = resolveTheme('light');
    const dark = resolveTheme('dark');
    for (const key of Object.keys(light)) {
      expect(dark[key], key).toBeDefined();
    }
    expect(dark['--dg-color-bg']).not.toBe(light['--dg-color-bg']);
    expect(dark['--dg-color-ink']).not.toBe(light['--dg-color-ink']);
  });

  test('resolveTheme accepts token overrides layered on top of the named preset', () => {
    const vars = resolveTheme('light', { color: { bg: '#123456' } });
    expect(vars['--dg-color-bg']).toBe('#123456');
    expect(vars['--dg-color-ink']).toBe(resolveTheme('light')['--dg-color-ink']);
  });
});

describe('tokensToVars — schema ThemeTokens → --dg-* variables', () => {
  test('maps every group', (): void => {
    const vars = tokensToVars({
      color: { bg: '#0c0c10', ink: '#e8e8ee', accent: '#7c9eff' },
      font: { display: 'Montserrat', body: 'Inter', mono: 'JetBrains Mono' },
      radius: { sm: 4, md: 8, lg: 16 },
      space: { scale: 1.25 },
      motion: { speed: 1.5, ease: 'snappy' },
      texture: { grain: 0.2, vignette: 0.4 },
    });
    expect(vars['--dg-color-bg']).toBe('#0c0c10');
    expect(vars['--dg-color-accent']).toBe('#7c9eff');
    expect(vars['--dg-font-display']).toBe('Montserrat');
    expect(vars['--dg-font-mono']).toBe('JetBrains Mono');
    expect(vars['--dg-radius-sm']).toBe('4px');
    expect(vars['--dg-radius-lg']).toBe('16px');
    expect(vars['--dg-space-scale']).toBe('1.25');
    expect(vars['--dg-motion-speed']).toBe('1.5');
    expect(vars['--dg-motion-ease']).toBe('snappy');
    expect(vars['--dg-texture-grain']).toBe('0.2');
    expect(vars['--dg-texture-vignette']).toBe('0.4');
    // no leak of unset roles
    expect(vars['--dg-color-danger']).toBeUndefined();
  });

  test('omit groups and extras stay out', () => {
    const vars = tokensToVars({});
    expect(Object.keys(vars).length).toBe(0);
  });

  test('the base layer and spec layer merge (base < spec)', () => {
    const base = resolveTheme('light');
    const spec = tokensToVars({ color: { ink: '#a4a4c0' } });
    const merged: CssTokens = { ...base, ...spec };
    expect(merged['--dg-color-ink']).toBe('#a4a4c0');
    expect(merged['--dg-color-bg']).toBe(base['--dg-color-bg']);
  });
});
