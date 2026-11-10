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
});
