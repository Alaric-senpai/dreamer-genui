import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_VARS } from '../../packages/dreamer-genui/src/theme/tokens';

const bridge = readFileSync(join(__dirname, '../../packages/dreamer-genui/styles/tailwind.css'), 'utf8');
const preset = readFileSync(join(__dirname, '../../packages/dreamer-genui/styles/tailwind-preset.cjs'), 'utf8');
/** The bridge header legitimately *mentions* `@import 'tailwindcss'` while documenting usage. */
const bridgeCode = bridge.replace(/\/\*[\s\S]*?\*\//g, '');
const colorRoles = Object.keys(DEFAULT_VARS).filter((key) => key.startsWith('--dg-color-'));

describe('tailwind bridge (§7.6)', () => {
  test('does not import Tailwind itself (hosts import the bridge AFTER their own tailwindcss import)', () => {
    expect(bridgeCode).not.toMatch(/@import\s+['"]tailwindcss['"]/);
  });

  test('adopts the host theme: every colour role maps host Tailwind vars onto --dg-* WITH library fallbacks', () => {
    for (const key of colorRoles) {
      // adoption declaration present at :root, reading a host var ...
      expect(bridge, key).toMatch(new RegExp(`${key}:\\s*var\\(--color-[a-z0-9-]+`));
      // ... and carrying fallbacks (a nested host var or a literal colour) so a
      // host with no global theme still gets a usable board.
      expect(bridge, key).toMatch(new RegExp(`${key}:\\s*var\\(--color-[a-z0-9-]+,\\s*(var\\(--color-|#)`));
    }
  });

  test('adopts host fonts and radii with library fallbacks', () => {
    for (const key of ['--dg-font-display', '--dg-font-body', '--dg-font-mono']) {
      expect(bridge, key).toMatch(new RegExp(`${key}:\\s*var\\(--font-[a-z0-9-]+,\\s*[^)]`));
    }
    for (const key of ['--dg-radius-sm', '--dg-radius-md', '--dg-radius-lg']) {
      expect(bridge, key).toMatch(new RegExp(`${key}:\\s*var\\(--radius-[a-z0-9-]+,\\s*[0-9]`));
    }
  });

  test('publication: every board colour role is exposed as a Tailwind theme value via @theme inline', () => {
    expect(bridge).toMatch(/@theme inline \{/);
    for (const role of colorRoles.map((key) => key.replace('--dg-color-', ''))) {
      expect(bridge, role).toContain(`--color-board-${role}`);
    }
    for (const util of ['--font-board-display', '--font-board-body', '--font-board-mono', '--radius-board-sm', '--radius-board-md', '--radius-board-lg']) {
      expect(bridge, util).toContain(util);
    }
  });

  test('v3 preset mirrors the same token families (secondary target)', () => {
    for (const key of ['board-bg', 'board-ink', 'board-accent', 'board-display', 'board-md']) {
      expect(preset, key).toContain(key);
    }
  });
});
