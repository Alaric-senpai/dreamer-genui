import type { AssetRef, ModelQuery, ModelSummary } from './model';

/**
 * The Model Connector contract (§6.16). Host-supplied: the host chooses how
 * models are retrieved (REST, GraphQL, CDN, IndexedDB, bundled files...), but
 * every connector yields the standard `ModelManifest` mapping.
 *
 * M4b ships the contract and the registry hooks; reference connectors and the
 * 3D runtime arrive in M5b. This module is a type-only surface — it performs
 * no network access.
 */

export interface ConnectorContext {
  signal: AbortSignal;
  locale?: string;
  user?: unknown;
}

export interface ModelConnector {
  id: string;
  /** Raw backend shape or an already-standard manifest; validated after `map`. */
  getManifest(modelId: string, ctx: ConnectorContext): Promise<unknown>;
  /** URL preferred; ArrayBuffer/Blob accepted for bundled or cached models. */
  getAsset(
    modelId: string,
    ref: AssetRef,
    ctx: ConnectorContext,
  ): Promise<string | ArrayBuffer | Blob>;
  /** Discovery for tutor tools and host retrieval. */
  search?(query: ModelQuery, ctx: ConnectorContext): Promise<ModelSummary[]>;
  /** Cache validation. */
  getVersion?(modelId: string, ctx: ConnectorContext): Promise<string>;
  prefetch?(modelIds: string[], ctx: ConnectorContext): Promise<void>;
  /** Adapter from the host's own shape to the standard `ModelManifest`. */
  map?(raw: unknown): unknown;
}
