/**
 * Asset resolver (§7.6). Hosts supply `resolveAsset(id) => url`; the library
 * caches results in memory and deduplicates concurrent requests. It never
 * fetches by itself: the callback owns all network access.
 */

export type AssetUrl = string | Promise<string>;
export type AssetResolveFunction = (assetId: string) => AssetUrl | undefined;

export interface AssetResolverOptions {
  /** Maximum cached ids (oldest evicted first). Defaults to 200. */
  maxEntries?: number;
}

export interface AssetResolver {
  /** Resolve an asset id; undefined when the host does not know it. */
  resolve(assetId: string): Promise<string | undefined>;
  /** Synchronous cache peek, for render paths that cannot await. */
  peek(assetId: string): string | undefined;
  /** True when the id is already cached. */
  has(assetId: string): boolean;
  /** Drop one id or the whole cache. */
  clear(assetId?: string): void;
  size(): number;
}

const DEFAULT_MAX_ENTRIES = 200;

export function createAssetResolver(
  resolve: AssetResolveFunction,
  options: AssetResolverOptions = {},
): AssetResolver {
  const max = Math.max(1, Math.floor(options.maxEntries ?? DEFAULT_MAX_ENTRIES));
  const cache = new Map<string, string>();
  const inFlight = new Map<string, Promise<string | undefined>>();

  function remember(assetId: string, url: string): void {
    cache.delete(assetId);
    cache.set(assetId, url);
    while (cache.size > max) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }

  return {
    async resolve(assetId) {
      const cached = cache.get(assetId);
      if (cached !== undefined) return cached;

      const pending = inFlight.get(assetId);
      if (pending) return pending;

      const request = (async () => {
        try {
          const result = await resolve(assetId);
          if (typeof result === 'string' && result.length > 0) {
            remember(assetId, result);
            return result;
          }
          return undefined;
        } catch {
          // Asset failures are non-fatal (§7.4): callers render their fallback.
          return undefined;
        } finally {
          inFlight.delete(assetId);
        }
      })();

      inFlight.set(assetId, request);
      return request;
    },

    peek: assetId => cache.get(assetId),
    has: assetId => cache.has(assetId),
    clear(assetId) {
      if (assetId === undefined) cache.clear();
      else cache.delete(assetId);
    },
    size: () => cache.size,
  };
}
