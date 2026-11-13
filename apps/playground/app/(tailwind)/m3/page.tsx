'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  DreamerProvider,
  Board,
  createBoardStore,
  useBoardVersion,
  type Reply,
  type ResolvedTheme,
  type UIEvent,
} from 'dreamer-genui';
import { createRegistry } from 'dreamer-genui/core';

import defineTerm from '../../../../../fixtures/define-term.json';
import cuedNarration from '../../../../../fixtures/cued-narration.json';
import themeMoodShift from '../../../../../fixtures/theme-mood-shift.json';
import mathChem from '../../../../../fixtures/math-chem.json';
import chartBar from '../../../../../fixtures/chart-bar.json';
import diagramRadial from '../../../../../fixtures/diagram-radial.json';
import labeledArt from '../../../../../fixtures/labeled-art.json';
import lottieBasic from '../../../../../fixtures/lottie-basic.json';

const registry = createRegistry();

const FIXTURES: Record<string, Reply> = {
  'define-term': defineTerm as Reply,
  'cued-narration': cuedNarration as Reply,
  'theme-mood-shift': themeMoodShift as Reply,
  'math-chem': mathChem as Reply,
  'chart-bar': chartBar as Reply,
  'diagram-radial': diagramRadial as Reply,
  'labeled-art': labeledArt as Reply,
  'lottie-basic': lottieBasic as Reply,
};

const VARIANTS: Reply = {
  v: 1,
  ops: [
    {
      op: 'replace',
      title: 'Text variants',
      blocks: [
        { id: 'v-kicker', type: 'text', variant: 'kicker', content: ['a small lead-in'] },
        { id: 'v-hero', type: 'text', variant: 'hero', content: ['Big words land.'] },
        { id: 'v-heading', type: 'text', variant: 'heading', content: ['A heading carries the beat'] },
        { id: 'v-body', type: 'text', variant: 'body', content: ['Body text explains the idea in a calm voice.'] },
        {
          id: 'v-definition',
          type: 'text',
          variant: 'definition',
          content: ['A definition names the thing precisely.'],
        },
        { id: 'v-note', type: 'text', variant: 'note', content: ['A note adds a quieter aside.'] },
        { id: 'v-quote', type: 'text', variant: 'quote', content: ['“A quote lets someone else speak.”'] },
      ],
    },
  ],
};

const MARKS: Reply = {
  v: 1,
  ops: [
    {
      op: 'replace',
      title: 'Marks',
      blocks: [
        {
          id: 'm-marks',
          type: 'text',
          variant: 'body',
          content: [
            'This run carries ',
            { mark: 'highlight', text: 'a highlight', color: 'accent' },
            ', an ',
            { mark: 'emphasis', text: 'emphasis' },
            ', the term ',
            { mark: 'term', text: 'photosynthesis', definition: 'how plants make food from light' },
            ', a ',
            { mark: 'focusable', text: 'focusable phrase', ref: 'm3-focus' },
            ', a ',
            { mark: 'annotate', text: 'circled phrase', kind: 'circle' },
            ', and inline math ',
            { mark: 'math', tex: 'E = mc^2' },
            '.',
          ],
        },
      ],
    },
  ],
};

const ENTERS: Reply = {
  v: 1,
  ops: [
    {
      op: 'replace',
      title: 'Entrances',
      blocks: [
        { id: 'e1', type: 'text', variant: 'heading', content: ['wipe'], enter: { effect: 'wipe' } },
        { id: 'e2', type: 'text', variant: 'body', content: ['words arrive one at a time'], enter: { effect: 'words' } },
        { id: 'e3', type: 'text', variant: 'body', content: ['chars spell out'], enter: { effect: 'chars' } },
        { id: 'e4', type: 'text', variant: 'hero', content: ['slam'], enter: { effect: 'slam', split: 'words' } },
        { id: 'e5', type: 'text', variant: 'note', content: ['typewriter'], enter: { effect: 'typewriter' } },
      ],
    },
  ],
};

export default function M3Page() {
  const store = useMemo(() => createBoardStore({ registry }), []);
  useBoardVersion(store);
  const [fixtureName, setFixtureName] = useState('define-term');
  const [scheme, setScheme] = useState<'light' | 'dark'>('light');
  const [pacing, setPacing] = useState<'cued' | 'auto'>('cued');
  const [events, setEvents] = useState<UIEvent[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [cues, setCues] = useState<string[]>([]);
  const [themes, setThemes] = useState<string[]>([]);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    store.applyFinal(FIXTURES['define-term']!);
  }, [store]);

  useEffect(() => {
    const offCue = store.cueBus.subscribe((id) => setCues((prev) => [...prev, id]));
    const offTheme = store.themeChangeBus.subscribe((theme: ResolvedTheme) =>
      setThemes((prev) => [...prev, theme.mood ?? 'custom'])
    );
    const offError = store.errors.subscribe((error) => setErrors((prev) => [...prev, JSON.stringify(error)]));
    return () => {
      offCue();
      offTheme();
      offError();
    };
  }, [store]);

  function load(name: string): void {
    setFixtureName(name);
    setCues([]);
    setThemes([]);
    setErrors([]);
    store.reset();
    store.applyFinal(FIXTURES[name]!);
  }

  function demo(name: string, reply: Reply): void {
    setFixtureName(name);
    setCues([]);
    setThemes([]);
    setErrors([]);
    store.reset();
    store.applyFinal(reply);
  }

  return (
    <DreamerProvider
      registry={registry}
      colorScheme={scheme}
      onEvent={(event) => setEvents((prev) => [...prev, event])}
      onError={(error) => setErrors((prev) => [...prev, JSON.stringify(error)])}
    >
      <main className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
        <aside aria-label="M3 controls">
          <p className="mb-3 text-sm">
            <Link className="underline" href="/">
              ← playground index
            </Link>
          </p>
          <h1 className="text-2xl font-semibold">M3 — Renderer</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Text variants, kinetic entrances, marks, cue gating, moods and both styling paths.
          </p>

          <fieldset className="mt-4">
            <legend className="font-medium">Demos</legend>
            <button className="block text-sm underline" type="button" onClick={() => demo('text variants', VARIANTS)}>
              all text variants
            </button>
            <button className="block text-sm underline" type="button" onClick={() => demo('marks', MARKS)}>
              inline marks
            </button>
            <button className="block text-sm underline" type="button" onClick={() => demo('entrances', ENTERS)}>
              kinetic entrances
            </button>
          </fieldset>

          <fieldset className="mt-4">
            <legend className="font-medium">Fixtures</legend>
            {Object.keys(FIXTURES).map((name) => (
              <label key={name} className="block text-sm">
                <input
                  type="radio"
                  name="m3-fixture"
                  checked={fixtureName === name}
                  onChange={() => load(name)}
                />{' '}
                <code>{name}</code>
              </label>
            ))}
          </fieldset>

          <fieldset className="mt-4">
            <legend className="font-medium">Board</legend>
            <label className="block text-sm">
              colour scheme{' '}
              <select value={scheme} onChange={(e) => setScheme(e.target.value as 'light' | 'dark')}>
                <option value="light">light</option>
                <option value="dark">dark</option>
              </select>
            </label>
            <label className="block text-sm">
              pacing{' '}
              <select value={pacing} onChange={(e) => setPacing(e.target.value as 'cued' | 'auto')}>
                <option value="cued">cued</option>
                <option value="auto">auto</option>
              </select>
            </label>
            <button className="block text-sm underline" type="button" onClick={() => store.cue('beat-1')}>
              cue beat-1
            </button>
            <button className="block text-sm underline" type="button" onClick={() => store.cue('beat-2')}>
              cue beat-2
            </button>
            <button className="block text-sm underline" type="button" onClick={() => store.flush()}>
              flush
            </button>
            <button className="block text-sm underline" type="button" onClick={() => store.reset()}>
              reset
            </button>
          </fieldset>

          <p className="mt-4 text-sm">
            <Link className="underline" href="/plain-css">
              Plain-CSS host →
            </Link>
          </p>
          <p className="text-sm">
            <Link className="underline" href="/showreel">
              §9.4 showreel →
            </Link>
          </p>
        </aside>

        <div className="min-h-[70vh] min-w-0">
          <Board
            store={store}
            camera="off"
            ambience="off"
            recede={false}
            pacing={pacing}
            classNames={{ root: 'rounded-2xl ring-2 ring-sky-400/50 h-full', content: 'max-w-3xl' }}
          />
        </div>

        <aside aria-label="M3 checklist and logs">
          <h2 className="text-lg font-semibold">Acceptance checklist</h2>
          <ul className="mt-1 space-y-1 text-sm">
            <li>✅ seven text variants with kinetic defaults</li>
            <li>✅ all mark kinds, including focusable/term events</li>
            <li>✅ 16 enter effects; draw/morph are M5 stand-ins</li>
            <li>✅ cue-gated entrance (nothing mounts before its cue)</li>
            <li>✅ mood shift changes colour, surface and tempo</li>
            <li>✅ Tailwind bridge and the no-Tailwind <code>/plain-css</code> host</li>
            <li>✅ reduced motion renders content without animation</li>
            <li className="text-neutral-600">
              Tests: <code>tests/react/kinetic.test.tsx</code>, <code>board-gating.test.tsx</code>,{' '}
              <code>tests/styles/*</code>, showreel captures
            </li>
          </ul>

          <h2 className="mt-4 text-lg font-semibold">Logs</h2>
          <p className="text-xs">cues: {cues.join(', ') || '—'}</p>
          <p className="text-xs">themes: {themes.join(', ') || '—'}</p>
          <p className="text-xs">events: {events.length ? events.map((e) => JSON.stringify(e)).join(' · ') : '—'}</p>
          <p className="text-xs text-red-700">errors: {errors.length ? errors.join(' · ') : '—'}</p>
        </aside>
      </main>
    </DreamerProvider>
  );
}
