/**
 * Cache decorator for model connectors (§6.16). Opt-in. Uses the Cache API
 * when available and an in-memory fallback otherwise (SSR, jsdom). Validates
 * versions, enforces a byte cap and serves cached data when the network fails.
 */
import { createError } from '../core/errors';
import type { AssetRef, ModelManifest } from '../schema/model';
import type { ConnectorContext, ModelConnector } from '../schema/connector';

export interface ModelCacheOptions {
  /** Maximum total cached asset bytes (default 12 MB). */
  maxBytes?: number;
  /** Ask the connector for a version and invalidate on change (default true). */
  validateVersion?: boolean;
  /** Cache name for the Cache API. */
  name?: string;
}

interface CachedAsset { bytes: ArrayBuffer; storedAt: number }

export function withModelCache(
  connector: ModelConnector,
  options: ModelCacheOptions = {},
): ModelConnector {
  const maxBytes = options.maxBytes ?? 12_000_000;
  const validateVersion = options.validateVersion !== false;
  const manifests = new Map<string, { manifest: unknown; version?: string; at: number }>();
  const assets = new Map<string, CachedAsset>();
  let used = 0;
  let cachePromise: Promise<Cache | undefined> | undefined;

  const openCache = (): Promise<Cache | undefined> => {
    if (typeof caches === 'undefined') return Promise.resolve(undefined);
    cachePromise ??= caches.open(options.name ?? `dreamer-genui-models-${connector.id}`).catch(() => undefined);
    return cachePromise;
  };

  const cacheKey = (modelId: string, ref: AssetRef): string =>
    `dg:${connector.id}:${modelId}:${typeof ref === 'string' ? ref : ref.connectorAsset}`;

  const storeAsset = async (key: string, value: string | ArrayBuffer | Blob): Promise<void> => {
    if (typeof value === 'string') return; // URLs are cheap; the runtime caches them
    let bytes: ArrayBuffer;
    if (value instanceof ArrayBuffer) bytes = value;
    else if (typeof Blob !== 'undefined' && value instanceof Blob) bytes = await value.arrayBuffer();
    else return;
    if (bytes.byteLength > maxBytes) return;
    if (used + bytes.byteLength > maxBytes) {
      const oldest = [...assets.entries()].sort((a, b) => a[1].storedAt - b[1].storedAt)[0];
      if (oldest) { used -= oldest[1].bytes.byteLength; assets.delete(oldest[0]); }
    }
    assets.set(key, { bytes, storedAt: Date.now() });
    used += bytes.byteLength;
    const cache = await openCache();
    if (cache) {
      try { await cache.put(key, new Response(bytes)); } catch { /* Cache API quota: ignore */ }
    }
  };

  return {
    ...connector,
    id: connector.id,
    async getManifest(modelId, context) {
      const cached = manifests.get(modelId);
      if (validateVersion && connector.getVersion) {
        try {
          const current = await connector.getVersion(modelId, context);
          if (cached && cached.version === current) return cached.manifest;
        } catch {
          if (cached) return cached.manifest; // offline: serve last known good
        }
      } else if (cached) {
        return cached.manifest;
      }
      try {
        const raw = await connector.getManifest(modelId, context);
        if (raw !== undefined && raw !== null) {
          const version = connector.getVersion
            ? await connector.getVersion(modelId, context).catch(() => undefined)
            : undefined;
          manifests.set(modelId, { manifest: raw, version, at: Date.now() });
        }
        return raw;
      } catch (error) {
        if (cached) return cached.manifest;
        throw error;
      }
    },
    async getAsset(modelId, ref, context) {
      const key = cacheKey(modelId, ref);
      const local = assets.get(key);
      if (local) return local.bytes.slice(0);
      if (typeof caches !== 'undefined') {
        const cache = await openCache();
        if (cache) {
          try {
            const hit = await cache.match(key);
            if (hit) {
              const bytes = await hit.arrayBuffer();
              assets.set(key, { bytes, storedAt: Date.now() });
              used += bytes.byteLength;
              return bytes;
            }
          } catch { /* fall through to network */ }
        }
      }
      const value = await connector.getAsset(modelId, ref, context);
      await storeAsset(key, value);
      return value;
    },
    async search(query, context) {
      if (connector.search) return connector.search(query, context);
      return [];
    },
    async prefetch(ids, context) {
      if (connector.prefetch) return connector.prefetch(ids, context);
      await Promise.all(ids.map((id) => connector.getManifest(id, context).catch(() => undefined)));
    },
  };
}

/** Type guard used by the runtime to recognise cached ArrayBuffers. */
export function isCachedBytes(value: unknown): value is ArrayBuffer {
  return value instanceof ArrayBuffer;
}

/** Manifest helper kept here so the cache entry has one validation path. */
export function manifestVersion(manifest: ModelManifest): string {
  return manifest.version;
}

/** A connector that fails with a clear error when offline and uncached. */
export function offlineError(modelId: string) {
  return createError('connector-error', `Model ${modelId} is not cached and the network is unavailable`);
}
