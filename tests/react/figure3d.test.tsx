// @vitest-environment jsdom
import { afterEach, describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { DreamerProvider } from '../../packages/dreamer-genui/src/react/provider';
import { Board } from '../../packages/dreamer-genui/src/react/board';
import { createBoardStore } from '../../packages/dreamer-genui/src/react/use-board';
import { createRegistry, type Registry } from '../../packages/dreamer-genui/src/core/registry';
import { createStaticModelConnector } from '../../packages/dreamer-genui/src/connectors';
import type { Reply } from '../../packages/dreamer-genui/src/schema/envelope';
import type { UIEvent } from '../../packages/dreamer-genui/src/schema/events';
import type { LibraryError } from '../../packages/dreamer-genui/src/core/types';
import type { ModelManifest } from '../../packages/dreamer-genui/src/schema/model';

const manifest = JSON.parse(
  readFileSync(join(process.cwd(), 'fixtures/model-manifest.json'), 'utf8'),
) as ModelManifest;

function fixture(name: string): Reply {
  return JSON.parse(readFileSync(join(process.cwd(), 'fixtures', name), 'utf8')) as Reply;
}

function modelReply(model: string, extra: Record<string, unknown> = {}): Reply {
  return {
    v: 1,
    ops: [
      {
        op: 'append',
        blocks: [
          {
            id: 'model',
            type: 'figure',
            figure: {
              kind: 'model3d',
              model,
              view: 'iso',
              controls: 'both',
              alt: `Demo model ${model}.`,
              ...extra,
            },
          },
        ],
      },
    ],
  };
}

function setup(reply: Reply, manifests: Record<string, unknown> = { assembly: manifest }) {
  const registry: Registry = createRegistry();
  const connector = createStaticModelConnector(
    manifests,
    (_modelId, ref) => `https://assets.example/${String(ref)}`,
    { id: 'demo' },
  );
  registry.register('modelConnectors', connector.id, connector);
  const store = createBoardStore({ registry });
  store.applyFinal(reply);
  const events: UIEvent[] = [];
  const errors: LibraryError[] = [];
  const ui = render(
    <DreamerProvider registry={registry}>
      <Board
        store={store}
        camera="off"
        ambience="off"
        onEvent={(event) => events.push(event)}
        onError={(error) => errors.push(error)}
      />
    </DreamerProvider>,
  );
  return { registry, store, events, errors, ...ui };
}

afterEach(cleanup);

describe('M5b model3d runtime', () => {
  test('renders the accessible parts list and emits focus with figureId/partId', async () => {
    const { container, events } = setup(fixture('model3d-basic.json'));
    await waitFor(
      () => expect(container.querySelector('[data-dg-figure="figure3d"]')).toBeInTheDocument(),
      { timeout: 20000 },
    );
    const housing = await screen.findByRole('button', { name: 'Housing' }, { timeout: 20000 });
    await userEvent.click(housing);
    expect(events).toContainEqual({
      type: 'focus',
      nodeId: 'model-basic',
      ref: 'model-basic/housing',
      label: 'Housing',
    });
  });

  test('falls back with model-not-found when no connector serves the model', async () => {
    const { errors } = setup(modelReply('demo:ghost'));
    await waitFor(
      () => expect(errors.some((error) => error.code === 'model-not-found')).toBe(true),
      { timeout: 20000 },
    );
  });

  test('rejects a malformed manifest with connector-error', async () => {
    const broken = JSON.parse(
      readFileSync(join(process.cwd(), 'fixtures/invalid-model-manifest.json'), 'utf8'),
    );
    const { errors } = setup(modelReply('demo:broken-manifest'), { 'broken-manifest': broken });
    await waitFor(
      () => expect(errors.some((error) => error.code === 'connector-error')).toBe(true),
      { timeout: 20000 },
    );
  });

  test('enforces the host model budget before loading assets', async () => {
    const tooBig = JSON.parse(
      readFileSync(join(process.cwd(), 'fixtures/invalid-model-over-budget.json'), 'utf8'),
    );
    const { errors } = setup(modelReply('demo:assembly-over-budget'), {
      'assembly-over-budget': tooBig,
    });
    await waitFor(
      () => expect(errors.some((error) => error.code === 'model-budget-exceeded')).toBe(true),
      { timeout: 20000 },
    );
  });

  test('reports unknown parts but still renders the rest of the figure', async () => {
    const { container, errors } = setup(modelReply('demo:assembly', { highlight: ['ghost'] }));
    await waitFor(
      () => expect(errors.some((error) => error.code === 'unknown-part')).toBe(true),
      { timeout: 20000 },
    );
    expect(container.querySelector('[data-dg-figure="figure3d"]')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Rotor' }, { timeout: 20000 })).toBeInTheDocument();
  });

  test('renders scene3d without any connector', async () => {
    const registry = createRegistry();
    const store = createBoardStore({ registry });
    store.applyFinal(fixture('scene3d-solids.json'));
    const errors: LibraryError[] = [];
    const { container } = render(
      <DreamerProvider registry={registry}>
        <Board
          store={store}
          camera="off"
          ambience="off"
          onError={(error) => errors.push(error)}
        />
      </DreamerProvider>,
    );
    await waitFor(
      () => expect(container.querySelector('[data-dg-figure="figure3d"]')).toBeInTheDocument(),
      { timeout: 20000 },
    );
    expect(await screen.findByRole('button', { name: 'Core' }, { timeout: 20000 })).toBeInTheDocument();
    expect(errors.some((error) => error.code === 'model-not-found')).toBe(false);
  });
});
