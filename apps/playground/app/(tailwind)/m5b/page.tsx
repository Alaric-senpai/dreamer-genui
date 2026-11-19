'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Board,
  DreamerProvider,
  createBoardStore,
  type Reply,
  type UIEvent,
} from 'dreamer-genui';
import { createRegistry } from 'dreamer-genui/core';
import type { LibraryError } from 'dreamer-genui/core';
import type { ModelManifest } from 'dreamer-genui/schema';
import {
  createHttpModelConnector,
  createStaticModelConnector,
  withModelCache,
} from 'dreamer-genui/connectors';

import basicFixture from '../../../../../fixtures/model3d-basic.json';
import tourFixture from '../../../../../fixtures/model3d-tour.json';
import sceneFixture from '../../../../../fixtures/scene3d-solids.json';
import hotspotFixture from '../../../../../fixtures/model3d-hotspot-question.json';
import labelFixture from '../../../../../fixtures/model3d-label-question.json';
import missingFixture from '../../../../../fixtures/invalid-model-not-found.json';
import demoManifest from '../../../../../fixtures/model-manifest.json';
import brokenManifest from '../../../../../fixtures/invalid-model-manifest.json';
import overBudgetManifest from '../../../../../fixtures/invalid-model-over-budget.json';

type Mode = 'static' | 'http' | 'http-cache';

const MANIFEST = demoManifest as ModelManifest;
const MANIFESTS: Record<string, unknown> = {
  assembly: MANIFEST,
  overbudget: overBudgetManifest,
  'broken-manifest': brokenManifest,
};

/** Static connector: vetted manifests + an asset resolver, no built-in fetch. */
const staticConnector = createStaticModelConnector(
  MANIFESTS,
  (_modelId, ref) => {
    const file = typeof ref === 'string' ? ref.split('/').pop() ?? ref : ref.connectorAsset;
    return `/api/mock-models/models/${encodeURIComponent(file)}`;
  },
  { id: 'demo' },
);

function modelReply(
  model: string | { id: string; source: string },
  alt: string,
  extra: Record<string, unknown> = {},
): Reply {
  const slug = typeof model === 'string' ? model : `${model.source}-${model.id}`;
  return {
    v: 1,
    ops: [
      {
        op: 'append',
        blocks: [
          {
            id: `model-${slug.replace(/[^a-z0-9]+/gi, '-')}`,
            type: 'figure',
            figure: { kind: 'model3d', model, view: 'iso', controls: 'both', ...extra, alt },
          },
        ],
      },
    ],
  } as Reply;
}

/** Direct asset link: no connector, no manifest — just the GLB URL. */
function urlReply(url: string, alt: string): Reply {
  return {
    v: 1,
    ops: [
      {
        op: 'append',
        blocks: [
          {
            id: 'model-url',
            type: 'figure',
            figure: { kind: 'model3d', modelUrl: url, view: 'iso', controls: 'both', alt },
          },
        ],
      },
    ],
  } as Reply;
}

const SOURCES: Array<{ id: string; label: string; reply: Reply }> = [
  { id: 'basic', label: 'model3d-basic.json — highlight + labels', reply: basicFixture as Reply },
  {
    id: 'url',
    label: 'modelUrl — direct GLB asset link',
    reply: urlReply(
      '/api/mock-models/models/assembly.glb',
      'The demo assembly loaded straight from a GLB link, without a connector.',
    ),
  },
  {
    id: 'source',
    label: 'model { id, source } — connector lookup',
    reply: modelReply(
      { id: 'assembly', source: 'demo' },
      'The demo assembly resolved by id and source through the registered connector.',
    ),
  },
  { id: 'tour', label: 'model3d-tour.json — cue-driven tour', reply: tourFixture as Reply },
  { id: 'scene', label: 'scene3d-solids.json — procedural primitives', reply: sceneFixture as Reply },
  {
    id: 'unknown-part',
    label: 'unknown part — graceful warning',
    reply: modelReply('demo:assembly', 'A demo assembly with an unknown part directive.', {
      highlight: ['ghost'],
      isolate: ['ghost'],
    }),
  },
  { id: 'missing', label: 'model not found — poster/alt fallback', reply: missingFixture as Reply },
  {
    id: 'malformed',
    label: 'malformed manifest — connector-error fallback',
    reply: modelReply('demo:broken-manifest', 'A model whose manifest is malformed.'),
  },
  {
    id: 'overbudget',
    label: 'over budget — model-budget-exceeded fallback',
    reply: modelReply('demo:overbudget', 'A model far larger than the default budget.'),
  },
  {
    id: 'hotspot',
    label: 'model3d-hotspot-question.json — widget in M6b',
    reply: hotspotFixture as Reply,
  },
  {
    id: 'label',
    label: 'model3d-label-question.json — widget in M6b',
    reply: labelFixture as Reply,
  },
];

const CHECKLIST = [
  'Static and HTTP connectors resolve the same ModelManifest mapping.',
  'Poster appears before the GLB; no blank frame.',
  'Tour changes view, isolates, highlights, cutaways, explodes and flows on cue.',
  'Tapping a part emits focus with ref = figureId/partId.',
  'Unknown part/view/model fall back gracefully with typed errors.',
  'Malformed manifests raise connector-error; budgets raise model-budget-exceeded.',
  'WebGL unavailable shows poster + alt + accessible parts list.',
  'Cached mode serves the model when the network fails (toggle offline).',
  'scene3d renders procedural primitives and labels.',
  '3D runtime is a lazy chunk (not in the initial bundle).',
  'No frames render when idle (render-on-demand, verified in tests).',
  'Hotspot/label widgets arrive in M6b; part-id answers are contract-tested now.',
];

const CUE_BUTTONS = [
  { id: 'view-top', label: 'view top-down' },
  { id: 'show-rotor', label: 'isolate rotor' },
  { id: 'cutaway', label: 'cutaway + flow' },
  { id: 'wrap', label: 'back to iso' },
  { id: 'focus-core', label: 'focus core (scene3d)' },
];

function rewrite(value: unknown, mode: Mode): unknown {
  if (mode === 'static') return value;
  if (typeof value === 'string') {
    return value.startsWith('demo:') ? `http:${value.slice('demo:'.length)}` : value;
  }
  if (Array.isArray(value)) return value.map((item) => rewrite(item, mode));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, rewrite(item, mode)]),
    );
  }
  return value;
}

export default function M5bPage() {
  const [mode, setMode] = useState<Mode>('static');
  const [sourceId, setSourceId] = useState('basic');
  const [narrow, setNarrow] = useState(false);
  const [offline, setOffline] = useState(false);
  const [events, setEvents] = useState<UIEvent[]>([]);
  const [errors, setErrors] = useState<LibraryError[]>([]);
  const [cues, setCues] = useState<string[]>([]);
  const offlineRef = useRef(false);
  offlineRef.current = offline;

  const httpConnector = useMemo(
    () =>
      createHttpModelConnector({
        id: 'http',
        baseUrl: '/api/mock-models',
        fetchAssets: true,
        fetch: (input, init) =>
          offlineRef.current
            ? Promise.reject(new Error('simulated offline'))
            : fetch(input, init),
      }),
    [],
  );

  const connectors = useMemo(
    () => ({
      static: staticConnector,
      http: httpConnector,
      cached: withModelCache(httpConnector, { name: 'dg-m5b-models' }),
    }),
    [httpConnector],
  );

  const registry = useMemo(() => {
    const next = createRegistry();
    next.register('modelConnectors', 'demo', connectors.static);
    if (mode !== 'static') next.register('modelConnectors', 'http', connectors.cached);
    return next;
  }, [mode, connectors]);

  const store = useMemo(() => createBoardStore({ registry }), [registry]);

  useEffect(() => {
    const source = SOURCES.find((entry) => entry.id === sourceId) ?? SOURCES[0]!;
    setEvents([]);
    setErrors([]);
    setCues([]);
    store.reset();
    store.applyFinal(rewrite(source.reply, mode) as Reply);
  }, [store, sourceId, mode]);

  const fireCue = useCallback(
    (cue: string) => {
      const state = store.getState();
      if (!state.nodes || Object.keys(state.nodes).length === 0) return;
      store.cue(cue);
    },
    [store],
  );

  return (
    <DreamerProvider
      registry={registry}
      density="comfortable"
      colorScheme="light"
      onEvent={(event) => setEvents((prev) => [event, ...prev].slice(0, 40))}
      onError={(error) => setErrors((prev) => [error, ...prev].slice(0, 20))}
    >
      <main className="grid min-h-screen gap-4 p-4 lg:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)_320px]">
        <aside aria-label="M5b controls" className="space-y-4 text-sm">
          <div>
            <Link href="/" className="text-sky-700 underline">
              ← playground
            </Link>
            <h1 className="mt-2 text-xl font-semibold">M5b · 3D figures and connectors</h1>
            <p className="text-neutral-600">
              The tutor directs vetted models; the host supplies a connector. Switch between the
              static reference connector and the HTTP mock registry and confirm the board cannot
              tell the difference.
            </p>
          </div>

          <fieldset className="space-y-1">
            <legend className="font-semibold">Connector</legend>
            <select
              aria-label="model connector"
              className="w-full rounded border px-2 py-1"
              value={mode}
              onChange={(event) => setMode(event.target.value as Mode)}
            >
              <option value="static">static — in-memory manifests</option>
              <option value="http">http — mock registry route</option>
              <option value="http-cache">http + cache — offline capable</option>
            </select>
            {mode === 'http-cache' ? (
              <label className="mt-1 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={offline}
                  onChange={(event) => setOffline(event.target.checked)}
                />
                simulate offline after first load
              </label>
            ) : null}
            <p className="text-xs text-neutral-500">
              {mode === 'static'
                ? 'Manifests and assets come from the host bundle; no connector fetch.'
                : mode === 'http'
                  ? 'GET /api/mock-models/models/assembly/manifest + GLB bytes.'
                  : 'Version-checked manifest and byte-cached assets; toggle offline to test stale serving.'}
            </p>
          </fieldset>

          <fieldset className="space-y-1">
            <legend className="font-semibold">Fixture</legend>
            <select
              aria-label="3d fixture"
              className="w-full rounded border px-2 py-1"
              value={sourceId}
              onChange={(event) => setSourceId(event.target.value)}
            >
              {SOURCES.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="mt-1 rounded border px-2 py-1"
              onClick={() => {
                setSourceId('basic');
                setMode('static');
                store.reset();
              }}
            >
              replay demo
            </button>
          </fieldset>

          <fieldset className="space-y-1">
            <legend className="font-semibold">Narration cues</legend>
            <div className="flex flex-wrap gap-1">
              {CUE_BUTTONS.map((cue) => (
                <button
                  key={cue.id}
                  type="button"
                  className="rounded border px-2 py-1 text-xs"
                  onClick={() => fireCue(cue.id)}
                >
                  {cue.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-neutral-500">
              Tour steps fire when their cue has fired. Cues are board state, so firing before the
              figure loads still lands.
            </p>
          </fieldset>

          <fieldset className="space-y-1">
            <legend className="font-semibold">Board</legend>
            <label className="block">
              <input
                type="checkbox"
                checked={narrow}
                onChange={(event) => setNarrow(event.target.checked)}
              />{' '}
              phone-width container
            </label>
            <p className="text-xs text-neutral-500">
              Container queries collapse the parts list and controls at the board&apos;s own width.
            </p>
          </fieldset>

          <section aria-label="M5b acceptance checklist" className="space-y-1">
            <h2 className="font-semibold">Acceptance checklist</h2>
            <ul className="list-disc pl-4 text-xs text-neutral-700">
              {CHECKLIST.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </aside>

        <div className="min-w-0">
          <div
            className="relative min-h-[70vh]"
            style={{ width: narrow ? 390 : '100%', transition: 'width 400ms ease' }}
          >
            <Board
              store={store}
              pacing="auto"
              camera="off"
              ambience="off"
              onCue={(cue) => setCues((prev) => [cue, ...prev].slice(0, 20))}
              classNames={{ root: 'rounded-2xl ring-2 ring-sky-400/50 h-full', content: 'w-full' }}
            />
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Drag to orbit, pinch or wheel to zoom, tap a part to emit <code>focus</code>. The views
            bar includes presets plus manifest views. The parts list is the keyboard and
            screen-reader equivalent of picking.
          </p>
        </div>

        <aside aria-label="M5b logs" className="space-y-2 text-sm lg:col-span-2 2xl:col-span-1">
          <section>
            <h2 className="font-semibold">Cues</h2>
            <ul className="max-h-28 overflow-auto">
              {cues.length === 0 ? <li className="text-neutral-500">No cues fired.</li> : null}
              {cues.map((cue, index) => (
                <li key={`${cue}-${index}`}>
                  <code>{cue}</code>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="font-semibold">Events</h2>
            <ul className="max-h-64 overflow-auto">
              {events.length === 0 ? <li className="text-neutral-500">No events yet.</li> : null}
              {events.map((event, index) => (
                <li key={index}>
                  <code>{JSON.stringify(event)}</code>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="font-semibold">Errors</h2>
            <ul className="max-h-48 overflow-auto">
              {errors.length === 0 ? <li className="text-neutral-500">No errors.</li> : null}
              {errors.map((error, index) => (
                <li key={index}>
                  <code className="text-red-700">{JSON.stringify(error)}</code>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </main>
    </DreamerProvider>
  );
}
