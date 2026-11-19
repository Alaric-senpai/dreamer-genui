/**
 * Opt-in reference model connectors (§6.16). These are the only library
 * modules that may perform network requests, and only when a host creates
 * them explicitly. The core renderer never imports this barrel.
 */
export { createStaticModelConnector, defineModelPack } from './static';
export type { StaticAssetResolver, StaticModelConnectorOptions } from './static';
export { createHttpModelConnector } from './http';
export type { HttpEndpoints, HttpModelConnectorOptions } from './http';
export { withModelCache, isCachedBytes, manifestVersion, offlineError } from './cache';
export type { ModelCacheOptions } from './cache';
export { withPrefetch } from './prefetch';
export type { PrefetchOptions } from './prefetch';
