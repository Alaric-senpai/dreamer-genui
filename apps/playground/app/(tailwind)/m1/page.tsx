'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BoardResolver,
  ErrorCodeSchema,
  boardReducer,
  createBoard,
  createRegistry,
  registryToJsonSchema,
  validateOp,
  type LibraryError,
} from 'dreamer-genui/core';
import { ReplySchema, type Reply } from 'dreamer-genui';

import defineTerm from '../../../../../fixtures/define-term.json';
import attachExplainer from '../../../../../fixtures/attach-explainer.json';
import cuedNarration from '../../../../../fixtures/cued-narration.json';
import cueBeforeNode from '../../../../../fixtures/cue-before-node.json';
import replaceNewTopic from '../../../../../fixtures/replace-new-topic.json';
import themeMoodShift from '../../../../../fixtures/theme-mood-shift.json';
import replaceWithTheme from '../../../../../fixtures/replace-with-theme.json';
import cameraMoves from '../../../../../fixtures/camera-moves.json';
import streamingPartial from '../../../../../fixtures/streaming-partial.json';
import invalidDuplicate from '../../../../../fixtures/invalid-duplicate-id.json';
import invalidUnknownType from '../../../../../fixtures/invalid-unknown-type.json';
import invalidDepth from '../../../../../fixtures/invalid-depth-exceeded.json';
import invalidCueCycle from '../../../../../fixtures/invalid-cue-cycle.json';
import invalidDisallowedMood from '../../../../../fixtures/invalid-disallowed-mood.json';
import invalidUnreadablePalette from '../../../../../fixtures/invalid-unreadable-palette.json';

const registry = createRegistry();

const FIXTURES: Record<string, unknown> = {
  'define-term': defineTerm,
  'attach-explainer': attachExplainer,
  'cued-narration': cuedNarration,
  'cue-before-node': cueBeforeNode,
  'replace-new-topic': replaceNewTopic,
  'theme-mood-shift': themeMoodShift,
  'replace-with-theme': replaceWithTheme,
  'camera-moves': cameraMoves,
  'streaming-partial': streamingPartial,
  'invalid-duplicate-id': invalidDuplicate,
  'invalid-unknown-type': invalidUnknownType,
  'invalid-depth-exceeded': invalidDepth,
  'invalid-cue-cycle': invalidCueCycle,
  'invalid-disallowed-mood': invalidDisallowedMood,
  'invalid-unreadable-palette': invalidUnreadablePalette,
};

/** Attach needs a board to attach to; the inspector replays the prerequisite. */
const SCENARIOS: Record<string, string[]> = {
  'attach-explainer': ['define-term', 'attach-explainer'],
};

interface Inspection {
  schema: 'pass' | 'fail';
  semantic: 'pass' | 'warn' | 'fail';
  errors: LibraryError[];
  warnings: LibraryError[];
  nodes: number;
  detours: number;
}

function inspect(selected: string): Inspection {
  const sequence = SCENARIOS[selected] ?? [selected];
  const errors: LibraryError[] = [];
  const warnings: LibraryError[] = [];
  let state = createBoard();

  for (const name of sequence) {
    const parsed = ReplySchema.safeParse(FIXTURES[name]);
    if (!parsed.success) {
      errors.push({ code: 'invalid-node', detail: parsed.error.issues.map((i) => i.message).join('; ') });
      return { schema: 'fail', semantic: 'fail', errors, warnings, nodes: 0, detours: 0 };
    }
    for (const op of parsed.data.ops) {
      const result = validateOp(state, op);
      if (!result.valid) {
        if (result.error) errors.push(result.error);
        return {
          schema: 'pass',
          semantic: 'fail',
          errors,
          warnings: [...warnings, ...(result.warnings ?? [])],
          nodes: Object.keys(state.nodes).length,
          detours: state.detours.length,
        };
      }
      warnings.push(...(result.warnings ?? []));
      state = boardReducer(state, result.op!);
    }
  }

  // Theme policy and contrast live in the resolver, not the reducer.
  const resolver = new BoardResolver({ registry });
  const resolverIssues: LibraryError[] = [];
  resolver.errors.subscribe((err) => resolverIssues.push(err));
  for (const name of sequence) resolver.applyFinal(FIXTURES[name] as Reply);
  for (const issue of resolverIssues) {
    // The resolver surfaces non-fatal warnings on the same bus as errors;
    // cue-cycle stays a warning (§6.3), theme rejections are real failures.
    if (issue.code === 'cue-cycle') warnings.push(issue);
    else errors.push(issue);
  }

  const dedupe = (list: LibraryError[]): LibraryError[] => {
    const seen = new Set<string>();
    return list.filter((item) => {
      const key = `${item.code}:${item.detail ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  return {
    schema: 'pass',
    semantic: errors.length ? 'fail' : warnings.length ? 'warn' : 'pass',
    errors: dedupe(errors),
    warnings: dedupe(warnings),
    nodes: Object.keys(state.nodes).length,
    detours: state.detours.length,
  };
}

const SCHEMA = JSON.stringify(registryToJsonSchema(registry), null, 2);

export default function M1Page() {
  const [selected, setSelected] = useState('define-term');
  const result = useMemo(() => inspect(selected), [selected]);
  const status = (name: string): string => {
    if (name.startsWith('invalid-')) return 'expected failure';
    return 'valid';
  };

  return (
    <main className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
      <aside aria-label="M1 fixture picker">
        <p className="mb-3 text-sm">
          <Link className="underline" href="/">
            ← playground index
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">M1 — Protocol</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Zod schemas, fixture validation, semantic error codes and the registry-aware JSON Schema.
        </p>

        <fieldset className="mt-4">
          <legend className="font-medium">Fixture</legend>
          {Object.keys(FIXTURES).map((name) => (
            <label key={name} className="block text-sm">
              <input
                type="radio"
                name="m1-fixture"
                checked={selected === name}
                onChange={() => setSelected(name)}
              />{' '}
              <code>{name}</code>
            </label>
          ))}
        </fieldset>
      </aside>

      <section className="min-w-0">
        <h2 className="text-lg font-semibold">
          <code>{selected}</code>{' '}
          <span className="text-sm font-normal text-neutral-500">({status(selected)})</span>
        </h2>

        <dl className="mt-3 grid grid-cols-[140px_1fr] gap-1 text-sm">
          <dt>Schema parse</dt>
          <dd className={result.schema === 'pass' ? 'text-emerald-700' : 'text-red-700'}>{result.schema}</dd>
          <dt>Semantic checks</dt>
          <dd className={result.semantic === 'pass' ? 'text-emerald-700' : result.semantic === 'warn' ? 'text-amber-700' : 'text-red-700'}>
            {result.semantic}
          </dd>
          <dt>Nodes / detours</dt>
          <dd>
            {result.nodes} / {result.detours}
          </dd>
        </dl>

        {(result.errors.length > 0 || result.warnings.length > 0) && (
          <div className="mt-4">
            <h3 className="font-semibold">Validation log</h3>
            <ul className="mt-1 space-y-1 text-sm">
              {result.errors.map((error, i) => (
                <li key={`e-${i}`} className="text-red-700">
                  <code>{error.code}</code> {error.detail}
                </li>
              ))}
              {result.warnings.map((warning, i) => (
                <li key={`w-${i}`} className="text-amber-700">
                  <code>{warning.code}</code> {warning.detail}
                </li>
              ))}
            </ul>
          </div>
        )}

        <h3 className="mt-6 font-semibold">Fixture JSON</h3>
        <pre className="mt-1 max-h-80 overflow-auto rounded-lg border border-neutral-300 bg-neutral-50 p-3 text-xs">
          {JSON.stringify(FIXTURES[selected], null, 2)}
        </pre>

        <details className="mt-6">
          <summary className="cursor-pointer font-semibold">Registry-aware JSON Schema</summary>
          <pre className="mt-2 max-h-96 overflow-auto rounded-lg border border-neutral-300 bg-neutral-50 p-3 text-xs">
            {SCHEMA}
          </pre>
        </details>
      </section>

      <aside aria-label="M1 checklist">
        <h2 className="text-lg font-semibold">Acceptance checklist</h2>
        <ul className="mt-2 space-y-2 text-sm">
          <li>✅ Zod envelope + discriminated ops/blocks/marks/figures/events</li>
          <li>✅ Fixtures parse; invalid fixtures fail with the expected code</li>
          <li>✅ Semantic guards: <code>duplicate-id</code>, <code>bad-target</code>, <code>depth-exceeded</code>, <code>invalid-node</code></li>
          <li>✅ <code>cue-cycle</code> is a non-fatal warning and the trigger is rewritten to <code>start</code></li>
          <li>✅ Theme policy rejects unknown moods and unreadable palettes</li>
          <li>✅ Registry-aware JSON Schema exposes registered moods/ambience/effects</li>
          <li className="text-neutral-600">
            Tests: <code>tests/schema/*</code>, <code>tests/core/validator.test.ts</code>,{' '}
            <code>tests/core/json-schema-registry.test.ts</code>
          </li>
        </ul>
        <h2 className="mt-4 text-lg font-semibold">Error codes</h2>
        <ul className="mt-1 space-y-1 text-sm">
          {ErrorCodeSchema.options.map((code) => (
            <li key={code}>
              <code>{code}</code>
            </li>
          ))}
        </ul>
      </aside>
    </main>
  );
}
