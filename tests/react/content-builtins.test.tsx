// @vitest-environment jsdom
import { afterEach, describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { DreamerProvider } from '../../packages/dreamer-genui/src/react/provider';
import { Board } from '../../packages/dreamer-genui/src/react/board';
import { createBoardStore } from '../../packages/dreamer-genui/src/react/use-board';
import { createRegistry } from '../../packages/dreamer-genui/src/core/registry';
import type { Reply } from '../../packages/dreamer-genui/src/schema/envelope';
import type { UIEvent } from '../../packages/dreamer-genui/src/schema/events';

afterEach(() => cleanup());

function fixture(name: string): Reply {
  return JSON.parse(readFileSync(join(process.cwd(), 'fixtures', name), 'utf8')) as Reply;
}

function setup(reply: Reply) {
  const registry = createRegistry();
  const store = createBoardStore({ registry });
  store.applyFinal(reply);
  const events: UIEvent[] = [];
  const errors: unknown[] = [];
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
  return { registry, events, errors, ...ui };
}

describe('M6a content built-ins', () => {
  test('table renders semantic rows, columns and highlights', async () => {
    const { container, events } = setup(fixture('table-basic.json'));
    const table = await waitFor(() => {
      const el = container.querySelector('table.dg-table');
      expect(el).toBeInTheDocument();
      return el as HTMLTableElement;
    });
    expect(table.querySelectorAll('thead th')).toHaveLength(3);
    expect(table.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(table.querySelectorAll('tbody tr[data-dg-highlight="true"]')).toHaveLength(1);

    const cell = table.querySelector('tbody td') as HTMLElement;
    await userEvent.click(cell);
    cell.focus();
    expect(events.some((event) => event.type === 'focus')).toBe(true);
  });

  test('math block renders KaTeX output', async () => {
    const { container, errors } = setup(fixture('math-chem.json'));
    await waitFor(() => {
      expect(container.querySelectorAll('.katex').length).toBeGreaterThan(0);
    }, { timeout: 20000 });
    expect(errors).toHaveLength(0);
  });

  test('code block renders highlighted tokens', async () => {
    const { container, errors } = setup(fixture('code-basic.json'));
    await waitFor(() => {
      expect(container.querySelector('.dg-code .hljs')).toBeInTheDocument();
    }, { timeout: 20000 });
    expect(container.querySelectorAll('.hljs-keyword').length).toBeGreaterThan(0);
    expect(errors).toHaveLength(0);
  });

  test('disabling the math plugin falls back to unknown-type', async () => {
    const registry = createRegistry();
    registry.disable('math');
    const store = createBoardStore({ registry });
    store.applyFinal(fixture('math-chem.json'));
    const errors: unknown[] = [];
    const { container } = render(
      <DreamerProvider registry={registry}>
        <Board store={store} camera="off" ambience="off" onError={(error) => errors.push(error)} />
      </DreamerProvider>,
    );
    // An unknown block type is rejected before it reaches the board, so the
    // board stays empty (never crashes) and the host learns why.
    await waitFor(() => {
      expect(errors).toContainEqual(expect.objectContaining({ code: 'unknown-type' }));
    });
    expect(container.querySelector('.dg-board')).toBeInTheDocument();
  });
});
