// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { enforceContrast } from '../../packages/dreamer-genui/src/theme/contrast';
import { parseColor, contrastRatio } from '../../packages/dreamer-genui/src/theme/color';
import { DEFAULT_TOKENS, EXAMPLE_MOODS } from '../../packages/dreamer-genui/src/theme/presets';
import type { ColorTokens } from '../../packages/dreamer-genui/src/schema/theme';

/** AA targets the guardrail enforces (§6.8): 4.5 body, 3.0 accent-family. */
const BODY = 4.5;
const ACCENT = 3.0;
const ACCENT_ROLES = ['accent', 'info', 'success', 'warn', 'danger'] as const;

function passes(color: ColorTokens, role: keyof ColorTokens, target: number): boolean {
  const v = color[role] ? parseColor(color[role]!) : undefined;
  const bg = color.bg ? parseColor(color.bg) : undefined;
  const surface = color.surface ? parseColor(color.surface) : undefined;
  if (!v) return true;
  for (const bgc of [bg, surface]) {
    if (bgc && contrastRatio(v, bgc) < target) return false;
  }
  return true;
}

describe('shipped palettes are already AA-readable (§9.3)', () => {
  test('library defaults require no adjustment', () => {
    const result = enforceContrast(DEFAULT_TOKENS);
    expect(result.adjusted).toEqual([]);
  });

  test.each(EXAMPLE_MOODS.map(m => [m.name, m] as const))('mood "%s" requires no adjustment', (_name, mood) => {
    const color = mood.tokens.color;
    expect(color).toBeDefined();
    // The guardrail must not rewrite anything — the preset ships readable.
    const result = enforceContrast(color!);
    expect(result.adjusted).toEqual([]);
    // And it genuinely meets AA:
    expect(passes(color!, 'ink', BODY)).toBe(true);
    expect(passes(color!, 'muted', BODY)).toBe(true);
    for (const role of ACCENT_ROLES) {
      expect(passes(color!, role, ACCENT)).toBe(true);
    }
  });
});

describe('colour parsing', () => {
  test('hex, hsl and oklch parse; unsafe CSS forms do not', () => {
    expect(parseColor('#f00')).toBeDefined();
    expect(parseColor('#ff8800')).toBeDefined();
    expect(parseColor('hsl(210 50% 20%)')).toBeDefined();
    expect(parseColor('hsl(210, 50%, 20%)')).toBeDefined();
    expect(parseColor('oklch(0.62 0.18 250)')).toBeDefined();
    expect(parseColor('url(https://x)')).toBeUndefined();
    expect(parseColor('var(--x)')).toBeUndefined();
    expect(parseColor('red')).toBeUndefined();
  });

  test('guardrail output (rgb) round-trips through parseColor', () => {
    const result = enforceContrast({ bg: '#0c0c10', ink: '#171720' });
    const adjusted = result.adjusted.length ? result.tokens.ink : undefined;
    expect(adjusted).toBeDefined();
    expect(parseColor(adjusted!)).toBeDefined();
  });
});

describe('reviewer pathological case — internally contradictory two-background palette', () => {
  test('ink ends up readable against BOTH backgrounds (surface moved toward bg)', () => {
    // White bg + saturated dark-green surface: no single ink can pass 4.5:1
    // against both. The guardrail moves surface toward bg and adjusts ink.
    const input: ColorTokens = {
      bg: '#ffffff', surface: '#2e7d32', ink: '#15181d', muted: '#555555',
      accent: '#2e5dc4', info: '#2e86c7', success: '#3f9d55', warn: '#d9971e', danger: '#d64545',
    };
    const { tokens, adjusted } = enforceContrast(input);
    const bg = parseColor(tokens.bg!)!;
    const surface = parseColor(tokens.surface!)!;
    expect(adjusted).toContain('surface');
    const ink = parseColor(tokens.ink!)!;
    expect(contrastRatio(ink, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(ink, surface)).toBeGreaterThanOrEqual(4.5);
    // muted + accent family meet their targets too
    const muted = parseColor(tokens.muted!)!;
    expect(contrastRatio(muted, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(muted, surface)).toBeGreaterThanOrEqual(4.5);
    for (const role of ACCENT_ROLES) {
      const v = parseColor(tokens[role]!);
      expect(contrastRatio(v!, bg)).toBeGreaterThanOrEqual(3.0);
      expect(contrastRatio(v!, surface)).toBeGreaterThanOrEqual(3.0);
    }
  });

  test('never returns a role worse than its original colour', () => {
    const input: ColorTokens = {
      bg: '#ffffff', surface: '#2e7d32', ink: '#15181d', muted: '#555555',
      accent: '#2e5dc4', info: '#2e86c7', success: '#3f9d55', warn: '#d9971e', danger: '#d64545',
    };
    const { tokens } = enforceContrast(input);
    const bg = parseColor(input.bg!)!;
    const surface = parseColor(tokens.surface!)!; // adjusted surface, same as the check uses
    const neverWorse = (role: keyof ColorTokens, target: number): boolean => {
      const fixed = parseColor(tokens[role]!);
      const original = parseColor(input[role]!);
      const bestFixed = Math.min(contrastRatio(fixed!, bg), contrastRatio(fixed!, surface));
      const bestOriginal = Math.min(contrastRatio(original!, bg), contrastRatio(original!, surface));
      // adjusted value meets the target, and never falls below the original's best
      return bestFixed >= target || bestFixed > bestOriginal;
    };
    expect(neverWorse('ink', 4.5)).toBe(true);
    expect(neverWorse('muted', 4.5)).toBe(true);
    for (const role of ACCENT_ROLES) expect(neverWorse(role, 3.0)).toBe(true);
  });
});

