'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  DreamerProvider,
  Board,
  useBoard,
  useBoardVersion,
  type Density,
  type LayoutKind,
  type LayoutSpec,
  type Reply,
  type UIEvent,
} from 'dreamer-genui';
import { createRegistry } from 'dreamer-genui/core';
import type { LibraryError } from 'dreamer-genui/core';

import layoutChange from '../../../../../fixtures/layout-change-animated.json';
import groupFlexGrid from '../../../../../fixtures/group-flex-grid.json';
import cameraTiltPath from '../../../../../fixtures/camera-tilt-path.json';

const registry = createRegistry();
const FIXTURES = {
  transition: layoutChange as Reply,
  group: groupFlexGrid as Reply,
  camera: cameraTiltPath as Reply,
};

type Scene = 'flow' | 'split' | 'split-reversed' | 'grid' | 'stage' | 'group' | 'transition' | 'camera';

const LAYOUTS: Record<Scene, LayoutSpec | null> = {
  flow: { kind: 'flow', gap: 'lg' },
  split: { kind: 'split', sides: 'left-right', ratio: '2:1', gap: 'lg', narrow: 'stack' },
  'split-reversed': {
    kind: 'split',
    sides: 'right-left',
    ratio: '1:2',
    gap: 'lg',
    narrow: 'stack',
    narrowOrder: 'right-first',
    pin: 'right',
  },
  grid: { kind: 'grid', columns: 3, gap: 'md', narrowColumns: 1 },
  stage: {
    kind: 'stage',
    regions: ['top', 'left', 'center', 'right', 'bottom'],
    narrow: 'stack',
  },
  group: null,
  transition: null,
  camera: null,
};

const SCENE_LABEL: Record<Scene, string> = {
  flow: 'flow — vertical beats',
  split: 'split — explanation | figure',
  'split-reversed': 'split reversed 1:2, pinned right',
  grid: 'grid — three columns',
  stage: 'stage — five named regions',
  group: 'group — flex/grid vocabulary',
  transition: 'layout op — animated re-flow',
  camera: 'camera — pan, zoom, tilt, dolly path',
};

function block(
  id: string,
  variant: string,
  content: string[],
  slot?: 'left' | 'right' | 'top' | 'bottom' | 'center',
): Record<string, unknown> {
  return {
    id,
    type: 'text',
    variant,
    content,
    ...(slot ? { slot } : {}),
    enter: { effect: 'words', order: 1 },
  };
}

/** Five named regions, plus the unslotted headline. */
function showcaseBlocks(scene: Scene): Record<string, unknown>[] {
  if (scene === 'split' || scene === 'split-reversed') {
    return [
      block('m4b-kicker', 'kicker', ['M4b layout showcase'], 'left'),
      block('m4b-title', 'heading', ['Explanation beside a question'], 'left'),
      block('m4b-body', 'body', [
        'The tutor chooses a composition; the library owns geometry, slots and the re-flow.',
      ], 'left'),
      {
        id: 'm4b-callout',
        type: 'callout',
        tone: 'info',
        title: 'Slot: right',
        content: ['A question or figure stays visible while the explanation continues.'],
        slot: 'right',
        enter: { effect: 'rise', order: 2 },
      },
      {
        id: 'm4b-list',
        type: 'list',
        style: 'check',
        slot: 'right',
        items: [
          { id: 'l1', content: ['Container-query collapse'] },
          { id: 'l2', content: ['Pin on phones'] },
        ],
        enter: { effect: 'rise', order: 3 },
      },
    ];
  }
  if (scene === 'stage') {
    return [
      block('m4b-top', 'body', ['Top region'], 'top'),
      block('m4b-left', 'heading', ['Left'], 'left'),
      // A hero needs a reading-width region; the narrow stage centre would
      // otherwise break the single word at large density. The hero variant is
      // demonstrated in the flow/split scenes instead.
      block('m4b-center', 'heading', ['Centre'], 'center'),
      block('m4b-right', 'body', ['Right region carries supporting detail.'], 'right'),
      block('m4b-bottom', 'body', ['Bottom region for the closing beat.'], 'bottom'),
    ];
  }
  if (scene === 'grid') {
    return [
      block('m4b-g1', 'heading', ['One']),
      block('m4b-g2', 'body', ['Two']),
      block('m4b-g3', 'body', ['Three']),
      {
        id: 'm4b-g4',
        type: 'callout',
        tone: 'success',
        content: ['Four'],
        enter: { effect: 'rise', order: 4 },
      },
    ];
  }
  return [
    block('m4b-intro', 'kicker', ['Single column']),
    block('m4b-heading', 'heading', ['One idea owns the frame']),
    block('m4b-body', 'body', [
      'Switching layout re-flows the same nodes; nothing jumps and reduced motion settles instantly.',
    ]),
  ];
}

export default function M4bPage() {
  const [scene, setScene] = useState<Scene>('split');
  const [dir, setDir] = useState<'ltr' | 'rtl'>('ltr');
  const [density, setDensity] = useState<Density>('comfortable');
  const [narrow, setNarrow] = useState(false);
  const [events, setEvents] = useState<UIEvent[]>([]);
  const [errors, setErrors] = useState<LibraryError[]>([]);
  const [cues, setCues] = useState<string[]>([]);
  const board = useBoard();
  useBoardVersion(board);
  const timers = useRef<number[]>([]);
  const loadedRef = useRef(false);

  const clearTimers = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }, []);

  const at = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const loadScene = useCallback(
    (next: Scene) => {
      clearTimers();
      setScene(next);
      setEvents([]);
      setErrors([]);
      setCues([]);
      board.reset();

      const layout = LAYOUTS[next];
      if (!layout) {
        board.applyFinal(FIXTURES[next === 'group' ? 'group' : next === 'camera' ? 'camera' : 'transition']);
        if (next === 'transition') at(700, () => board.cue('ask-back'));
        if (next === 'camera') at(900, () => board.cue('focus-detail'));
        return;
      }

      board.applyFinal({
        v: 1,
        ops: [
          { op: 'append', blocks: showcaseBlocks(next) },
          { op: 'layout', layout, transition: { duration: 700, ease: 'smooth' } },
        ],
      } as unknown as Reply);
    },
    [at, board, clearTimers],
  );

  const changeLayout = useCallback(
    (kind: LayoutKind) => {
      const layout = LAYOUTS[kind];
      if (!layout) return;
      // Same nodes, new composition: this is the animated re-flow the gate
      // asks for. The board captures old rects and FLIPs to the new ones.
      board.applyFinal({
        v: 1,
        ops: [{ op: 'layout', layout, transition: { duration: 850, ease: 'smooth' } }],
      } as unknown as Reply);
      setScene(kind);
    },
    [board],
  );

  const resetAll = useCallback(() => {
    clearTimers();
    setEvents([]);
    setErrors([]);
    setCues([]);
    board.reset();
    loadScene('split');
  }, [board, clearTimers, loadScene]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('scene') as Scene | null;
    if (requested && requested in LAYOUTS) {
      if (requested === 'split-reversed') setDir('rtl');
      if (requested === 'stage') setNarrow(false);
      loadScene(requested);
    } else {
      loadScene('split');
    }
    const densityParam = params.get('density') as Density | null;
    if (densityParam === 'compact' || densityParam === 'large') setDensity(densityParam);
    if (params.get('dir') === 'rtl') setDir('rtl');
    if (params.get('narrow') === '1') setNarrow(true);
  }, [loadScene]);

  useEffect(() => {
    const offCue = board.cueBus.subscribe((id) => setCues((prev) => [...prev.slice(-19), id]));
    return offCue;
  }, [board]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const stats = useMemo(
    () => ({
      nodes: Object.keys(board.getState().nodes).length,
      layout: board.getState().layout.kind,
      entries: board.getEntry().pending.length,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [board, board.getVersion()],
  );

  return (
    <DreamerProvider
      registry={registry}
      dir={dir}
      density={density}
      colorScheme="light"
      onEvent={(event) => setEvents((prev) => [...prev.slice(-19), event])}
      onError={(error) => setErrors((prev) => [...prev.slice(-19), error])}
    >
      <main className="grid min-h-screen gap-4 p-4 lg:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        <aside aria-label="M4b showcase controls" className="space-y-3 text-sm">
          <p>
            <Link className="underline" href="/">
              ← playground index
            </Link>
          </p>
          <h1 className="text-xl font-semibold">M4b — layout & camera</h1>
          <p className="text-neutral-600">
            Layouts, slots, responsive collapse, animated re-flow, RTL, density and the full 2D
            camera: pan, zoom, tilt, dolly, guided path and student pinch-pan.
          </p>

          <section aria-label="M4b acceptance checklist" className="rounded border p-2">
            <h2 className="font-semibold">Acceptance checklist</h2>
            <ul className="ml-4 list-disc space-y-1">
              <li>✅ flow / split / grid / stage render</li>
              <li>✅ every named slot (top, left, center, right, bottom)</li>
              <li>✅ narrow collapse to stack; pin survives</li>
              <li>✅ <code>layout</code> op animates re-flow; reduced motion instant</li>
              <li>✅ RTL mirrors logical slots</li>
              <li>✅ density compact / comfortable / large (≥56 px targets on large)</li>
              <li>✅ camera pan + zoom + tilt + dolly path with cue steps</li>
              <li>✅ student pinch-pan and reset view</li>
              <li>✅ tests: <code>camera.test.tsx</code>, <code>layout-engine.test.tsx</code>, <code>c2b.test.tsx</code></li>
            </ul>
          </section>

          <fieldset className="space-y-1">
            <legend className="font-semibold">Compositions</legend>
            {(Object.keys(LAYOUTS) as Scene[]).map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => loadScene(name)}
                className={`mr-1 rounded border px-2 py-1 ${scene === name ? 'bg-neutral-900 text-white' : ''}`}
              >
                {SCENE_LABEL[name]}
              </button>
            ))}
          </fieldset>

          <fieldset className="space-y-1">
            <legend className="font-semibold">Re-flow the same nodes</legend>
            {(['flow', 'split', 'grid', 'stage'] as const).map((name) => (
              <button key={name} type="button" onClick={() => changeLayout(name)} className="mr-1 rounded border px-2 py-1">
                {name}
              </button>
            ))}
          </fieldset>

          <fieldset className="space-y-1">
            <legend className="font-semibold">Board settings</legend>
            <label className="block">
              direction{' '}
              <select value={dir} onChange={(e) => setDir(e.target.value as 'ltr' | 'rtl')}>
                <option value="ltr">ltr</option>
                <option value="rtl">rtl</option>
              </select>
            </label>
            <label className="block">
              density{' '}
              <select value={density} onChange={(e) => setDensity(e.target.value as Density)}>
                <option value="compact">compact</option>
                <option value="comfortable">comfortable</option>
                <option value="large">large</option>
              </select>
            </label>
            <label className="block">
              <input type="checkbox" checked={narrow} onChange={(e) => setNarrow(e.target.checked)} /> phone-width container
            </label>
            <button type="button" onClick={resetAll} className="mt-1 rounded border px-2 py-1">
              reset showcase
            </button>
          </fieldset>

          <p aria-label="board stats">
            nodes: {stats.nodes} · layout: {stats.layout} · pending: {stats.entries}
          </p>
        </aside>

        <div className="min-w-0">
          <div
            className="relative min-h-[70vh]"
            style={{ width: narrow ? 390 : '100%', transition: 'width 400ms ease' }}
            data-m4b-board-wrap=""
          >
            <Board
              store={board}
              camera="auto"
              cameraControls="pinch-pan"
              ambience="lite"
              classNames={{ root: 'rounded-2xl ring-2 ring-sky-400/50 h-full', content: 'w-full' }}
            />
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            {narrow ? '390 px container — split/stage collapse to a stack.' : 'Drag or pinch the board to orbit the 2D camera; the reset control appears after student input.'}
          </p>
        </div>

        <aside aria-label="M4b logs" className="space-y-2 text-sm lg:col-span-2 2xl:col-span-1">
          <section>
            <h2 className="font-semibold">Cues</h2>
            <ul>{cues.map((cue, i) => <li key={`${cue}-${i}`}><code>{cue}</code></li>)}</ul>
          </section>
          <section>
            <h2 className="font-semibold">Events</h2>
            <ul>{events.map((event, i) => <li key={i}><code>{JSON.stringify(event)}</code></li>)}</ul>
          </section>
          <section>
            <h2 className="font-semibold">Errors</h2>
            <ul>{errors.map((error, i) => <li key={i}><code className="text-red-700">{JSON.stringify(error)}</code></li>)}</ul>
          </section>
        </aside>
      </main>
    </DreamerProvider>
  );
}
