// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DreamerProvider } from '../../packages/dreamer-genui/src/react/provider';
import { Board } from '../../packages/dreamer-genui/src/react/board';
import { createBoardStore } from '../../packages/dreamer-genui/src/react/use-board';
import { createRegistry } from '../../packages/dreamer-genui/src/core/registry';
import type { LibraryError } from '../../packages/dreamer-genui/src/core/types';
import { setReducedMotion } from '../setup';

function setup(options: {
  density?: 'compact' | 'comfortable' | 'large';
  dir?: 'ltr' | 'rtl';
  status?: 'idle' | 'thinking' | 'listening' | 'speaking';
  components?: Record<string, (props: Record<string, unknown>) => React.ReactNode>;
} = {}) {
  const registry = createRegistry();
  const store = createBoardStore({ registry });
  const errors: LibraryError[] = [];
  const ui = render(
    <DreamerProvider
      registry={registry}
      density={options.density}
      dir={options.dir}
      components={options.components}
    >
      <Board
        store={store}
        camera="off"
        ambience="off"
        status={options.status}
        onError={(error) => errors.push(error)}
      />
    </DreamerProvider>
  );
  const board = ui.container.querySelector<HTMLElement>('.dg-board');
  if (!board) throw new Error('missing .dg-board');
  return { ...ui, board, store, errors };
}

beforeEach(() => {
  setReducedMotion(false);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  setReducedMotion(false);
  vi.restoreAllMocks();
});

describe('C2b host settings and board states (§6.10, §7.5, §7.11)', () => {
  test('density sets data attribute, min target and the spacing multiplier', () => {
    const { board } = setup({ density: 'large' });
    expect(board).toHaveAttribute('data-dg-density', 'large');
    expect(board.style.getPropertyValue('--dg-min-target')).toBe('56px');
    expect(board.style.getPropertyValue('--dg-density-scale')).toBe('1.18');
  });

  test('comfortable and compact resolve their own minimum targets', () => {
    const compact = setup({ density: 'compact' }).board;
    expect(compact.style.getPropertyValue('--dg-min-target')).toBe('40px');
    cleanup();
    const comfortable = setup({ density: 'comfortable' }).board;
    expect(comfortable.style.getPropertyValue('--dg-min-target')).toBe('44px');
  });

  test('dir=rtl is applied to the board root', () => {
    const { board } = setup({ dir: 'rtl' });
    expect(board).toHaveAttribute('dir', 'rtl');
  });

  test('an idle board shows the empty state', () => {
    setup();
    expect(screen.getByText('Nothing on the board yet.')).toBeInTheDocument();
  });

  test.each([
    ['thinking', 'Thinking…'],
    ['listening', 'Listening…'],
    ['speaking', 'Speaking…'],
  ] as const)('status=%s renders its label and state hook', (status, label) => {
    const { board } = setup({ status });
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(board.querySelector(`.dg-status[data-dg-status='${status}']`)).not.toBeNull();
  });

  test('status=idle renders no indicator', () => {
    const { board } = setup({ status: 'idle' });
    expect(board.querySelector('.dg-status')).toBeNull();
  });

  test('a throwing block is contained by its node boundary and reports invalid-node', async () => {
    const { store, errors, container } = setup({
      components: {
        text: () => {
          throw new Error('boom');
        },
      },
    });
    act(() => {
      store.applyFinal({
        v: 1,
        ops: [
          {
            op: 'append',
            blocks: [{ id: 'explode', type: 'text', variant: 'body', content: ['boom'] }],
          },
        ],
      });
    });

    expect(await screen.findByText('boom')).toBeInTheDocument();
    expect(container.querySelector('.dg-fallback')).not.toBeNull();
    expect(errors.some((error) => error.code === 'invalid-node')).toBe(true);
  });
});
