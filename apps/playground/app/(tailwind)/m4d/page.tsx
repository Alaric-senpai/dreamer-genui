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
  type ThemeSpec,
} from 'dreamer-genui';
import { createRegistry } from 'dreamer-genui/core';
import type { LibraryError } from 'dreamer-genui/core';

import kitFixture from '../../../../../fixtures/ui-kit-blocks.json';

const registry = createRegistry();

const kitReply = kitFixture as unknown as Reply;

/** A minimal reply used with the mood switcher: same kit, re-themed live. */
const THEMES: { id: string; label: string; theme: ThemeSpec }[] = [
  { id: 'default', label: 'default', theme: {} },
  { id: 'paper', label: 'paper (light)', theme: { mood: 'paper' } },
  { id: 'night', label: 'night (dark)', theme: { mood: 'night' } },
  { id: 'playful', label: 'playful', theme: { mood: 'playful' } },
  { id: 'solemn', label: 'solemn', theme: { mood: 'solemn' } },
];

const SOURCES = [
  { id: 'kit', label: 'ui-kit-blocks.json — all 12 blocks', reply: kitReply },
] as const;

type SourceId = (typeof SOURCES)[number]['id'];

const CHECKLIST = [
  'PARITY.md records the full shadcn inventory with board counterparts (tutor/host/board/N/A).',
  'All 12 tutor-addressable blocks render from ui-kit-blocks.json with enter triggers.',
  'Interactive card / tabs / carousel emit select; accordion / collapsible emit toggle; alert emits dismiss.',
  'The term mark shows its definition on hover, and by tap on touch (tap-first).',
  'Kit blocks are themable: switch moods below and every component re-skins from tokens.',
  'Components are replaceable via components overrides (customization-surface tests pass).',
  'Keyboard, screen-reader and axe checks pass (tests/react/ui-kit, tests/react/host-kit).',
  'Importing one dreamer-genui/ui component pulls in no other (tests/build/tree-shaking).',
  'The ui kit is absent from the core bundle; per-component gzip sizes are recorded in PARITY.md.',
] as const;

export default function M4dPage() {
  const [source, setSource] = useState<SourceId>('kit');
  const [mood, setMood] = useState('default');
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
      if (found?.reply) board.applyFinal(found.reply);
    },
    [board]
  );

  useEffect(() => {
    if (appliedRef.current === board) return;
    appliedRef.current = board;
    const params = new URLSearchParams(window.location.search);
    setNarrow(params.get('narrow') === '1');
    applySource('kit');
  }, [applySource, board]);

  const applyMood = useCallback(
    (next: string) => {
      setMood(next);
      const theme = THEMES.find((candidate) => candidate.id === next)?.theme;
      if (!theme || Object.keys(theme).length === 0) {
        // Reset back to the fixture's own look by replaying the source.
        applySource(source);
        return;
      }
      board.applyFinal({ v: 1, ops: [{ op: 'theme', theme }] } as unknown as Reply);
    },
    [board, applySource, source]
  );

  const state = board.getState();
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
        <aside aria-label="M4d controls" className="space-y-4 text-sm">
          <div>
            <Link href="/" className="text-sky-700 underline">
              ← playground index
            </Link>
            <h1 className="mt-2 text-xl font-semibold">M4d — UI kit (shadcn parity)</h1>
            <p className="text-neutral-600">
              The 12 tutor-addressable kit blocks rendered from the canonical fixture, plus the
              host-only kit behind <code>dreamer-genui/ui</code>.
            </p>
          </div>

          <fieldset className="space-y-1">
            <legend className="font-semibold">Fixture</legend>
            {SOURCES.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => {
                  setSource(candidate.id);
                  applySource(candidate.id);
                }}
                className={`mr-1 rounded border px-2 py-1 ${source === candidate.id ? 'bg-neutral-900 text-white' : ''}`}
              >
                {candidate.label}
              </button>
            ))}
          </fieldset>

          <fieldset className="space-y-1">
            <legend className="font-semibold">Mood (theming demo)</legend>
            {THEMES.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => applyMood(candidate.id)}
                className={`mr-1 mt-1 rounded border px-2 py-1 ${mood === candidate.id ? 'bg-sky-700 text-white' : ''}`}
              >
                {candidate.label}
              </button>
            ))}
          </fieldset>

          <fieldset className="space-y-1">
            <legend className="font-semibold">Board settings</legend>
            <label className="block">
              <input
                type="checkbox"
                checked={narrow}
                onChange={(event) => setNarrow(event.target.checked)}
              />{' '}
              phone-width container
            </label>
            <button
              type="button"
              onClick={() => applySource(source)}
              className="mt-1 rounded border px-2 py-1"
            >
              replay demo
            </button>
          </fieldset>

          <section aria-label="M4d acceptance checklist" className="space-y-1">
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
            Interact: tap tabs and carousel controls, toggle the accordion and collapsible, dismiss
            the alert, tap the interactive card, and hover/tap the highlighted term. Events appear
            in the log.
          </p>
        </div>

        <aside aria-label="M4d logs" className="space-y-2 text-sm lg:col-span-2 2xl:col-span-1">
          <section>
            <h2 className="font-semibold">Events</h2>
            <ul className="max-h-64 overflow-auto">
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
