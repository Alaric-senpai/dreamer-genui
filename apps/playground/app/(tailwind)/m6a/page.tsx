'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Board,
  DreamerProvider,
  createBoardStore,
  useBoardVersion,
  type Reply,
  type UIEvent,
} from 'dreamer-genui';
import { createRegistry, getSystemPromptGuide, type LibraryError } from 'dreamer-genui/core';
import mathChem from '../../../../../fixtures/math-chem.json';
import mathInline from '../../../../../fixtures/math-inline.json';
import tableBasic from '../../../../../fixtures/table-basic.json';
import codeBasic from '../../../../../fixtures/code-basic.json';
import chartBar from '../../../../../fixtures/chart-bar.json';
import lottieBasic from '../../../../../fixtures/lottie-basic.json';

const SOURCES = [
  {
    id: 'math',
    label: 'math-chem.json — math block (KaTeX + mhchem)',
    reply: mathChem as Reply,
  },
  {
    id: 'inline-math',
    label: 'math-inline.json — inline math mark',
    reply: mathInline as Reply,
  },
  { id: 'table', label: 'table-basic.json — table block', reply: tableBasic as Reply },
  { id: 'code', label: 'code-basic.json — code block (highlight.js)', reply: codeBasic as Reply },
  { id: 'chart', label: 'chart-bar.json — chart figure', reply: chartBar as Reply },
  { id: 'lottie', label: 'lottie-basic.json — lottie figure', reply: lottieBasic as Reply },
] as const;

type SourceId = (typeof SOURCES)[number]['id'];

const MODES = [
  { id: 'all', label: 'all content plugins enabled', disables: [] as string[] },
  { id: 'no-math', label: 'math disabled', disables: ['math'] },
  { id: 'no-table', label: 'table disabled', disables: ['table'] },
  { id: 'no-code', label: 'code disabled', disables: ['code'] },
] as const;

type ModeId = (typeof MODES)[number]['id'];

const DENSITIES = ['compact', 'comfortable', 'large'] as const;
type Density = (typeof DENSITIES)[number];

const CHECKLIST = [
  'math block renders KaTeX (trust:false) and mhchem \\ce{} equations',
  'inline math mark renders in flowing text without breaking line height',
  'table renders semantic thead/tbody, row+column highlight, focusable cells emit focus',
  'code renders highlight.js tokens with a language label, lazily loaded',
  'chart and lottie figures render from their fixtures',
  'disabling a built-in removes it from the prompt guide (inspector, left)',
  'disabling a built-in turns its op into an unknown-type error with a graceful board',
  'math/code/table register as their own default plugins (registry inspector, left)',
  'KaTeX, highlight.js and chart/lottie runtimes stay out of the initial bundle',
] as const;

const TEST_LINKS = [
  'tests/react/content-builtins.test.tsx',
  'tests/core/conformance.test.ts',
  'tests/schema/fixtures.test.ts',
] as const;

export default function M6aPage() {
  const [source, setSource] = useState<SourceId>('math');
  const [mode, setMode] = useState<ModeId>('all');
  const [mood, setMood] = useState('default');
  const [density, setDensity] = useState<Density>('comfortable');
  const [events, setEvents] = useState<UIEvent[]>([]);
  const [errors, setErrors] = useState<LibraryError[]>([]);

  const registry = useMemo(() => {
    const next = createRegistry();
    const disabled = MODES.find((candidate) => candidate.id === mode)?.disables ?? [];
    for (const name of disabled) next.disable(name);
    return next;
  }, [mode]);

  const store = useMemo(() => createBoardStore({ registry }), [registry]);
  const version = useBoardVersion(store);

  const moodNames = useMemo(
    () =>
      registry
        .list('moods')
        .filter((entry) => !entry.disabled)
        .map((entry) => entry.name),
    [registry],
  );

  const promptGuide = useMemo(() => getSystemPromptGuide(registry), [registry]);
  const registeredBlocks = useMemo(
    () =>
      registry
        .list('blocks')
        .filter((entry) => !entry.disabled)
        .map((entry) => `${entry.name} (${entry.plugin})`),
    [registry],
  );

  useEffect(() => {
    const reply = SOURCES.find((candidate) => candidate.id === source)?.reply;
    setEvents([]);
    setErrors([]);
    store.reset();
    if (reply) store.applyFinal(reply);
    if (mood !== 'default') {
      store.applyFinal({ v: 1, ops: [{ op: 'theme', theme: { mood } }] });
    }
  }, [store, source, mood]);

  const state = store.getState();
  void version;

  return (
    <DreamerProvider
      registry={registry}
      density={density}
      colorScheme="light"
      resolveAsset={(id) =>
        id === 'wave-animation-v1' ? '/lottie/wave.json' : undefined
      }
      onEvent={(event) => setEvents((current) => [event, ...current].slice(0, 40))}
      onError={(error) => setErrors((current) => [error, ...current].slice(0, 20))}
    >
      <main className="grid min-h-screen gap-4 p-4 lg:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)_320px]">
        <aside aria-label="M6a controls" className="space-y-4 text-sm">
          <div>
            <Link href="/" className="text-sky-700 underline">
              ← playground index
            </Link>
            <h1 className="mt-2 text-xl font-semibold">M6a — Content built-ins</h1>
            <p className="text-neutral-600">
              Math, code, table, chart and lottie ship as lazy default plugins built only with the
              public plugin SDK.
            </p>
          </div>

          <fieldset className="space-y-1 rounded border border-neutral-300 p-2">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Fixture
            </legend>
            <select
              aria-label="content fixture"
              className="w-full rounded border px-2 py-1"
              value={source}
              onChange={(event) => setSource(event.target.value as SourceId)}
            >
              {SOURCES.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="mt-1 rounded border px-2 py-1"
              onClick={() => {
                const reply = SOURCES.find((candidate) => candidate.id === source)?.reply;
                setEvents([]);
                setErrors([]);
                store.reset();
                if (reply) store.applyFinal(reply);
                if (mood !== 'default') {
                  store.applyFinal({ v: 1, ops: [{ op: 'theme', theme: { mood } }] });
                }
              }}
            >
              replay demo
            </button>
          </fieldset>

          <fieldset className="space-y-1 rounded border border-neutral-300 p-2">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Plugin state
            </legend>
            <select
              aria-label="plugin mode"
              className="w-full rounded border px-2 py-1"
              value={mode}
              onChange={(event) => setMode(event.target.value as ModeId)}
            >
              {MODES.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-neutral-600">
              Disabling a plugin drops its op with <code>unknown-type</code>; the rest of the board
              still renders.
            </p>
          </fieldset>

          <fieldset className="space-y-1 rounded border border-neutral-300 p-2">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Board settings
            </legend>
            <label className="flex items-center justify-between gap-2">
              <span>mood</span>
              <select
                aria-label="mood"
                className="rounded border px-2 py-1"
                value={mood}
                onChange={(event) => setMood(event.target.value)}
              >
                <option value="default">default</option>
                {moodNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center justify-between gap-2">
              <span>density</span>
              <select
                aria-label="density"
                className="rounded border px-2 py-1"
                value={density}
                onChange={(event) => setDensity(event.target.value as Density)}
              >
                {DENSITIES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>

          <section aria-label="Prompt guide inspector" className="rounded border border-neutral-300 p-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Prompt guide
            </h2>
            <ul className="mt-1 space-y-0.5 text-xs text-neutral-700">
              {['math', 'table', 'code'].map((name) => (
                <li key={name}>
                  <code>{name}</code>: {promptGuide.includes(`${name} block`) ? 'advertised' : 'absent'}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[11px] leading-snug text-neutral-500">
              Registered blocks: {registeredBlocks.join(', ')}
            </p>
          </section>

          <section aria-label="M6a acceptance checklist">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Acceptance checklist
            </h2>
            <ul className="list-disc pl-4 text-xs text-neutral-700">
              {CHECKLIST.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] leading-snug text-neutral-500">
              Tests: {TEST_LINKS.join(' · ')}
            </p>
          </section>

          <p aria-label="board stats" className="text-xs text-neutral-600">
            nodes: {state.nodes.length} · title: {state.title ?? '—'} · theme:{' '}
            {state.theme?.mood ?? 'default'}
          </p>
        </aside>

        <div className="min-w-0">
          <Board
            store={store}
            pacing="auto"
            camera="off"
            ambience="off"
            classNames={{ root: 'rounded-2xl ring-2 ring-sky-400/50 h-full', content: 'w-full' }}
          />
        </div>

        <aside
          aria-label="M6a logs"
          className="space-y-2 text-sm lg:col-span-2 2xl:col-span-1"
        >
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Events
            </h2>
            <ul className="max-h-64 overflow-auto rounded border border-neutral-200 p-2 text-xs">
              {events.length === 0 ? (
                <li className="text-neutral-500">No events yet.</li>
              ) : (
                events.map((event, index) => (
                  <li key={`${event.type}-${index}`} className="truncate">
                    <code>{JSON.stringify(event)}</code>
                  </li>
                ))
              )}
            </ul>
          </section>
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Errors
            </h2>
            <ul className="max-h-48 overflow-auto rounded border border-neutral-200 p-2 text-xs">
              {errors.length === 0 ? (
                <li className="text-neutral-500">No errors.</li>
              ) : (
                errors.map((error, index) => (
                  <li key={`${error.code}-${index}`} className="truncate">
                    <code className="text-red-700">
                      {error.code}
                      {error.nodeId ? ` · ${error.nodeId}` : ''}
                    </code>
                  </li>
                ))
              )}
            </ul>
          </section>
        </aside>
      </main>
    </DreamerProvider>
  );
}
