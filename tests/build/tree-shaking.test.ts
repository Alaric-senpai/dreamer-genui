import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the M4d packaging contract: every host-kit component is a separate
 * entry point, the board core never imports the host kit, and the two
 * stylesheets stay independent.
 */
const pkgRoot = join(process.cwd(), 'packages/dreamer-genui');
const read = (rel: string) => readFileSync(join(pkgRoot, rel), 'utf8');

function importsOf(source: string): string[] {
  return [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1] ?? '');
}

const uiFiles = readdirSync(join(pkgRoot, 'src/ui'))
  .filter((file) => file.endsWith('.tsx'))
  .map((file) => file.replace(/\.tsx$/, ''))
  .sort();

describe('host UI kit packaging', () => {
  it('lists every component as its own tsup entry', () => {
    const config = read('tsup.config.ts');
    const block = config.match(/const uiComponents = \[([\s\S]*?)\] as const/);
    expect(block).not.toBeNull();
    const names = [...(block?.[1] ?? '').matchAll(/'([^']+)'/g)].map((match) => match[1] ?? '');
    expect(names.sort()).toEqual(uiFiles);
  });

  it.each(['button', 'card', 'badge', 'input', 'kbd', 'separator', 'skeleton', 'spinner'])(
    '%s imports no other host-kit component',
    (name) => {
      const relatives = importsOf(read(`src/ui/${name}.tsx`)).filter((spec) => spec.startsWith('.'));
      expect(relatives.every((spec) => spec === './lib')).toBe(true);
    }
  );

  it('keeps composition explicit and acyclic in one direction', () => {
    const expected: Record<string, string[]> = {
      combobox: ['./button', './command', './lib', './popover'],
      command: ['./dialog', './lib'],
      'date-picker': ['./button', './calendar', './lib', './popover'],
      field: ['./label', './lib'],
    };
    for (const [name, specs] of Object.entries(expected)) {
      const relatives = importsOf(read(`src/ui/${name}.tsx`))
        .filter((spec) => spec.startsWith('.'))
        .sort();
      expect(relatives).toEqual([...specs].sort());
    }
  });

  it('never imports the host kit from core, schema or the board renderer', () => {
    const entries = [
      'src/index.ts',
      'src/core/index.ts',
      'src/schema/index.ts',
      'src/react/index.ts',
      'src/react/components/block-renderer.tsx',
      'src/headless/index.ts',
    ];
    for (const entry of entries) {
      expect(importsOf(read(entry)).some((spec) => spec.includes('/ui/') || spec.includes('ui/'))).toBe(
        false
      );
    }
  });

  it('publishes ui subpaths and keeps the stylesheets separate', () => {
    const manifest = JSON.parse(read('package.json')) as {
      exports: Record<string, string>;
      files: string[];
    };
    expect(manifest.exports['./ui']).toBe('./dist/ui/index.js');
    expect(manifest.exports['./ui/*']).toBe('./dist/ui/*.js');
    expect(manifest.exports['./ui.css']).toBe('./styles/ui.css');
    expect(manifest.files).toContain('styles');

    const base = read('styles/base.css');
    const ui = read('styles/ui.css');
    expect(base).not.toContain('dg-ui-');
    expect(ui).toContain('@layer dreamer-genui');
    expect(ui).toContain('--dg-ui-accent');
  });
});
