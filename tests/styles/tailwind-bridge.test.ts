import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_VARS } from '../../packages/dreamer-genui/src/theme/tokens';

const bridge = readFileSync(join(__dirname, '../../packages/dreamer-genui/styles/tailwind.css'), 'utf8');
const preset = readFileSync(join(__dirname, '../../packages/dreamer-genui/styles/tailwind-preset.cjs'), 'utf8');
/** The bridge header legitimately *mentions* `@import 'tailwindcss'` while documenting usage. */
const bridgeCode = bridge.replace(/\/\*[\s\S]*?\*\//g, '');

describe('tailwind bridge (§7.6)', () => {
  test('does not import Tailwind itself (hosts import the bridge AFTER their own tailwindcss import)', () => {
    expect(bridgeCode).not.toMatch(/@import\s+['"]tailwindcss['"]/);
  });

  test('adopts the host theme: every colour role maps host Tailwind vars onto --dg-* with library fallbacks', () => {
    for (const key of Object.keys(DEFAULT_VARS)) {
      if (!key.startsWith('--dg-color-')) continue;
      // adoption declaration present at :root
      const re = new RegExp(`${key}:\\s*var\\(--color-`);
      expect(bridge, key).toMatch(re);
    }
  });

  test('publication: board tokens are exposed as Tailwind theme values via @theme inline', () => {
    expect(bridge).toMatch(/@theme inline \{/);
    for (const util of ['--color-board-bg', '--color-board-ink', '--color-board-accent', '--font-board-body', '--radius-board-md']) {
      expect(bridge, util).toContain(util);
    }
  });

  test('v3 preset mirrors the same token families (secondary target)', () => {
    for (const key of ['board-bg', 'board-ink', 'board-accent', 'board-display', 'board-md']) {
      expect(preset, key).toContain(key);
    }
  });
});
