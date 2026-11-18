'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  DreamerProvider,
  Board,
  useBoard,
  useBoardVersion,
  type Pacing,
  type Reply,
  type UIEvent,
} from 'dreamer-genui';
import { createRegistry } from 'dreamer-genui/core';
import type { LibraryError } from 'dreamer-genui/core';

import referenceFixture from '../../../../../fixtures/reference-saas-explainer.json';
import morphFixture from '../../../../../fixtures/text-morph.json';
import transitionsFixture from '../../../../../fixtures/scene-transitions.json';
import pointerFixture from '../../../../../fixtures/pointer-tour.json';
import narrationFixture from '../../../../../fixtures/lesson-turn-narration.json';

const registry = createRegistry();

type RawBeat = { id: string; text: string; pauseAfterMs?: number };
type RawReply = { v: number; ops: Array<Record<string, unknown>>; narration?: RawBeat[] };

const reference = referenceFixture as unknown as RawReply;

const REFERENCE_SCENES = reference.ops
  .filter((op) => op['op'] === 'replace')
  .map((op, index) => {
    const prefix = `s${index + 1}-`;
    const pointers = index === 4 ? reference.ops.filter((candidate) => candidate['op'] === 'pointer') : [];
    const narration = (reference.narration ?? []).filter((beat) => beat.id.startsWith(prefix));
    return { op, pointers, narration } as const;
  });

function referenceReply(index: number): Reply {
  const scene = REFERENCE_SCENES[index] ?? REFERENCE_SCENES[0];
  return {
    v: 1,
    ops: [scene?.op, ...(scene?.pointers ?? [])].filter(Boolean),
    narration: scene?.narration,
  } as unknown as Reply;
}

const SOURCES = [
  { id: 'reference', label: 'Reference — five scenes', reply: null },
  { id: 'morph', label: 'Text morph + assemble + iris', reply: morphFixture as unknown as Reply },
  { id: 'transitions', label: 'Scene transitions', reply: transitionsFixture as unknown as Reply },
  { id: 'pointer', label: 'Pointer tour', reply: pointerFixture as unknown as Reply },
  { id: 'narration', label: 'Narration beats + reading pacing', reply: narrationFixture as unknown as Reply },
] as const;

type SourceId = (typeof SOURCES)[number]['id'];

const CHECKLIST = [
  'Every reference scene is protocol ops only (no one-off code).',
  'Transitions: fade, iris, wipe, push and morph play with theme flips at midpoint.',
  'Keyed text morph + assemble + caret typewriter are used for the reference headlines.',
  'Pointer travels between nodes, ripples on tap-target change and hides on cue.',
  'Narration beats drive cues; reading pacing works with voice off.',
  'Orbit diagram, blueprint-grid and rings ambience, glow and drift are available.',
  'Reduced motion degrades transitions to cut and keeps all content readable.',
  'Exam mode forces cut/fade and disables the pointer.',
] as const;

export default function M4cPage() {
  const [source, setSource] = useState<SourceId>('reference');
  const [referenceScene, setReferenceScene] = useState(0);
  const [pacing, setPacing] = useState<Pacing>('reading');
  const [narrow, setNarrow] = useState(false);
  const [events, setEvents] = useState<UIEvent[]>([]);
  const [errors, setErrors] = useState<LibraryError[]>([]);
  const [cues, setCues] = useState<string[]>([]);
  const board = useBoard();
  const version = useBoardVersion(board);
  const loadedRef = useRef(false);

  const clearLogs = useCallback(() => {
    setEvents([]);
    setErrors([]);
    setCues([]);
  }, []);

  const applySource = useCallback(
    (next: SourceId, scene = 0) => {
      clearLogs();
      board.reset();
      if (next === 'reference') {
        setReferenceScene(scene);
        board.applyFinal(referenceReply(scene));
        return;
      }
      const found = SOURCES.find((candidate) => candidate.id === next);
      if (found?.reply) board.applyFinal(found.reply);
    },
    [board, clearLogs]
  );

  const chooseSource = useCallback(
    (next: SourceId) => {
      setSource(next);
      applySource(next, 0);
    },
    [applySource]
  );

  const nextReferenceScene = useCallback(() => {
    const next = (referenceScene + 1) % REFERENCE_SCENES.length;
    clearLogs();
    board.applyFinal(referenceReply(next));
    setReferenceScene(next);
  }, [board, clearLogs, referenceScene]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('source') as SourceId | null;
    const scene = Number(params.get('scene') ?? 0);
    const next = SOURCES.some((candidate) => candidate.id === requested) ? (requested as SourceId) : 'reference';
    setSource(next);
    setPacing(params.get('pacing') === 'cued' ? 'cued' : 'reading');
    setNarrow(params.get('narrow') === '1');
    applySource(next, Number.isFinite(scene) ? Math.max(0, Math.min(REFERENCE_SCENES.length - 1, scene)) : 0);
  }, [applySource]);

  useEffect(() => {
    const offCue = board.cueBus.subscribe((cue) => setCues((current) => [...current, cue]));
    return () => offCue();
  }, [board]);

  const state = board.getState();
  const stats = {
    nodes: Object.keys(state.nodes).length,
    title: state.title ?? '—',
    scene: referenceScene + 1,
  };
  const sceneCount = REFERENCE_SCENES.length;
  void version;

  return (
    <DreamerProvider
      registry={registry}
      density="comfortable"
      colorScheme="light"
      onEvent={(event) => setEvents((current) => [event, ...current].slice(0, 40))}
      onError={(error) => setErrors((current) => [error, ...current].slice(0, 20))}
    >
      <main className="grid min-h-screen gap-4 p-4 lg:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)_320px]">
        <aside aria-label="M4c controls" className="space-y-4 text-sm">
          <div>
            <Link href="/" className="text-sky-700 underline">
              ← playground index
            </Link>
            <h1 className="mt-2 text-xl font-semibold">M4c — Motion language</h1>
            <p className="text-neutral-600">
              Reference-derived transitions, keyed morph, pointer, reading pacing, orbit, grid/rings and drift.
            </p>
          </div>

          <fieldset className="space-y-1">
            <legend className="font-semibold">Demo source</legend>
            {SOURCES.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => chooseSource(candidate.id)}
                className={`mr-1 rounded border px-2 py-1 ${source === candidate.id ? 'bg-neutral-900 text-white' : ''}`}
              >
                {candidate.label}
              </button>
            ))}
          </fieldset>

          <fieldset className="space-y-1">
            <legend className="font-semibold">Cue pacing</legend>
            <button
              type="button"
              onClick={() => setPacing('reading')}
              className={`mr-1 rounded border px-2 py-1 ${pacing === 'reading' ? 'bg-neutral-900 text-white' : ''}`}
            >
              reading (voice off)
            </button>
            <button
              type="button"
              onClick={() => setPacing('cued')}
              className={`rounded border px-2 py-1 ${pacing === 'cued' ? 'bg-neutral-900 text-white' : ''}`}
            >
              cued (host/voice)
            </button>
            {pacing === 'cued' ? (
              <button type="button" onClick={() => board.flush()} className="ml-1 rounded border px-2 py-1">
                flush cues
              </button>
            ) : null}
          </fieldset>

          {source === 'reference' ? (
            <fieldset className="space-y-1">
              <legend className="font-semibold">Reference scene</legend>
              <p>
                Scene {stats.scene} / {sceneCount}
              </p>
              <button type="button" onClick={nextReferenceScene} className="rounded border px-2 py-1">
                next scene (replay)
              </button>
              <p className="text-xs text-neutral-500">
                Each scene is one <code>replace</code> op with its own transition and mood; narration beats drive the cues.
              </p>
            </fieldset>
          ) : null}

          <fieldset className="space-y-1">
            <legend className="font-semibold">Board settings</legend>
            <label className="block">
              <input type="checkbox" checked={narrow} onChange={(event) => setNarrow(event.target.checked)} /> phone-width container
            </label>
            <button type="button" onClick={() => applySource(source, referenceScene)} className="mt-1 rounded border px-2 py-1">
              replay demo
            </button>
          </fieldset>

          <section aria-label="M4c acceptance checklist" className="space-y-1">
            <h2 className="font-semibold">Acceptance checklist</h2>
            <ul className="list-disc pl-4 text-xs text-neutral-700">
              {CHECKLIST.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <p aria-label="board stats" className="text-xs text-neutral-600">
            nodes: {stats.nodes} · title: {stats.title} · pacing: {pacing}
          </p>
        </aside>

        <div className="min-w-0">
          <div className="relative min-h-[70vh]" style={{ width: narrow ? 390 : '100%', transition: 'width 400ms ease' }}>
            <Board
              store={board}
              pacing={pacing}
              camera="auto"
              cameraControls="pinch-pan"
              ambience="auto"
              classNames={{ root: 'rounded-2xl ring-2 ring-sky-400/50 h-full', content: 'w-full' }}
            />
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Reading pacing derives cue times from beat text; switch to cued to drive beats yourself.
          </p>
        </div>

        <aside aria-label="M4c logs" className="space-y-2 text-sm lg:col-span-2 2xl:col-span-1">
          <section>
            <h2 className="font-semibold">Cues</h2>
            <ul className="max-h-48 overflow-auto">{cues.map((cue, index) => <li key={`${cue}-${index}`}><code>{cue}</code></li>)}</ul>
          </section>
          <section>
            <h2 className="font-semibold">Events</h2>
            <ul className="max-h-48 overflow-auto">{events.map((event, index) => <li key={index}><code>{JSON.stringify(event)}</code></li>)}</ul>
          </section>
          <section>
            <h2 className="font-semibold">Errors</h2>
            <ul className="max-h-48 overflow-auto">
              {errors.map((error, index) => <li key={index}><code className="text-red-700">{JSON.stringify(error)}</code></li>)}
            </ul>
          </section>
        </aside>
      </main>
    </DreamerProvider>
  );
}
