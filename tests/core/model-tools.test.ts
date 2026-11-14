import { describe, expect, test } from 'vitest';
import { createRegistry, type Registry } from '../../packages/dreamer-genui/src/core';
import type { ModelConnector } from '../../packages/dreamer-genui/src/schema/connector';
import type { ModelManifest, ModelSummary } from '../../packages/dreamer-genui/src/schema/model';
import {
  getModelContext,
  getModelTools,
  loadModelManifest,
  resolveModelConnector,
} from '../../packages/dreamer-genui/src/core/generators/model-tools';
import {
  checkModelBudget,
  parseModelManifest,
  parseModelRef,
  toModelSummary,
} from '../../packages/dreamer-genui/src/core/model';

const manifest: ModelManifest = {
  id: 'heart-demo',
  version: '1.0.0',
  title: 'Demo organ model',
  tags: ['demo', 'anatomy'],
  conventions: { upAxis: 'y', frontAxis: '+z', unit: 'normalized' },
  assets: { model: 'heart.glb', sizeBytes: 900_000, triangles: 12_000 },
  parts: {
    body: { label: 'Body', nodes: ['body_node'], group: 'outer' },
    chamber: { label: 'Chamber', nodes: ['chamber_node'], anchor: [0, 0.5, 0] },
  },
  groups: { outer: { label: 'Outer layer', parts: ['body'] } },
  views: { front_named: { label: 'Front', position: [0, 0, 3], target: [0, 0, 0] } },
  animations: { beat: { label: 'Beat', clip: 'beat_clip', loop: true } },
  paths: { inflow: { label: 'Inflow', points: [[0, 1, 0], [0, 0, 0]] } },
  cutaways: { half: { label: 'Half', plane: { normal: [0, 0, 1], offset: 0 } } },
};

/** A host connector over in-memory manifests (static-registry shape). */
function staticConnector(overrides: Partial<ModelConnector> = {}): ModelConnector {
  return {
    id: 'static',
    getManifest: async modelId => (modelId === manifest.id ? structuredClone(manifest) : undefined),
    getAsset: async (_modelId, ref) => `https://assets.example/${String(ref)}`,
    search: async query => {
      if (query.text && !manifest.title.includes(query.text)) return [];
      return [toModelSummary(manifest)];
    },
    ...overrides,
  };
}

/** A platform connector speaking its OWN backend shape (needs `map`). */
function platformConnector(): ModelConnector {
  return {
    id: 'platform',
    getManifest: async modelId =>
      modelId === manifest.id
        ? {
            model_uuid: manifest.id,
            display_name: manifest.title,
            mesh: { file: 'heart.glb', bytes: 900_000, tris: 12_000 },
            segments: { body: { display: 'Body', node_names: ['body_node'] } },
          }
        : undefined,
    getAsset: async (_modelId, ref) => `https://platform.example/${String(ref)}`,
    map: (raw): ModelManifest | undefined => {
      if (typeof raw !== 'object' || raw === null || !('model_uuid' in raw)) return undefined;
      const r = raw as {
        model_uuid: string;
        display_name: string;
        mesh: { file: string; bytes: number; tris: number };
        segments: { body: { display: string } };
      };
      return {
        id: r.model_uuid,
        version: '1.0.0',
        title: r.display_name,
        conventions: { upAxis: 'y', frontAxis: '+z', unit: 'normalized' },
        assets: { model: r.mesh.file, sizeBytes: r.mesh.bytes, triangles: r.mesh.tris },
        parts: { body: { label: r.segments.body.display, nodes: ['body_node'] } },
      };
    },
  };
}

const withConnector = (connector: ModelConnector): Registry => {
  const registry = createRegistry();
  registry.register('modelConnectors', connector.id, connector);
  return registry;
};

/** A tool by name, with unknown input/output (the SDK is framework-agnostic). */
const tool = (registry: Registry, name: string): { execute(input: unknown): Promise<unknown> } => {
  const found = getModelTools(registry).find(t => t.name === name);
  if (!found) throw new Error(`missing tool: ${name}`);
  return found as unknown as { execute(input: unknown): Promise<unknown> };
};

const ctx = { signal: new AbortController().signal };

describe('model connector resolution (§6.16)', () => {
  test('bare ids resolve in priority order; a miss in one connector falls through', () => {
    const registry = createRegistry();
    registry.register('modelConnectors', 'first', staticConnector({ id: 'first', getManifest: async () => { throw new Error('not here'); } }));
    registry.register('modelConnectors', 'static', staticConnector());

    return expect(resolveModelConnector(registry, manifest.id, ctx)).resolves.toMatchObject({
      connector: { id: 'static' },
      displayId: 'static:heart-demo',
    });
  });

  test('explicit connectorId:modelId targets one connector', async () => {
    const registry = withConnector(staticConnector());
    const resolved = await resolveModelConnector(registry, `static:${manifest.id}`, ctx);
    expect(resolved.modelId).toBe(manifest.id);
    expect(resolved.manifest.parts['chamber']?.label).toBe('Chamber');
  });

  test('unknown connector yields connector-error; unknown model yields model-not-found', async () => {
    const registry = withConnector(staticConnector());
    await expect(resolveModelConnector(registry, 'ghost:model', ctx)).rejects.toMatchObject({ code: 'connector-error' });
    await expect(resolveModelConnector(registry, 'static:missing', ctx)).rejects.toMatchObject({ code: 'model-not-found' });
    await expect(resolveModelConnector(createRegistry(), 'heart-demo', ctx)).rejects.toMatchObject({ code: 'model-not-found' });
  });

  test('a malformed manifest is a connector-error, not masked by other connectors', async () => {
    const bad: ModelConnector = {
      id: 'bad',
      getManifest: async () => ({ id: 'x' }), // missing required fields
      getAsset: async () => '',
    };
    const registry = createRegistry();
    registry.register('modelConnectors', 'good', staticConnector({ id: 'good', getManifest: async () => { throw new Error('miss'); } }));
    registry.register('modelConnectors', 'bad', bad);

    await expect(resolveModelConnector(registry, manifest.id, ctx)).rejects.toMatchObject({ code: 'connector-error' });
    expect(parseModelManifest({ nope: true }).error?.code).toBe('connector-error');
  });

  test('the `map` adapter maps a platform shape to the standard manifest', async () => {
    const { manifest: mapped } = await loadModelManifest(withConnector(platformConnector()), manifest.id, {});
    expect(mapped.title).toBe(manifest.title);
    expect(mapped.parts['body']).toMatchObject({ label: 'Body', nodes: ['body_node'] });
    expect(mapped.assets.model).toBe('heart.glb');
  });

  test('budgets are enforced from the manifest', async () => {
    await expect(
      loadModelManifest(withConnector(staticConnector()), manifest.id, { budget: { maxSizeBytes: 500, maxTriangles: 100 } }),
    ).rejects.toMatchObject({ code: 'model-budget-exceeded' });
    expect(checkModelBudget({ ...manifest, assets: { ...manifest.assets, triangles: 999_999 } })?.code).toBe('model-budget-exceeded');
  });

  test('parseModelRef splits connector-qualified refs', () => {
    expect(parseModelRef('static:heart')).toEqual({ connectorId: 'static', modelId: 'heart' });
    expect(parseModelRef('heart')).toEqual({ modelId: 'heart' });
    expect(parseModelRef('a:b:c')).toEqual({ connectorId: 'a', modelId: 'b:c' });
  });
});

describe('tutor model tools (§6.16 "request and return")', () => {
  test('no connector registered: no tools are advertised', () => {
    expect(getModelTools(createRegistry())).toEqual([]);
  });

  test('find_models returns compact summaries with qualified ids', async () => {
    const registry = withConnector(staticConnector());
    registry.register('modelConnectors', 'platform', platformConnector());
    const findModels = tool(registry, 'find_models');
    const summaries = (await findModels.execute({ text: 'Demo' })) as ModelSummary[];
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ id: 'static:heart-demo', title: 'Demo organ model' });
    expect(summaries[0]?.parts.map(p => p.id)).toEqual(['body', 'chamber']);
    expect(summaries[0]?.views).toEqual(['front_named']);
    // No heavy asset data leaks into the summary.
    expect(JSON.stringify(summaries[0])).not.toContain('heart.glb');

    expect(await findModels.execute({ text: 'zzz' })).toEqual([]);
  });

  test('get_model returns one summary via loadModelManifest', async () => {
    const registry = withConnector(staticConnector());
    registry.register('modelConnectors', 'platform', platformConnector());
    const getModel = tool(registry, 'get_model');
    const summary = (await getModel.execute({ id: manifest.id })) as ModelSummary;
    expect(summary.id).toBe('static:heart-demo');
    expect(summary.animations).toEqual(['beat']);
    expect(summary.cutaways).toEqual(['half']);
    expect(summary.paths).toEqual(['inflow']);
  });

  test('getModelContext formats compact context and discourages invented ids', () => {
    const context = getModelContext([toModelSummary(manifest)]);
    expect(context).toContain('heart-demo');
    expect(context).toContain('body (Body, group: outer)');
    expect(context).toContain('chamber (Chamber)');
    expect(context).toContain('never invent');

    expect(getModelContext([])).toContain('Do not use model3d figures');
  });
});
