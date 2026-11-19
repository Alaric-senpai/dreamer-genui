/**
 * Static reference connector (§6.16). Opt-in: nothing imports this from core.
 * The host supplies vetted manifests and an asset resolver; no network access.
 */
import { defineModelConnector } from '../core/plugin';
import { toModelSummary } from '../core/model';
import type { AssetRef, ModelManifest, ModelQuery, ModelSummary } from '../schema/model';
import type { ConnectorContext, ModelConnector } from '../schema/connector';
import { createError } from '../core/errors';

export type StaticAssetResolver = (
  modelId: string,
  ref: AssetRef,
  context: ConnectorContext,
) => string | ArrayBuffer | Blob | undefined | Promise<string | ArrayBuffer | Blob | undefined>;

export interface StaticModelConnectorOptions {
  /** Connector id used for `connectorId:modelId` refs. */
  id?: string;
  /** Adapter from a host-specific raw shape to the standard manifest. */
  map?: (raw: unknown) => unknown;
}

function manifestId(manifest: unknown): string | undefined {
  if (typeof manifest !== 'object' || manifest === null) return undefined;
  const id = (manifest as { id?: unknown }).id;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

/**
 * Build a connector over a fixed set of manifests. `manifests` may be an array
 * or a record keyed by model id; values are validated on demand through the
 * shared manifest parser used by every connector.
 */
export function createStaticModelConnector(
  manifests: readonly unknown[] | Record<string, unknown>,
  resolveAsset: StaticAssetResolver,
  options: StaticModelConnectorOptions = {},
): ModelConnector {
  const entries = Array.isArray(manifests)
    ? manifests.map((value) => [manifestId(value), value] as const)
    : Object.entries(manifests);
  const byId = new Map<string, unknown>();
  for (const [id, value] of entries) {
    if (id) byId.set(id, value);
  }

  return defineModelConnector({
    id: options.id ?? 'static',
    async getManifest(modelId: string) {
      const raw = byId.get(modelId);
      if (raw === undefined) return undefined; // a miss, not a malformed manifest
      return options.map ? options.map(raw) : raw;
    },
    async getAsset(modelId, ref, context) {
      const asset = await resolveAsset(modelId, ref, context);
      if (asset === undefined) {
        throw createError('connector-error', `Static connector has no asset for ${modelId}: ${JSON.stringify(ref)}`);
      }
      return asset;
    },
    async search(query: ModelQuery): Promise<ModelSummary[]> {
      const summaries: ModelSummary[] = [];
      for (const [id, raw] of byId) {
        const mapped = options.map ? options.map(raw) : raw;
        if (typeof mapped !== 'object' || mapped === null || !('parts' in mapped)) continue;
        // parseModelManifest is applied by get_model; search needs only compact
        // metadata, so infer from the raw shape defensively.
        const value = mapped as Partial<ModelManifest>;
        if (!value.title || !value.parts || typeof value.parts !== 'object') continue;
        if (query.tags?.length && !query.tags.some((tag) => value.tags?.includes(tag))) continue;
        if (query.text) {
          const haystack = `${id} ${value.title} ${value.description ?? ''} ${value.tags?.join(' ') ?? ''}`.toLowerCase();
          if (!haystack.includes(query.text.toLowerCase())) continue;
        }
        summaries.push(toModelSummary(value as ModelManifest));
      }
      return summaries.slice(0, query.limit ?? 20);
    },
    async getVersion(modelId: string) {
      const raw = byId.get(modelId);
      if (typeof raw === 'object' && raw !== null && 'version' in raw) {
        return String((raw as { version?: unknown }).version ?? '0');
      }
      return '0';
    },
  });
}

/** Sugar: a static connector over bundled, vetted model packs (§6.16). */
export function defineModelPack(
  manifests: readonly unknown[] | Record<string, unknown>,
  resolveAsset: StaticAssetResolver,
  options: StaticModelConnectorOptions = {},
): ModelConnector {
  return createStaticModelConnector(manifests, resolveAsset, options);
}
