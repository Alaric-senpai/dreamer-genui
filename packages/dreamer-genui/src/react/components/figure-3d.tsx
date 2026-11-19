/**
 * Lazy 3D figure wrapper (M5b).
 *
 * `model3d` / `scene3d` never enter the initial bundle: the renderer lives in
 * `dreamer-genui/3d` and is imported only once a figure is ready to draw. This
 * wrapper owns the Model Connector resolution flow (§6.16): pick a connector,
 * map + validate the manifest, enforce budgets, validate directives, resolve
 * the poster and the model asset, then hand everything to the chunk.
 */
import { lazy, Suspense, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { Node } from '../../core/types';
import type { LibraryError } from '../../core/types';
import type { Model3DFigure, ModelManifest, Scene3DFigure } from '../../schema/model';
import type { ModelConnector } from '../../schema/connector';
import type { UIEvent } from '../../schema/events';
import { checkModelBudget, normalizeModelReference, parseModelManifest, parseModelRef, validateModelDirectives } from '../../core/model';
import { createError } from '../../core/errors';
import { BoardErrorContext } from '../emit-context';
import { BoardStoreContext } from '../store-context';
import { useDreamer, useEmitEvent } from '../provider';
import { renderInline } from './inline';

const Lazy3D = lazy(() => import('dreamer-genui/3d'));

const EMPTY_CUES: readonly string[] = [];

function noopSubscribe(): () => void {
  return () => {};
}

type ThreeDFigure = Model3DFigure | Scene3DFigure;

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; connector?: ModelConnector; manifest?: ModelManifest; modelAsset?: string | ArrayBuffer | Blob }
  | { status: 'error'; error: LibraryError; manifest?: ModelManifest };

interface CachedManifest {
  connector: ModelConnector;
  manifest: ModelManifest;
}

/**
 * Manifest cache shared by every figure on the page. Assets are deliberately
 * not cached here: the reference connectors own asset caching/offline.
 */
const manifestCache = new Map<string, CachedManifest>();

function cacheKey(connectorId: string, modelId: string): string {
  return `${connectorId}\u0000${modelId}`;
}

/** Accept errors thrown either as `LibraryError` values or as `Error`s. */
function asLibraryError(error: unknown, fallback: 'connector-error' | 'model-load-failed'): LibraryError {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const candidate = error as Partial<LibraryError>;
    if (typeof candidate.code === 'string') return candidate as LibraryError;
  }
  return createError(fallback, error instanceof Error ? error.message : String(error));
}

async function resolveManifest(
  connectors: readonly ModelConnector[],
  ref: string,
  ctx: { signal: AbortSignal; locale?: string },
): Promise<{ connector: ModelConnector; manifest: ModelManifest } | LibraryError> {
  const { connectorId, modelId } = parseModelRef(ref);
  if (connectorId !== undefined) {
    const connector = connectors.find((candidate) => candidate.id === connectorId);
    if (!connector) {
      return createError('connector-error', `No model connector registered with id "${connectorId}"`);
    }
  }
  const candidates = connectorId === undefined
    ? connectors
    : connectors.filter((candidate) => candidate.id === connectorId);
  if (candidates.length === 0) {
    return createError('model-not-found', `No model connector is registered for "${ref}"`);
  }

  let lastError: LibraryError | undefined;
  for (const connector of candidates) {
    const key = cacheKey(connector.id, modelId);
    const cached = manifestCache.get(key);
    if (cached) return cached;
    try {
      const raw = await connector.getManifest(modelId, ctx);
      // A miss (undefined) is not a malformed manifest: a lower-priority
      // connector may still serve the bare id.
      if (raw === undefined || raw === null) {
        lastError = createError('model-not-found', `Model not found: "${ref}"`);
        continue;
      }
      const mapped = connector.map ? connector.map(raw) : raw;
      const parsed = parseModelManifest(mapped);
      if (parsed.error) {
        lastError = parsed.error;
        if (connectorId !== undefined) return parsed.error;
        continue;
      }
      const entry: CachedManifest = { connector, manifest: parsed.manifest };
      manifestCache.set(key, entry);
      return entry;
    } catch (error) {
      lastError = asLibraryError(error, 'connector-error');
      // An explicit `connectorId:modelId` must not silently fall through to an
      // unrelated connector.
      if (connectorId !== undefined) return lastError;
    }
  }
  return lastError ?? createError('model-not-found', `Model not found: "${ref}"`);
}

function partsOf(figure: ThreeDFigure, manifest: ModelManifest | undefined): Array<{ id: string; label: string }> {
  if (figure.kind === 'scene3d') {
    return figure.objects.slice(0, 64).map((object) => ({
      id: object.id,
      label: object.label ? object.label.map((part) => (typeof part === 'string' ? part : '')).join('') || object.id : object.id,
    }));
  }
  return Object.entries(manifest?.parts ?? {}).map(([id, part]) => ({ id, label: part.label }));
}

interface Figure3DFallbackProps {
  figure: ThreeDFigure;
  nodeId: string;
  poster?: string;
  manifest?: ModelManifest;
  error?: LibraryError;
  emit: (event: UIEvent) => void;
}

/** Poster + `alt` + accessible parts list when the chunk, model or WebGL fails. */
function Figure3DFallback({ figure, nodeId, poster, manifest, error, emit }: Figure3DFallbackProps): ReactNode {
  const parts = partsOf(figure, manifest);
  return (
    <div
      className="dg-figure3d dg-figure3d-fallback"
      data-dg-part="root"
      data-dg-figure="figure3d"
      data-node-id={nodeId}
      role="group"
      aria-label={figure.alt}
      aria-busy={!error ? 'true' : undefined}
    >
      {poster && <img className="dg-figure3d-poster" data-dg-part="poster" src={poster} alt="" />}
      <p className="dg-figure3d-alt" data-dg-part="alt">{figure.alt}</p>
      {error && (
        <p className="dg-figure3d-error" data-dg-part="error" role="status">
          {error.detail ?? error.code}
        </p>
      )}
      {parts.length > 0 && (
        <ul className="dg-figure3d-parts" data-dg-part="pick-list" aria-label="Model parts">
          {parts.map((part) => (
            <li key={part.id}>
              <button
                type="button"
                data-dg-part="part"
                onClick={() => emit({ type: 'focus', nodeId, ref: `${nodeId}/${part.id}`, label: part.label })}
              >
                {part.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface Figure3DViewProps {
  node: Node;
  figure: ThreeDFigure;
  reducedMotion: boolean;
}

/**
 * Resolve the connector/manifest/asset for one `model3d` figure, then mount the
 * lazy 3D chunk. `scene3d` needs no connector and mounts immediately.
 */
export function Figure3DView({ node, figure, reducedMotion }: Figure3DViewProps): ReactNode {
  const { registry, locale, assets, modelBudget, onError } = useDreamer();
  const emit = useEmitEvent();
  const store = useContext(BoardStoreContext);
  const boardError = useContext(BoardErrorContext);

  const firedCues = useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    () => (store ? store.getState().firedCues : EMPTY_CUES),
    () => EMPTY_CUES,
  );

  const [state, setState] = useState<LoadState>(() =>
    figure.kind === 'scene3d' ? { status: 'ready' } : { status: 'loading' },
  );
  const [poster, setPoster] = useState<string | undefined>(undefined);
  const posterUrl = useRef<string | undefined>(undefined);
  const reportRef = useRef(boardError ?? ((error: LibraryError) => onError?.(error)));
  reportRef.current = boardError ?? ((error: LibraryError) => onError?.(error));
  const budgetRef = useRef(modelBudget);
  budgetRef.current = modelBudget;

  const connectors = useMemo(() => registry.listModelConnectors(), [registry]);

  useEffect(() => {
    if (figure.kind !== 'model3d') return;
    const controller = new AbortController();
    let cancelled = false;
    const report = (error: LibraryError) => reportRef.current(error);

    setState({ status: 'loading' });
    setPoster(undefined);
    if (posterUrl.current) {
      URL.revokeObjectURL(posterUrl.current);
      posterUrl.current = undefined;
    }

    const run = async () => {
      // Two lightweight source shapes: a direct asset URL, or a registry id
      // resolved by a host-configured connector.
      const reference = normalizeModelReference(figure, connectors.map((connector) => connector.id));
      if (reference.kind === 'invalid') {
        report(reference.error);
        setState({ status: 'error', error: reference.error });
        return;
      }
      if (reference.kind === 'url') {
        setState({ status: 'ready', modelAsset: reference.url });
        return;
      }
      const found = await resolveManifest(connectors, reference.ref, { signal: controller.signal, locale });
      if (cancelled) return;
      if ('code' in found) {
        report(found);
        setState({ status: 'error', error: found });
        return;
      }
      const { connector, manifest } = found;

      const budgetError = checkModelBudget(manifest, budgetRef.current);
      if (budgetError) {
        report(budgetError);
        setState({ status: 'error', error: budgetError, manifest });
        return;
      }

      for (const directiveError of validateModelDirectives(node.id, figure, manifest)) {
        report(directiveError);
      }

      // Poster first: it is small and masks the model download.
      if (manifest.assets.poster !== undefined) {
        try {
          const value = await connector.getAsset(manifest.id, manifest.assets.poster, {
            signal: controller.signal,
            locale,
          });
          if (cancelled) return;
          if (typeof value === 'string') setPoster(value);
          else {
            const url = URL.createObjectURL(
              value instanceof Blob ? value : new Blob([value], { type: 'image/png' }),
            );
            posterUrl.current = url;
            setPoster(url);
          }
        } catch {
          // A missing poster is non-fatal; the chunk falls back to `alt`.
        }
      }

      try {
        const asset = await connector.getAsset(manifest.id, manifest.assets.model, {
          signal: controller.signal,
          locale,
        });
        if (cancelled) return;
        const bytes = asset instanceof Blob ? asset.size : asset instanceof ArrayBuffer ? asset.byteLength : undefined;
        if (bytes !== undefined && bytes > budgetRef.current.maxSizeBytes) {
          const error = createError(
            'model-budget-exceeded',
            `Model "${manifest.id}" is ${bytes} bytes (budget ${budgetRef.current.maxSizeBytes})`,
            node.id,
            'model3d',
          );
          report(error);
          setState({ status: 'error', error, manifest });
          return;
        }
        setState({ status: 'ready', connector, manifest, modelAsset: asset });
      } catch (error) {
        if (cancelled) return;
        const failure = asLibraryError(error, 'model-load-failed');
        report(failure);
        setState({ status: 'error', error: failure, manifest });
      }
    };

    void run();
    return () => {
      cancelled = true;
      controller.abort();
      if (posterUrl.current) {
        URL.revokeObjectURL(posterUrl.current);
        posterUrl.current = undefined;
      }
    };
    // `figure` identity changes only when the board state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [figure, connectors, locale, node.id]);

  if (state.status !== 'ready') {
    return (
      <Figure3DFallback
        figure={figure}
        nodeId={node.id}
        poster={poster}
        manifest={state.status === 'error' ? state.manifest : undefined}
        error={state.status === 'error' ? state.error : undefined}
        emit={emit}
      />
    );
  }

  const fallback = (
    <Figure3DFallback figure={figure} nodeId={node.id} poster={poster} manifest={state.manifest} emit={emit} />
  );

  return (
    <Suspense fallback={fallback}>
      <Lazy3D
        figure={figure}
        nodeId={node.id}
        emit={emit}
        onError={(error) => reportRef.current(error)}
        assets={assets}
        connector={state.connector}
        manifest={state.manifest}
        modelAsset={state.modelAsset}
        poster={poster}
        firedCues={firedCues}
        reducedMotion={reducedMotion}
        locale={locale}
        renderInline={renderInline}
      />
    </Suspense>
  );
}
