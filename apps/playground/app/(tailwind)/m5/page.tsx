'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  DreamerProvider,
  Board,
  useBoard,
  useBoardVersion,
  type Reply,
  type UIEvent,
} from 'dreamer-genui';
import { createRegistry } from 'dreamer-genui/core';
import type { LibraryError } from 'dreamer-genui/core';

import flowchartFixture from '../../../../../fixtures/process-flowchart.json';
import radialFixture from '../../../../../fixtures/diagram-radial.json';
import cycleFixture from '../../../../../fixtures/diagram-cycle.json';
import timelineFixture from '../../../../../fixtures/timeline.json';
import compareFixture from '../../../../../fixtures/compare.json';
import labeledFixture from '../../../../../fixtures/labeled-art.json';
import lottieFixture from '../../../../../fixtures/lottie-basic.json';
import chartBarFixture from '../../../../../fixtures/chart-bar.json';
import chartLineFixture from '../../../../../fixtures/chart-line.json';
import chartAreaFixture from '../../../../../fixtures/chart-area.json';
import chartPieFixture from '../../../../../fixtures/chart-pie.json';
import chartRadarFixture from '../../../../../fixtures/chart-radar.json';
import chartRadialbarFixture from '../../../../../fixtures/chart-radialbar.json';
import chartScatterFixture from '../../../../../fixtures/chart-scatter.json';
import chartComposedFixture from '../../../../../fixtures/chart-composed.json';
import chartFunnelFixture from '../../../../../fixtures/chart-funnel.json';
import chartTreemapFixture from '../../../../../fixtures/chart-treemap.json';
import chartSankeyFixture from '../../../../../fixtures/chart-sankey.json';
import modelFixture from '../../../../../fixtures/model3d-basic.json';

const registry = createRegistry();

/** A tiny inline SVG data URL — no network is used anywhere in the figure runtime. */
const DEMO_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">' +
      '<rect width="320" height="180" fill="#eef4fb"/>' +
      '<circle cx="160" cy="90" r="52" fill="#3b82f6"/>' +
      '<text x="160" y="98" text-anchor="middle" fill="white" font-family="sans-serif" font-size="22">asset</text>' +
      '</svg>'
  );

/** Inline reply proving `{ asset }` image refs resolve only through the host callback. */
const assetReply: Reply = {
  v: 1,
  ops: [
    {
      op: 'append',
      blocks: [
        {
          id: 'asset-image',
          type: 'figure',
          figure: {
            kind: 'image',
            src: { asset: 'demo-svg' },
            alt: 'An image figure whose source was resolved by the host resolveAsset callback',
          },
          enter: { effect: 'reveal' },
        } as never,
      ],
    },
  ],
};

const SOURCES = [
  { id: 'flowchart', label: 'process-flowchart.json — decision + recycle loop', reply: flowchartFixture },
  { id: 'radial', label: 'diagram-radial.json', reply: radialFixture },
  { id: 'cycle', label: 'diagram-cycle.json', reply: cycleFixture },
  { id: 'timeline', label: 'timeline.json', reply: timelineFixture },
  { id: 'compare', label: 'compare.json', reply: compareFixture },
  { id: 'labeled', label: 'labeled-art.json', reply: labeledFixture },
  { id: 'lottie', label: 'lottie-basic.json — expression-free Lottie animation', reply: lottieFixture },
  { id: 'chart-bar', label: 'chart-bar.json — bar', reply: chartBarFixture },
  { id: 'chart-line', label: 'chart-line.json — line', reply: chartLineFixture },
  { id: 'chart-area', label: 'chart-area.json — stacked area', reply: chartAreaFixture },
  { id: 'chart-pie', label: 'chart-pie.json — donut', reply: chartPieFixture },
  { id: 'chart-radar', label: 'chart-radar.json — radar', reply: chartRadarFixture },
  { id: 'chart-radialbar', label: 'chart-radialbar.json — radial bar', reply: chartRadialbarFixture },
  { id: 'chart-scatter', label: 'chart-scatter.json — scatter', reply: chartScatterFixture },
  { id: 'chart-composed', label: 'chart-composed.json — composed (bar + line)', reply: chartComposedFixture },
  { id: 'chart-funnel', label: 'chart-funnel.json — funnel', reply: chartFunnelFixture },
  { id: 'chart-treemap', label: 'chart-treemap.json — treemap', reply: chartTreemapFixture },
  { id: 'chart-sankey', label: 'chart-sankey.json — sankey', reply: chartSankeyFixture },
  { id: 'asset', label: 'resolveAsset demo — { asset } image', reply: assetReply },
  { id: 'fallback', label: 'model3d-basic.json — alt fallback until M5b', reply: modelFixture },
] as const;

type SourceId = (typeof SOURCES)[number]['id'];

const CHECKLIST = [
  'Every M5 figure kind renders from its fixture (image, icon, diagram, flowchart, timeline, labeled, chart).',
  'All eleven chart types render from their own fixtures via recharts (bar, line, area, pie, radar, radialBar, scatter, composed, funnel, treemap, sankey).',
  'process-flowchart.json draws in sequentially with a decision, labelled branches and a recycle loop.',
  'Flowchart steps are focusable: tapping a step emits focus with ref = figureId/nodeId.',
  'Phone-width container shows the one-step stepper with no overlapping edges or horizontal scroll.',
  'Figures ship in a separate lazy chunk powered by recharts; the initial bundle carries no chart library code.',
  'Forcing a figure to fail (or an unbuilt 3D kind) shows its mandatory alt text, never a blank board.',
  'Figures respect their layout region and their enter triggers, including sequential reveal.',
  'Radial diagrams draw a wheel-of-life composition (rings, hub, hue-cycled satellites).',
  'Timeline draws a colored milestone rail with alternating pins and cards; vertical stays a rail.',
  'Lottie plays an expression-free animation through the lazy player; reduced motion shows its first frame.',
  'Compare block renders a themable table with highlight; keyboard, screen-reader and axe checks pass (tests/react/figures).',
] as const;

export default function M5Page() {
  const [source, setSource] = useState<SourceId>('flowchart');
  const [narrow, setNarrow] = useState(false);
  const [events, setEvents] = useState<UIEvent[]>([]);
  const [errors, setErrors] = useState<LibraryError[]>([]);
  const board = useBoard();
  const version = useBoardVersion(board);
  const appliedRef = useRef<typeof board | null>(null);

  const applySource = useCallback(
    (next: SourceId) => {
      setEvents([]);
      setErrors([]);
      board.reset();
      const found = SOURCES.find((candidate) => candidate.id === next);
      if (found?.reply) board.applyFinal(found.reply as Reply);
    },
    [board]
  );

  useEffect(() => {
    if (appliedRef.current === board) return;
    appliedRef.current = board;
    const params = new URLSearchParams(window.location.search);
    setNarrow(params.get('narrow') === '1');
    applySource('flowchart');
  }, [applySource, board]);

  const state = board.getState();
  void version;

  return (
    <DreamerProvider
      registry={registry}
      density="comfortable"
      colorScheme="light"
      resolveAsset={(id) =>
        id === 'demo-svg'
          ? DEMO_SVG
          : id === 'wave-animation-v1'
            ? '/lottie/wave.json'
            : undefined
      }
      onEvent={(event) => setEvents((current) => [event, ...current].slice(0, 40))}
      onError={(error) => setErrors((current) => [error, ...current].slice(0, 20))}
    >
      <main className="grid min-h-screen gap-4 p-4 lg:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)_320px]">
        <aside aria-label="M5 controls" className="space-y-4 text-sm">
          <div>
            <Link href="/" className="text-sky-700 underline">
              ← playground index
            </Link>
            <h1 className="mt-2 text-xl font-semibold">M5 — Figures</h1>
            <p className="text-neutral-600">
              Diagrams, flowcharts, timelines, labeled art and charts — drawn in from a separate lazy
              chunk, with focusable steps, hand-drawn annotation strokes and alt fallbacks. All eleven
              chart types render through recharts from their own fixtures.
            </p>
          </div>

          <fieldset className="space-y-1">
            <legend className="font-semibold">Fixture</legend>
            <select
              aria-label="figure fixture"
              value={source}
              onChange={(event) => {
                const next = event.target.value as SourceId;
                setSource(next);
                applySource(next);
              }}
              className="w-full rounded border px-2 py-1"
            >
              {SOURCES.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => applySource(source)}
              className="mt-1 rounded border px-2 py-1"
            >
              replay demo
            </button>
          </fieldset>

          <fieldset className="space-y-1">
            <legend className="font-semibold">Board settings</legend>
            <label className="block">
              <input
                type="checkbox"
                checked={narrow}
                onChange={(event) => setNarrow(event.target.checked)}
              />{' '}
              phone-width container (stepper + narrow layout)
            </label>
            <p className="text-xs text-neutral-500">
              The board uses container queries, so figure layouts collapse at the board&apos;s own
              width — not the window&apos;s.
            </p>
          </fieldset>

          <section aria-label="M5 acceptance checklist" className="space-y-1">
            <h2 className="font-semibold">Acceptance checklist</h2>
            <ul className="list-disc pl-4 text-xs text-neutral-700">
              {CHECKLIST.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <p aria-label="board stats" className="text-xs text-neutral-600">
            nodes: {Object.keys(state.nodes).length} · title: {state.title ?? '—'}
          </p>
        </aside>

        <div className="min-w-0">
          <div
            className="relative min-h-[70vh]"
            style={{ width: narrow ? 390 : '100%', transition: 'width 400ms ease' }}
          >
            <Board
              store={board}
              pacing="auto"
              camera="off"
              ambience="off"
              classNames={{ root: 'rounded-2xl ring-2 ring-sky-400/50 h-full', content: 'w-full' }}
            />
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Interact: tap a flowchart step to emit <code>focus</code> (ref = node id) and advance the
            phone stepper. The labeled figure&apos;s part buttons emit focus too. Switch to the model3d
            fixture to see the mandatory-alt fallback before M5b.
          </p>
        </div>

        <aside aria-label="M5 logs" className="space-y-2 text-sm lg:col-span-2 2xl:col-span-1">
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
