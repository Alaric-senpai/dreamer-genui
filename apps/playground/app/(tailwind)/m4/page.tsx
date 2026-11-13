'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  DreamerProvider,
  Board,
  useBoard,
  useBoardVersion,
  type UIEvent,
  type Reply,
  type ResolvedTheme,
} from 'dreamer-genui';
import { createRegistry } from 'dreamer-genui/core';
import type { LibraryError } from 'dreamer-genui/core';

// Fixtures import from the repo's canonical fixtures/ directory (the one the
// test suite uses too — no duplicated copies).
import defineTerm from '../../../../../fixtures/define-term.json';
import attachExplainer from '../../../../../fixtures/attach-explainer.json';
import cuedNarration from '../../../../../fixtures/cued-narration.json';
import themeMoodShift from '../../../../../fixtures/theme-mood-shift.json';
import replaceWithTheme from '../../../../../fixtures/replace-with-theme.json';
import cameraMoves from '../../../../../fixtures/camera-moves.json';
import replaceNewTopic from '../../../../../fixtures/replace-new-topic.json';
import streamingPartial from '../../../../../fixtures/streaming-partial.json';
import mathChem from '../../../../../fixtures/math-chem.json';
import chartBar from '../../../../../fixtures/chart-bar.json';
import invalidDuplicate from '../../../../../fixtures/invalid-duplicate-id.json';
import invalidUnknownType from '../../../../../fixtures/invalid-unknown-type.json';
import invalidDepth from '../../../../../fixtures/invalid-depth-exceeded.json';
import invalidCueCycle from '../../../../../fixtures/invalid-cue-cycle.json';
import invalidDisallowedMood from '../../../../../fixtures/invalid-disallowed-mood.json';
import invalidUnreadablePalette from '../../../../../fixtures/invalid-unreadable-palette.json';

const FIXTURES: Record<string, Reply> = {
  'define-term': defineTerm as Reply,
  'attach-explainer': attachExplainer as Reply,
  'cued-narration': cuedNarration as Reply,
  'theme-mood-shift': themeMoodShift as Reply,
  'replace-with-theme': replaceWithTheme as Reply,
  'camera-moves': cameraMoves as Reply,
  'replace-new-topic': replaceNewTopic as Reply,
  'streaming-partial': streamingPartial as Reply,
  'math-chem': mathChem as Reply,
  'chart-bar': chartBar as Reply,
  'invalid-duplicate-id': invalidDuplicate as Reply,
  'invalid-unknown-type': invalidUnknownType as Reply,
  'invalid-depth-exceeded': invalidDepth as Reply,
  'invalid-cue-cycle': invalidCueCycle as Reply,
  'invalid-disallowed-mood': invalidDisallowedMood as Reply,
  'invalid-unreadable-palette': invalidUnreadablePalette as Reply,
};

/** Ambience presets registered by the library — listed for the switcher. */
const AMBIENCE = ['auto', 'lite', 'off'] as const;
const CAMERA = ['auto', 'off'] as const;

const registry = createRegistry();

export default function M4Page() {
  const [fixtureName, setFixtureName] = useState<string>('define-term');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [camera, setCamera] = useState<(typeof CAMERA)[number]>('auto');
  const [ambience, setAmbience] = useState<(typeof AMBIENCE)[number]>('auto');
  const [recede, setRecede] = useState(true);
  const [pacing, setPacing] = useState<'cued' | 'auto'>('cued');
  const [events, setEvents] = useState<UIEvent[]>([]);
  const [errors, setErrors] = useState<LibraryError[]>([]);
  const [cues, setCues] = useState<string[]>([]);
  const [themes, setThemes] = useState<string[]>([]);
  const board = useBoard();
  useBoardVersion(board);
  const loadedRef = useRef(false);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }, []);

  const at = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  // Initial load: render define-term with zero clicks (idempotent across StrictMode).
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    board.reset();
    board.applyFinal(FIXTURES['define-term']);
  }, [board]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const loadFixture = useCallback(
    (name: string) => {
      clearTimers();
      setFixtureName(name);
      setEvents([]);
      setErrors([]);
      setCues([]);
      setThemes([]);
      board.reset();
      board.applyFinal(FIXTURES[name]);
    },
    [board, clearTimers]
  );

  /** M4 attach walkthrough: define a term, then open its explainer. */
  const runAttachDemo = useCallback(() => {
    clearTimers();
    setEvents([]);
    setErrors([]);
    board.reset();
    board.applyFinal(FIXTURES['define-term']);
    at(500, () => board.applyFinal(FIXTURES['attach-explainer']));
    at(2_200, () => document.querySelector<HTMLElement>('.dg-mark-term')?.click());
  }, [at, board, clearTimers]);

  /** M4 streaming walkthrough: apply the partial reply op by op. */
  const runStreamDemo = useCallback(() => {
    clearTimers();
    setEvents([]);
    setErrors([]);
    board.reset();
    const ops = FIXTURES['streaming-partial'].ops;
    ops.forEach((_, i) => {
      at(350 * (i + 1), () => board.applyPartial({ v: 1, ops: ops.slice(0, i + 1) }));
    });
    at(350 * (ops.length + 1), () => board.applyFinal(FIXTURES['streaming-partial']));
  }, [at, board, clearTimers]);

  /** M4 camera walkthrough: push in on the hero, hold, then return to overview. */
  const runCameraDemo = useCallback(() => {
    clearTimers();
    setEvents([]);
    setErrors([]);
    board.reset();
    board.applyFinal(FIXTURES['camera-moves']);
    at(250, () => board.cue('evidence'));
    at(1_600, () => board.applyFinal({ v: 1, ops: [{ op: 'camera', to: 'overview', duration: 900 }] }));
  }, [at, board, clearTimers]);

  /** M4 theme walkthrough: mid-lesson mood + ambience change. */
  const runMoodDemo = useCallback(() => {
    clearTimers();
    setEvents([]);
    setErrors([]);
    board.reset();
    board.applyFinal(FIXTURES['theme-mood-shift']);
  }, [board, clearTimers]);

  useEffect(() => {
    const offCue = board.cueBus.subscribe((id) => setCues((prev) => [...prev, id]));
    const offTheme = board.themeChangeBus.subscribe((resolved: ResolvedTheme) =>
      setThemes((prev) => [...prev, resolved.mood ?? 'custom'])
    );
    return () => {
      offCue();
      offTheme();
    };
  }, [board]);

  const stats = useMemo(
    () => ({
      nodes: Object.keys(board.getState().nodes).length,
      detours: board.getState().detours.length,
      history: board.getState().history.length,
      mood: board.getState().theme?.mood ?? '—',
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [board, board.getVersion()]
  );

  return (
    <DreamerProvider
      registry={registry}
      colorScheme={theme}
      onEvent={(e) => setEvents((prev) => [...prev, e])}
      onError={(err) => setErrors((prev) => [...prev, err])}
    >
      <main className="grid gap-4 p-4 min-h-screen lg:grid-cols-[240px_minmax(0,1fr)] 2xl:grid-cols-[240px_minmax(0,1fr)_320px]">
        {/* Left: fixture picker, board switches and M4 demos */}
        <aside aria-label="playground controls">
          <p className="mb-3 text-sm">
            <Link className="underline" href="/">
              ← playground index
            </Link>
          </p>
          <h1>M4 — board behaviour</h1>
          <p>
            Attach/return, receding, auto-scroll, streaming partials, camera and ambience. Pick a
            fixture, then run the walkthrough that matches the acceptance list.
          </p>

          <section aria-label="M4 acceptance checklist">
            <h2>Acceptance checklist</h2>
            <ul>
              <li>✅ <code>attach-explainer.json</code>: floating spotlight, connector, annotation, Return, focus restore</li>
              <li>✅ <code>theme-mood-shift.json</code>: mid-lesson mood + ambience; detour-scoped theme reverts on return</li>
              <li>✅ <code>camera-moves.json</code>: auto + explicit camera ops, overview return, reduced-motion fallback</li>
              <li>✅ <code>streaming-partial.json</code>: partial reply applies progressively and idempotently</li>
              <li>✅ narrow viewport: floating placements fall back to in-flow <code>below</code></li>
              <li>✅ ambience pauses when hidden; static under reduced motion</li>
              <li>✅ receding marks older scenes; auto-scroll follows the newest node</li>
              <li>✅ <code>replace</code> + <code>back()</code> restores the previous board and its theme</li>
              <li>✅ tests: <code>tests/react/m4-board.test.tsx</code>, <code>m4-ambience.test.tsx</code>, <code>tests/core/m4-engine.test.ts</code></li>
            </ul>
          </section>

          <fieldset>
            <legend>Fixture</legend>
            {Object.keys(FIXTURES).map((name) => (
              <label key={name} style={{ display: 'block' }}>
                <input
                  type="radio"
                  name="fixture"
                  checked={fixtureName === name}
                  onChange={() => loadFixture(name)}
                />{' '}
                {name}
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend>Board</legend>
            <label style={{ display: 'block' }}>
              camera{' '}
              <select value={camera} onChange={(e) => setCamera(e.target.value as (typeof CAMERA)[number])}>
                {CAMERA.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'block' }}>
              ambience{' '}
              <select value={ambience} onChange={(e) => setAmbience(e.target.value as (typeof AMBIENCE)[number])}>
                {AMBIENCE.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'block' }}>
              pacing{' '}
              <select value={pacing} onChange={(e) => setPacing(e.target.value as 'cued' | 'auto')}>
                <option value="cued">cued</option>
                <option value="auto">auto</option>
              </select>
            </label>
            <label style={{ display: 'block' }}>
              <input type="checkbox" checked={recede} onChange={(e) => setRecede(e.target.checked)} /> recede previous scenes
            </label>
          </fieldset>

          <fieldset>
            <legend>M4 walkthroughs</legend>
            <button type="button" onClick={runAttachDemo} style={{ display: 'block', marginBottom: 4 }}>
              attach explainer
            </button>
            <button type="button" onClick={runStreamDemo} style={{ display: 'block', marginBottom: 4 }}>
              stream partial reply
            </button>
            <button type="button" onClick={runCameraDemo} style={{ display: 'block', marginBottom: 4 }}>
              camera push-in / overview
            </button>
            <button type="button" onClick={runMoodDemo} style={{ display: 'block', marginBottom: 4 }}>
              mood + ambience shift
            </button>
            <button type="button" onClick={() => board.back()} style={{ display: 'block', marginBottom: 4 }}>
              back()
            </button>
            <button type="button" onClick={() => board.flush()} style={{ display: 'block', marginBottom: 4 }}>
              flush()
            </button>
            <button type="button" onClick={() => board.reset()} style={{ display: 'block' }}>
              reset()
            </button>
          </fieldset>

          <fieldset>
            <legend>Theme</legend>
            {(['light', 'dark'] as const).map((t) => (
              <label key={t} style={{ display: 'block' }}>
                <input type="radio" name="theme" checked={theme === t} onChange={() => setTheme(t)} /> {t}
              </label>
            ))}
          </fieldset>

          <p aria-label="board stats">
            nodes: {stats.nodes} · detours: {stats.detours} · history: {stats.history} · mood: {stats.mood}
          </p>
        </aside>

        {/* Center: the blackboard. Tailwind classNames here sit OUTSIDE the
         * library's @layer — they win over board defaults (§7.6 slot override). */}
        <div className="relative min-h-dvh min-w-0">
          <Board
            store={board}
            camera={camera}
            ambience={ambience}
            recede={recede}
            pacing={pacing}
            classNames={{ root: 'rounded-2xl ring-2 ring-rose-400/60 h-full', content: 'max-w-3xl' }}
          />
        </div>

        {/* Right: cue, theme, event and error logs */}
        <aside aria-label="playground logs" className="lg:col-span-2 2xl:col-span-1">
          <section aria-label="cue log">
            <h2>Cues</h2>
            <ul>
              {cues.map((cue, i) => (
                <li key={`${cue}-${i}`}>
                  <code>{cue}</code>
                </li>
              ))}
            </ul>
          </section>
          <section aria-label="theme log">
            <h2>Themes</h2>
            <ul>
              {themes.map((mood, i) => (
                <li key={`${mood}-${i}`}>
                  <code>{mood}</code>
                </li>
              ))}
            </ul>
          </section>
          <section aria-label="event log">
            <h2>Events</h2>
            <ul>
              {events.map((e, i) => (
                <li key={i}>
                  <code>{JSON.stringify(e)}</code>
                </li>
              ))}
            </ul>
          </section>
          <section aria-label="error log">
            <h2>Errors</h2>
            <ul>
              {errors.map((err, i) => (
                <li key={i}>
                  <code style={{ color: 'crimson' }}>{JSON.stringify(err)}</code>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </main>
    </DreamerProvider>
  );
}
