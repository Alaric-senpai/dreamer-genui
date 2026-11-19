/**
 * HTTP reference connector (§6.16). Opt-in: the only library code that makes
 * network requests, and only when the host instantiates it. Raw responses are
 * always mapped and validated through the standard manifest contract.
 */
import { defineModelConnector } from '../core/plugin';
import { createError } from '../core/errors';
import type { AssetRef, ModelQuery, ModelSummary } from '../schema/model';
import type { ConnectorContext, ModelConnector } from '../schema/connector';

export interface HttpEndpoints {
  manifest?: (modelId: string) => string;
  search?: (query: ModelQuery) => string;
  version?: (modelId: string) => string;
}

export interface HttpModelConnectorOptions {
  id?: string;
  baseUrl: string;
  endpoints?: HttpEndpoints;
  headers?: Record<string, string>;
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  /** Adapter from the platform's raw shape to the standard ModelManifest. */
  map?: (raw: unknown) => unknown;
  /** Override how an asset ref becomes a URL (signed URLs, object storage...). */
  assetUrl?: (modelId: string, ref: AssetRef, context: ConnectorContext) => string | Promise<string>;
  /** Only asset URLs on these origins are accepted (default: same origin). */
  allowedOrigins?: string[];
  /** Fetch assets here and return a Blob so signed-URL expiry can be retried. */
  fetchAssets?: boolean;
  fetch?: typeof fetch;
}

function join(base: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function checkOrigin(url: string, allowed?: string[]): void {
  if (!allowed || allowed.length === 0) return;
  let parsed: URL;
  try { parsed = new URL(url, 'http://localhost'); } catch {
    throw createError('connector-error', `Invalid asset URL: ${url}`);
  }
  if (!allowed.includes(parsed.origin)) {
    throw createError('connector-error', `Asset origin not allowed: ${parsed.origin}`);
  }
}

/**
 * Build an HTTP connector for a JSON model registry. All credentials stay in
 * `headers`/`getHeaders` on the host side; they never reach the tutor, events or
 * snapshots.
 */
export function createHttpModelConnector(options: HttpModelConnectorOptions): ModelConnector {
  const fetchImpl = options.fetch ?? (typeof fetch === 'function' ? fetch : undefined);
  const base = options.baseUrl.replace(/\/$/, '');
  const endpoints: Required<HttpEndpoints> = {
    manifest: options.endpoints?.manifest ?? ((id) => `${base}/models/${encodeURIComponent(id)}/manifest`),
    search: options.endpoints?.search ?? ((query) => {
      const params = new URLSearchParams();
      if (query.text) params.set('text', query.text);
      if (query.tags?.length) params.set('tags', query.tags.join(','));
      if (query.limit) params.set('limit', String(query.limit));
      const qs = params.toString();
      return `${base}/models/search${qs ? `?${qs}` : ''}`;
    }),
    version: options.endpoints?.version ?? ((id) => `${base}/models/${encodeURIComponent(id)}/version`),
  };

  const request = async (url: string, context: ConnectorContext): Promise<Response> => {
    if (!fetchImpl) throw createError('connector-error', 'No fetch implementation available');
    const headers = options.getHeaders ? await options.getHeaders() : options.headers;
    const response = await fetchImpl(url, { headers, signal: context.signal });
    if (!response.ok) {
      if (response.status === 404) {
        throw createError('model-not-found', `Model registry returned 404 for ${url}`);
      }
      throw createError('connector-error', `Model registry returned ${response.status} for ${url}`);
    }
    return response;
  };

  const assetUrl = (modelId: string, ref: AssetRef): string | Promise<string> => {
    if (options.assetUrl) return options.assetUrl(modelId, ref, {} as ConnectorContext);
    if (typeof ref === 'string') return join(base, ref);
    return join(base, `models/${encodeURIComponent(modelId)}/assets/${encodeURIComponent(ref.connectorAsset)}`);
  };

  return defineModelConnector({
    id: options.id ?? 'http',
    async getManifest(modelId, context) {
      const response = await request(endpoints.manifest(modelId), context);
      const raw: unknown = await response.json();
      return options.map ? options.map(raw) : raw;
    },
    async getAsset(modelId, ref, context) {
      let url = options.assetUrl
        ? await options.assetUrl(modelId, ref, context)
        : await assetUrl(modelId, ref);
      checkOrigin(url, options.allowedOrigins);
      if (!options.fetchAssets || !fetchImpl) return url;
      // Fetch here (not in the runtime) so an expired signed URL can be
      // refreshed and retried without leaking credentials to the renderer.
      for (let attempt = 0; attempt < 2; attempt++) {
        const headers = options.getHeaders ? await options.getHeaders() : options.headers;
        const response = await fetchImpl(url, { headers, signal: context.signal });
        if (response.ok) return await response.blob();
        if (attempt === 0 && (response.status === 401 || response.status === 403) && options.assetUrl) {
          // Signed URLs expire: ask the host for a fresh one and retry it.
          url = await options.assetUrl(modelId, ref, context);
          checkOrigin(url, options.allowedOrigins);
          continue;
        }
        throw createError('connector-error', `Asset request failed (${response.status}): ${url}`);
      }
      throw createError('connector-error', `Asset request failed after refresh: ${url}`);
    },
    async search(query, context) {
      if (!options.endpoints?.search) return [];
      const response = await request(endpoints.search(query), context);
      const raw: unknown = await response.json();
      const list = Array.isArray(raw) ? raw : (raw as { models?: unknown[] }).models ?? [];
      return list as ModelSummary[];
    },
    async getVersion(modelId, context) {
      const response = await request(endpoints.version(modelId), context);
      const raw: unknown = await response.json();
      return typeof raw === 'string' ? raw : String((raw as { version?: unknown }).version ?? '0');
    },
  });
}
