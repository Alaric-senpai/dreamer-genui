import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the M5 figure-chunk contract: figures are a separate lazy tsup entry,
 * the React entry never imports them eagerly, and no GSAP dependency is taken
 * on (draw-on is CSS stroke-dash + motion instead — see DECISIONS.md).
 */
const pkgRoot = join(process.cwd(), 'packages/dreamer-genui');
const read = (rel: string) => readFileSync(join(pkgRoot, rel), 'utf8');
const exists = (rel: string) => existsSync(join(pkgRoot, rel));

describe('figure lazy chunk packaging (M5)', () => {
  it('declares figures/index as its own tsup entry', () => {
    expect(read('tsup.config.ts')).toContain("'figures/index': './src/figures/index.tsx'");
  });

  it('marks the figure subpath external so splitting:false cannot inline it', () => {
    const config = read('tsup.config.ts');
    expect(config).toMatch(/external:\s*\[[^\]]*'dreamer-genui\/figures'/);
  });

  it('publishes the ./figures export subpath', () => {
    const pkg = JSON.parse(read('package.json')) as { exports: Record<string, string> };
    expect(pkg.exports['./figures']).toBe('./dist/figures/index.js');
    expect(pkg.exports['./figures/*']).toBe('./dist/figures/*.js');
  });

  it('loads the figure renderer via a dynamic import in the React entry', () => {
    const wrapper = read('src/react/components/figure.tsx');
    expect(wrapper).toMatch(/lazy\(\(\)\s*=>\s*import\('dreamer-genui\/figures'\)\)/);
    expect(wrapper).not.toMatch(/import\s+\{\s*FigureRenderer\s*\}\s+from\s+'dreamer-genui\/figures'/);
  });

  it('keeps the figure chunk free of React-context runtime imports', () => {
    const source = read('src/figures/index.tsx');
    const valueImports = [...source.matchAll(/^import\s+(?!type)(.*?)from\s+'([^']+)'/gm)].map((m) => m[2] ?? '');
    // The chunk may import React itself and local layout helpers only.
    expect(valueImports.filter((spec) => spec.startsWith('../react'))).toEqual([]);
    expect(valueImports.filter((spec) => spec.startsWith('../core') && !spec.includes('assets'))).toEqual([]);
  });

  it('does not depend on GSAP', () => {
    const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    expect(pkg.dependencies?.gsap).toBeUndefined();
    expect(pkg.devDependencies?.gsap).toBeUndefined();
  });

  it.skipIf(!exists('dist/figures/index.js'))('built figure chunk imports no internal runtime modules', () => {
    const chunk = read('dist/figures/index.js');
    expect(chunk).not.toMatch(/require\(['"]\.\.?\/core/);
    expect(chunk).not.toMatch(/from ['"]\.\.?\/react/);
  });

  it('ships annotation and figure styles in base.css', () => {
    const css = read('styles/base.css');
    expect(css).toContain('.dg-annotation path');
    expect(css).toContain('dg-annotation-draw');
    expect(css).toContain('.dg-figure');
    expect(css).toContain('dg-figure-flow');
  });
});
