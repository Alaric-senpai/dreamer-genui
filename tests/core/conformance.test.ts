import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { createRegistry } from '../../packages/dreamer-genui/src/core/registry';
import { getSystemPromptGuide } from '../../packages/dreamer-genui/src/core/generators/prompt-guide';
import { runPluginConformance } from '../../packages/dreamer-genui/src/testing';
import { defineBlock, definePlugin } from '../../packages/dreamer-genui/src/core/plugin';

const schema = z.object({ type: z.literal('acme:status'), text: z.string() });

describe('content built-ins as plugins', () => {
  test('math, table and code register through their own default plugins', () => {
    const registry = createRegistry();
    for (const [block, plugin] of [
      ['math', 'math'],
      ['table', 'table'],
      ['code', 'code'],
    ] as const) {
      const entry = registry.list('blocks').find((candidate) => candidate.name === block);
      expect(entry?.plugin).toBe(plugin);
      expect(entry?.disabled).toBe(false);
    }
  });

  test('disabling a built-in removes it from the prompt guide', () => {
    const registry = createRegistry();
    expect(getSystemPromptGuide(registry)).toContain('math block');
    registry.disable('math');
    const entry = registry.list('blocks').find((candidate) => candidate.name === 'math');
    expect(entry?.disabled).toBe(true);
    expect(getSystemPromptGuide(registry)).not.toContain('math block');
  });
});

describe('runPluginConformance', () => {
  const valid = definePlugin({
    name: 'acme:status-pack',
    version: '1.2.3',
    provides: {
      blocks: {
        'acme:status': defineBlock({ schema, promptGuide: 'status block: text.' }),
      },
    },
  });

  test('a well-formed plugin passes', () => {
    expect(runPluginConformance(valid)).toEqual({ ok: true, issues: [] });
  });

  test('third-party names must be namespaced', () => {
    const report = runPluginConformance({ ...valid, name: 'status-pack' });
    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.code === 'plugin-name')).toBe(true);
  });

  test('incompatible engine ranges are reported', () => {
    const report = runPluginConformance({ ...valid, engine: '^2.0.0' });
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: 'plugin-incompatible' }),
    );
  });

  test('a plugin that provides nothing is rejected', () => {
    const report = runPluginConformance({ ...valid, provides: {} });
    expect(report.issues).toContainEqual(expect.objectContaining({ code: 'plugin-empty' }));
  });

  test('blocks need a prompt guide', () => {
    const plugin = definePlugin({
      name: 'acme:quiet-pack',
      version: '1.0.0',
      provides: { blocks: { 'acme:status': defineBlock({ schema }) } },
    });
    const report = runPluginConformance(plugin);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: 'missing-prompt-guide' }),
    );
  });
});

describe('plugin enable/disable config', () => {
  test('assessment is registered but disabled by default', () => {
    const registry = createRegistry();
    const entry = registry.list('blocks').find((candidate) => candidate.name === 'assessment');
    expect(entry?.plugin).toBe('assessment');
    expect(entry?.disabled).toBe(true);
    expect(getSystemPromptGuide(registry)).not.toContain('assessment block');
  });

  test('createRegistry({ plugins }) enables an opt-in built-in', () => {
    const registry = createRegistry({ plugins: { assessment: true } });
    const entry = registry.list('blocks').find((candidate) => candidate.name === 'assessment');
    expect(entry?.disabled).toBe(false);
    // The default `lesson` profile deliberately excludes the assessment shell.
    expect(getSystemPromptGuide(registry, { profile: 'assessment' })).toContain('assessment');
  });

  test('createRegistry({ plugins }) disables a default built-in', () => {
    const registry = createRegistry({ plugins: { math: false, code: false } });
    for (const block of ['math', 'code']) {
      expect(registry.list('blocks').find((candidate) => candidate.name === block)?.disabled).toBe(true);
    }
    expect(getSystemPromptGuide(registry)).not.toContain('math block');
  });
});
