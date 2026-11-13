'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  createBoardStore,
  useBoardVersion,
  type Reply,
  type ResolvedTheme,
} from 'dreamer-genui';
import {
  collectCueIds,
  computeEntryPlan,
  createRegistry,
  getCapabilities,
  getSystemPromptGuide,
  serializeBoard,
} from 'dreamer-genui/core';

import defineTerm from '../../../../../fixtures/define-term.json';
import cuedNarration from '../../../../../fixtures/cued-narration.json';
import themeMoodShift from '../../../../../fixtures/theme-mood-shift.json';
import replaceWithTheme from '../../../../../fixtures/replace-with-theme.json';
import replaceNewTopic from '../../../../../fixtures/replace-new-topic.json';
import cameraMoves from '../../../../../fixtures/camera-moves.json';
import streamingPartial from '../../../../../fixtures/streaming-partial.json';

const registry = createRegistry();

const FIXTURES: Record<string, Reply> = {
  'define-term': defineTerm as Reply,
  'cued-narration': cuedNarration as Reply,
  'theme-mood-shift': themeMoodShift as Reply,
  'replace-with-theme': replaceWithTheme as Reply,
  'replace-new-topic': replaceNewTopic as Reply,
  'camera-moves': cameraMoves as Reply,
  'streaming-partial': streamingPartial as Reply,
};

export default function M2Page() {
  const store = useMemo(() => createBoardStore({ registry }), []);
  useBoardVersion(store);
  const [fixtureName, setFixtureName] = useState('cued-narration');
  const [cues, setCues] = useState<string[]>([]);
  const [enter, setEnter] = useState<string[]>([]);
  const [themes, setThemes] = useState<string[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [language, setLanguage] = useState('');
  const [compact, setCompact] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    store.applyFinal(FIXTURES['cued-narration']!);
  }, [store]);

  useEffect(() => {
    const offCue = store.cueBus.subscribe((id) => setCues((prev) => [...prev, id]));
    const offEnter = store.enterBus.subscribe((id) => setEnter((prev) => [...prev, id]));
    const offTheme = store.themeChangeBus.subscribe((theme: ResolvedTheme) =>
      setThemes((prev) => [...prev, theme.mood ?? 'custom'])
    );
    const offEvent = store.events.subscribe((event) => setEvents((prev) => [...prev, JSON.stringify(event)]));
    const offError = store.errors.subscribe((error) => setErrors((prev) => [...prev, JSON.stringify(error)]));
    return () => {
      offCue();
      offEnter();
      offTheme();
      offEvent();
      offError();
    };
  }, [store]);

  const state = store.getState();
  const fixture = FIXTURES[fixtureName]!;
  const entryPlan = computeEntryPlan(state, 'cued');
  const guide = useMemo(
    () => getSystemPromptGuide(registry, { compact, ...(language ? { language } : {}) }),
    [compact, language]
  );
  const snapshot = useMemo(() => JSON.stringify(state, null, 2), [state]);

  function apply(name: string): void {
    setFixtureName(name);
    setCues([]);
    setEnter([]);
    setThemes([]);
    setEvents([]);
    setErrors([]);
    store.reset();
    store.applyFinal(FIXTURES[name]!);
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
      <aside aria-label="M2 inspector controls">
        <p className="mb-3 text-sm">
          <Link className="underline" href="/">
            ← playground index
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">M2 — Core</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Headless reducer, cue engine, theme resolver, prompt guide and board serialization.
        </p>

        <fieldset className="mt-4">
          <legend className="font-medium">Fixture</legend>
          {Object.keys(FIXTURES).map((name) => (
            <label key={name} className="block text-sm">
              <input
                type="radio"
                name="m2-fixture"
                checked={fixtureName === name}
                onChange={() => apply(name)}
              />{' '}
              <code>{name}</code>
            </label>
          ))}
        </fieldset>

        <fieldset className="mt-4">
          <legend className="font-medium">Cue controls</legend>
          <button className="block text-sm underline" type="button" onClick={() => store.cue('beat-1')}>
            cue beat-1
          </button>
          <button className="block text-sm underline" type="button" onClick={() => store.cue('beat-2')}>
            cue beat-2
          </button>
          <button className="block text-sm underline" type="button" onClick={() => store.flush()}>
            flush all pending
          </button>
          <button className="block text-sm underline" type="button" onClick={() => store.back()}>
            back()
          </button>
          <button className="block text-sm underline" type="button" onClick={() => store.reset()}>
            reset()
          </button>
        </fieldset>

        <p className="mt-4 text-xs text-neutral-600">
          Detours: {state.detours.length} · history: {state.history.length} · known cues:{' '}
          {collectCueIds(state).join(', ') || '—'}
        </p>
      </aside>

      <section className="min-w-0">
        <h2 className="text-lg font-semibold">
          Reducer snapshot — <code>{fixtureName}</code>
        </h2>
        <p className="text-sm text-neutral-600">
          {fixture.ops.length} ops · {Object.keys(state.nodes).length} nodes · theme{' '}
          <code>{state.theme?.mood ?? 'default'}</code>
        </p>

        <h3 className="mt-4 font-semibold">Entry plan (cued)</h3>
        <p className="text-sm">
          entered: {entryPlan.entered.length} · pending: {entryPlan.pending.length} · pending cues:{' '}
          {entryPlan.pendingCues.join(', ') || '—'}
        </p>
        <pre className="mt-1 max-h-40 overflow-auto rounded-lg border border-neutral-300 bg-neutral-50 p-3 text-xs">
          {JSON.stringify(entryPlan, null, 2)}
        </pre>

        <h3 className="mt-4 font-semibold">serializeBoard()</h3>
        <pre className="mt-1 max-h-52 overflow-auto rounded-lg border border-neutral-300 bg-neutral-50 p-3 text-xs">
          {serializeBoard(state)}
        </pre>

        <h3 className="mt-4 font-semibold">State</h3>
        <pre className="mt-1 max-h-64 overflow-auto rounded-lg border border-neutral-300 bg-neutral-50 p-3 text-xs">
          {snapshot}
        </pre>

        <h3 className="mt-4 font-semibold">Capabilities</h3>
        <p className="text-xs">
          <code>{getCapabilities(registry).join(', ')}</code>
        </p>
      </section>

      <aside aria-label="M2 checklist and logs">
        <h2 className="text-lg font-semibold">Prompt guide</h2>
        <label className="mt-1 block text-sm">
          <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} /> compact
        </label>
        <label className="mt-1 block text-sm">
          language{' '}
          <input
            className="w-24 rounded border border-neutral-300 px-1"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="e.g. sw"
          />
        </label>
        <pre className="mt-2 max-h-72 overflow-auto rounded-lg border border-neutral-300 bg-neutral-50 p-2 text-[10px]">
          {guide}
        </pre>

        <h2 className="mt-4 text-lg font-semibold">Logs</h2>
        <p className="text-xs">cues: {cues.join(', ') || '—'}</p>
        <p className="text-xs">enters: {enter.join(', ') || '—'}</p>
        <p className="text-xs">themes: {themes.join(', ') || '—'}</p>
        <p className="text-xs">events: {events.length ? events.join(' · ') : '—'}</p>
        <p className="text-xs text-red-700">errors: {errors.length ? errors.join(' · ') : '—'}</p>

        <h2 className="mt-4 text-lg font-semibold">Acceptance checklist</h2>
        <ul className="mt-1 space-y-1 text-sm">
          <li>✅ reducer: append/attach/replace/update/remove + bounded history/back</li>
          <li>✅ cue engine: cue/after/event/flush/seek; cycle → warning + start</li>
          <li>✅ theme resolver: policy, mood, tokens, contrast guardrail, detour scope</li>
          <li>✅ <code>getSystemPromptGuide()</code> is registry-aware and compactable</li>
          <li>✅ <code>serializeBoard()</code> reports nodes, detours, theme and history</li>
          <li>✅ <code>getCapabilities()</code> lists registered types/effects/presets</li>
          <li className="text-neutral-600">
            Tests: <code>tests/core/*.test.ts</code>, <code>tests/theme/*</code>, snapshots in{' '}
            <code>tests/core/__snapshots__</code>
          </li>
        </ul>
      </aside>
    </main>
  );
}
