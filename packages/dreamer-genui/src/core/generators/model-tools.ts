import { z } from 'zod';
import type { ConnectorContext, ModelConnector } from '../../schema/connector';
import type { ModelManifest, ModelSummary } from '../../schema/model';
import type { Registry } from '../registry';
import {
  checkModelBudget,
  parseModelManifest,
  parseModelRef,
  toModelSummary,
  type ModelBudget,
} from '../model';
import { createError } from '../errors';
import type { LibraryError } from '../types';

/**
 * Tutor-facing model tools (§6.16 "request and return"). Framework-agnostic:
 * each tool exposes a Zod input schema and an executor, ready to hand to the
 * Vercel AI SDK or any other tool-calling setup. Only compact `ModelSummary`
 * data crosses this boundary — never heavy assets, credentials or raw backend
 * shapes.
 */

export interface ModelToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  execute(input: TInput): Promise<TOutput>;
}

export interface ModelToolOptions {
  /** Locale/user forwarded to connectors (never to the tutor). */
  locale?: string;
  user?: unknown;
  /** Budget enforced by `get_model`. */
  budget?: ModelBudget;
  /** Abort signal shared by all calls; a fresh controller is used otherwise. */
  signal?: AbortSignal;
}

export interface ResolvedModelConnector {
  connector: ModelConnector;
  modelId: string;
  /** Qualified id callers should use when several connectors are registered. */
  displayId: string;
  /** Raw backend response, already fetched. */
  raw: unknown;
  /** Mapped + validated standard manifest. */
  manifest: ModelManifest;
}

function contextFor(options: ModelToolOptions): ConnectorContext {
  return {
    signal: options.signal ?? new AbortController().signal,
    ...(options.locale !== undefined && { locale: options.locale }),
    ...(options.user !== undefined && { user: options.user }),
  };
}

function fail(error: LibraryError): never {
  const wrapped = new Error(error.detail ?? error.code) as Error & { code: string; libraryError: LibraryError };
  wrapped.code = error.code;
  wrapped.libraryError = error;
  throw wrapped;
}

function asLibraryError(error: unknown, fallbackCode: 'connector-error' | 'model-not-found'): LibraryError {
  if (typeof error === 'object' && error !== null && 'libraryError' in error) {
    return (error as { libraryError: LibraryError }).libraryError;
  }
  return createError(
    fallbackCode,
    error instanceof Error ? error.message : String(error),
  );
}

/**
 * Resolve a model reference against registered connectors, in priority order.
 * An explicit `connectorId:modelId` targets one connector; a bare id tries
 * each connector until one returns a manifest.
 */
export async function resolveModelConnector(
  registry: Registry,
  ref: string,
  context: ConnectorContext,
): Promise<ResolvedModelConnector> {
  const connectors = registry.listModelConnectors();
  if (connectors.length === 0) {
    return fail(createError('model-not-found', `No model connectors are registered (requested "${ref}")`));
  }
  const { connectorId, modelId } = parseModelRef(ref);

  const resolveWith = async (
    connector: ModelConnector,
    id: string,
    displayId: string,
  ): Promise<ResolvedModelConnector> => {
    const raw = await connector.getManifest(id, context);
    // A connector that does not know this model yields undefined: a miss,
    // not a malformed manifest (which must NOT be masked, §6.16).
    if (raw === undefined || raw === null) {
      return fail(createError('model-not-found', `Model not found: ${id}`));
    }
    const mapped = connector.map ? connector.map(raw) : raw;
    if (mapped === undefined || mapped === null) {
      return fail(createError('model-not-found', `Model not found: ${id}`));
    }
    const parsed = parseModelManifest(mapped);
    if (parsed.error) return fail(parsed.error);
    return { connector, modelId: id, displayId, raw, manifest: parsed.manifest };
  };

  if (connectorId) {
    const connector = connectors.find(candidate => candidate.id === connectorId);
    if (!connector) {
      return fail(createError('connector-error', `Unknown model connector: ${connectorId}`));
    }
    return resolveWith(connector, modelId, connectors.length > 1 ? `${connector.id}:${modelId}` : modelId);
  }

  for (const connector of connectors) {
    try {
      return await resolveWith(
        connector,
        modelId,
        connectors.length > 1 ? `${connector.id}:${modelId}` : modelId,
      );
    } catch (error) {
      // A connector that does not know this model is skipped; a malformed
      // manifest is a real error and must not be masked by another connector.
      const libraryError = asLibraryError(error, 'model-not-found');
      if (libraryError.code === 'connector-error' || libraryError.code === 'model-budget-exceeded') {
        return fail(libraryError);
      }
    }
  }
  return fail(createError('model-not-found', `Model not found: ${ref}`));
}

/** Resolve and validate a manifest (mapping + Zod + budget). */
export async function loadModelManifest(
  registry: Registry,
  ref: string,
  options: ModelToolOptions = {},
): Promise<{ manifest: ModelManifest; connector: ModelConnector; displayId: string }> {
  const context = contextFor(options);
  const resolved = await resolveModelConnector(registry, ref, context);
  const budgetError = checkModelBudget(resolved.manifest, options.budget);
  if (budgetError) return fail(budgetError);
  return { manifest: resolved.manifest, connector: resolved.connector, displayId: resolved.displayId };
}

const FIND_MODELS_INPUT = z.object({
  text: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

const GET_MODEL_INPUT = z.object({ id: z.string().min(1) });

/**
 * `find_models` and `get_model` bound to the registry's connectors. Returns
 * an empty array when no connector is registered (the prompt guide then hides
 * `model3d` entirely).
 */
export function getModelTools(
  registry: Registry,
  options: ModelToolOptions = {},
): Array<ModelToolDefinition<never, unknown>> {
  const connectors = registry.listModelConnectors();
  if (connectors.length === 0) return [];
  const context = contextFor(options);
  const qualify = (connector: ModelConnector, modelId: string): string =>
    connectors.length > 1 ? `${connector.id}:${modelId}` : modelId;
  const qualifySummary = (connector: ModelConnector, summary: ModelSummary): ModelSummary => ({
    ...summary,
    id: qualify(connector, summary.id),
  });

  const findModels: ModelToolDefinition<z.infer<typeof FIND_MODELS_INPUT>, ModelSummary[]> = {
    name: 'find_models',
    description:
      'Search the configured 3D model registry. Returns compact summaries with model ids, part ids/labels, views, animations, paths and cutaways. Use these ids in model3d figures; never invent ids.',
    inputSchema: FIND_MODELS_INPUT,
    async execute(input) {
      const limit = input.limit ?? 20;
      const seen = new Set<string>();
      const results: ModelSummary[] = [];
      for (const connector of connectors) {
        if (!connector.search) continue;
        let summaries: ModelSummary[];
        try {
          summaries = await connector.search(
            {
              ...(input.text !== undefined && { text: input.text }),
              ...(input.tags !== undefined && { tags: input.tags }),
              limit,
            },
            context,
          );
        } catch (error) {
          const libraryError = asLibraryError(error, 'connector-error');
          if (libraryError.code === 'connector-error') continue;
          throw error;
        }
        for (const summary of summaries) {
          const qualified = qualifySummary(connector, summary);
          if (seen.has(qualified.id)) continue;
          seen.add(qualified.id);
          results.push(qualified);
          if (results.length >= limit) return results;
        }
      }
      return results;
    },
  };

  const getModel: ModelToolDefinition<z.infer<typeof GET_MODEL_INPUT>, ModelSummary> = {
    name: 'get_model',
    description:
      'Fetch one 3D model summary by id (from find_models). Returns its parts, views, animations, paths and cutaways for directing a model3d figure.',
    inputSchema: GET_MODEL_INPUT,
    async execute(input) {
      const { manifest, connector, displayId } = await loadModelManifest(registry, input.id, options);
      const summary = toModelSummary(manifest);
      return { ...summary, id: displayId || qualify(connector, summary.id) };
    },
  };

  return [findModels, getModel] as Array<ModelToolDefinition<never, unknown>>;
}

/**
 * Format model summaries for injection into the tutor's context (host
 * retrieval alternative to `getModelTools`). Deliberately compact.
 */
export function getModelContext(summaries: ModelSummary[]): string {
  if (summaries.length === 0) {
    return 'No 3D models are available on this host. Do not use model3d figures.';
  }
  const lines: string[] = [
    'Available 3D models. Use ONLY these ids; never invent model, part, view, animation or path ids.',
  ];
  for (const summary of summaries) {
    const parts = summary.parts
      .map(part => (part.group ? `${part.id} (${part.label}, group: ${part.group})` : `${part.id} (${part.label})`))
      .join(', ');
    const bits = [`- ${summary.id}: "${summary.title}"`];
    if (summary.description) bits.push(`  description: ${summary.description}`);
    if (summary.tags?.length) bits.push(`  tags: ${summary.tags.join(', ')}`);
    if (parts) bits.push(`  parts: ${parts}`);
    if (summary.views?.length) bits.push(`  views: ${summary.views.join(', ')}`);
    if (summary.animations?.length) bits.push(`  animations: ${summary.animations.join(', ')}`);
    if (summary.paths?.length) bits.push(`  paths: ${summary.paths.join(', ')}`);
    if (summary.cutaways?.length) bits.push(`  cutaways: ${summary.cutaways.join(', ')}`);
    lines.push(bits.join('\n'));
  }
  lines.push(
    'Direct the model with view/highlight/isolate/labels directives and cue-driven tour steps; describe structure with the model, not prose.',
  );
  return lines.join('\n');
}
