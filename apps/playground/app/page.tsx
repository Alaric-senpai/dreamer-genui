'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DreamerProvider, Board, useBoard, type UIEvent, type ThemeName, type Reply } from 'dreamer-genui';
import { createRegistry } from 'dreamer-genui/core';
import type { LibraryError } from 'dreamer-genui/core';

// Fixtures import from the repo's canonical fixtures/ directory (the one the
// test suite uses too — no duplicated copies).
import defineTerm from '../../../fixtures/define-term.json';
import attachExplainer from '../../../fixtures/attach-explainer.json';
import cuedNarration from '../../../fixtures/cued-narration.json';
import themeMoodShift from '../../../fixtures/theme-mood-shift.json';
import replaceWithTheme from '../../../fixtures/replace-with-theme.json';
import cameraMoves from '../../../fixtures/camera-moves.json';
import replaceNewTopic from '../../../fixtures/replace-new-topic.json';
import streamingPartial from '../../../fixtures/streaming-partial.json';
import mathChem from '../../../fixtures/math-chem.json';
import chartBar from '../../../fixtures/chart-bar.json';
import invalidDuplicate from '../../../fixtures/invalid-duplicate-id.json';
import invalidUnknownType from '../../../fixtures/invalid-unknown-type.json';
import invalidDepth from '../../../fixtures/invalid-depth-exceeded.json';
import invalidCueCycle from '../../../fixtures/invalid-cue-cycle.json';
import invalidDisallowedMood from '../../../fixtures/invalid-disallowed-mood.json';
import invalidUnreadablePalette from '../../../fixtures/invalid-unreadable-palette.json';

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

const registry = createRegistry();

export default function Home() {
  const [fixtureName, setFixtureName] = useState<string>('define-term');
  const [theme, setTheme] = useState<ThemeName>('light');
  const [events, setEvents] = useState<UIEvent[]>([]);
  const [errors, setErrors] = useState<LibraryError[]>([]);
  const board = useBoard();
  const loadedRef = useRef(false);

  // Initial load: render define-term with zero clicks (idempotent across StrictMode).
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    board.reset();
    board.applyFinal(FIXTURES['define-term']);
  }, [board]);

  function loadFixture(name: string): void {
    setFixtureName(name);
    setEvents([]);
    setErrors([]);
    board.reset();
    board.applyFinal(FIXTURES[name]);
    console.log(events)
    // console.log(board)
  }

  const stats = useMemo(
    () => ({
      nodes: Object.keys(board.getState().nodes).length,
      detours: board.getState().detours.length,
      history: board.getState().history.length,
    }),
    [board]
  );

  return (
    <DreamerProvider
      registry={registry}
      theme={theme}
      onEvent={(e) => setEvents((prev) => [...prev, e])}
      onError={(err) => setErrors((prev) => [...prev, err])}
    >
      <main style={{ display: 'grid', gridTemplateColumns: '260px 1fr 280px', gap: 16, padding: 16, minHeight: '100vh' }}>
        {/* Left: fixture picker + theme switcher */}
        <aside>
          <h1>dreamer-genui playground</h1>
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
            <legend>Theme</legend>
            {(['light', 'dark'] as ThemeName[]).map((t) => (
              <label key={t} style={{ display: 'block' }}>
                <input type="radio" name="theme" checked={theme === t} onChange={() => setTheme(t)} /> {t}
              </label>
            ))}
          </fieldset>
          <p aria-label="board stats">
            nodes: {stats.nodes} · detours: {stats.detours} · history: {stats.history}
          </p>
        </aside>

        {/* Center: the blackboard */}
        <div style={{ position: 'relative', minHeight: '70vh' }}>
          <Board store={board} />
        </div>

        {/* Right: event + error logs */}
        <aside>
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
