// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { registryToJsonSchema } from '../../packages/dreamer-genui/src/core/generators/json-schema';
import { createRegistry } from '../../packages/dreamer-genui/src/core/registry';

describe('registryToJsonSchema (§8.1)', () => {
  const schema = registryToJsonSchema(createRegistry()) as { definitions?: Record<string, unknown> };
  const text = JSON.stringify(schema);

  test('registered mood/ambience/surface names appear as enums', () => {
    for (const name of ['calm', 'solemn', 'playful', 'eerie', 'fog', 'flicker', 'chalkboard', 'paper']) {
      expect(text).toContain(`"${name}"`);
    }
  });

  test('theme and camera ops appear in the op union', () => {
    expect(text).toContain('"theme"');
    expect(text).toContain('"camera"');
  });

  test('schema rejects a mood that is not registered', () => {
    // find the mood enum in the raw schema and check forbidden-frolic is absent
    expect(text).not.toContain('forbidden-frolic');
  });

  test('custom registry entries change the enum', () => {
    const reg = createRegistry({ replace: true, moodPresets: [{ name: 'aurora', description: 'd', tokens: {} }] });
    const custom = JSON.stringify(registryToJsonSchema(reg));
    expect(custom).toContain('"aurora"');
    expect(custom).not.toContain('"solemn"');
  });
});
