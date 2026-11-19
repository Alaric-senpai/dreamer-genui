/**
 * Prefetch decorator for model connectors. Opt-in: it eagerly resolves
 * manifests (and, when available, calls the connector's own `prefetch`) so a
 * tour's models are warm before their cue fires.
 */
import type { ConnectorContext, ModelConnector } from '../schema/connector';

export interface PrefetchOptions {
  /** Also fetch raw manifests when the connector has no `prefetch` hook (default true). */
  warmManifests?: boolean;
}

export function withPrefetch(connector: ModelConnector, options: PrefetchOptions = {}): ModelConnector {
  const warm = options.warmManifests !== false;
  return {
    ...connector,
    id: connector.id,
    async prefetch(ids: string[], context: ConnectorContext): Promise<void> {
      await Promise.all(
        ids.map(async (id) => {
          if (connector.prefetch) return connector.prefetch([id], context);
          if (warm) await connector.getManifest(id, context).catch(() => undefined);
        }),
      );
    },
  };
}
