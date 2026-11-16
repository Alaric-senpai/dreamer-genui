// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DevtoolsOverlay } from '../../packages/dreamer-genui/src/devtools';
import { createBoardStore } from '../../packages/dreamer-genui/src/react/use-board';
import { createRegistry } from '../../packages/dreamer-genui/src/core/registry';
import type { Reply } from '../../packages/dreamer-genui/src/schema/envelope';

afterEach(cleanup);

const reply: Reply = {
  v: 1,
  ops: [
    {
      op: 'append',
      blocks: [
        { id: 'intro', type: 'text', variant: 'body', content: ['Hello'] },
        {
          id: 'late',
          type: 'text',
          variant: 'body',
          content: ['Later'],
          enter: { effect: 'reveal', trigger: { on: 'cue', id: 'beat' } },
        },
      ],
    },
    { op: 'layout', layout: { kind: 'grid', columns: 2 } },
  ],
};

describe('DevtoolsOverlay', () => {
  test('shows entries, activated cue buttons and registry counts', () => {
    const registry = createRegistry();
    const store = createBoardStore({ registry });
    act(() => store.applyFinal(reply));

    render(<DevtoolsOverlay store={store} registry={registry} defaultOpen />);

    expect(screen.getByRole('complementary', { name: 'dreamer-genui devtools' })).toBeInTheDocument();
    expect(screen.getByText('intro')).toBeInTheDocument();
    expect(screen.getByText('grid')).toBeInTheDocument();
    expect(screen.getByText('beat ▸')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export snapshot' })).toBeInTheDocument();
  });

  test('toggles open and closed, and cue buttons fire cues', () => {
    const store = createBoardStore();
    act(() => store.applyFinal(reply));

    render(<DevtoolsOverlay store={store} />);
    expect(screen.queryByRole('complementary', { name: 'dreamer-genui devtools' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Toggle dreamer-genui devtools' }));
    fireEvent.click(screen.getByRole('button', { name: 'beat ▸' }));
    expect(store.getState().firedCues).toContain('beat');

    fireEvent.click(screen.getByRole('button', { name: 'Close devtools' }));
    expect(screen.queryByRole('complementary', { name: 'dreamer-genui devtools' })).not.toBeInTheDocument();
  });
});
