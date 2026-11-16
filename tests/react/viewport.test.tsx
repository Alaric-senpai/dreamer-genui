// @vitest-environment jsdom
import { afterEach, describe, expect, test } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DreamerProvider } from '../../packages/dreamer-genui/src/react/provider';
import { Board } from '../../packages/dreamer-genui/src/react/board';
import { createBoardStore } from '../../packages/dreamer-genui/src/react/use-board';
import { createRegistry } from '../../packages/dreamer-genui/src/core/registry';
import { serializeBoard } from '../../packages/dreamer-genui/src/core/generators/serialize-board';
import type { ReplyLike } from '../../packages/dreamer-genui/src/core/resolver';

afterEach(cleanup);

function text(id: string): Record<string, unknown> {
  return { id, type: 'text', variant: 'body', content: [id] };
}

function twoBeats(): ReplyLike {
  return { v: 1, ops: [{ op: 'append', blocks: [text('first'), text('second')] }] };
}

function setup(reply: ReplyLike = twoBeats()) {
  const registry = createRegistry();
  const store = createBoardStore({ registry });
  store.applyFinal(reply);
  const view = (visibleNodeIds?: readonly string[]) => (
    <DreamerProvider registry={registry}>
      <Board store={store} camera="off" ambience="off" visibleNodeIds={visibleNodeIds} />
    </DreamerProvider>
  );
  const ui = render(view());
  const content = ui.container.querySelector('.dg-board-content') as HTMLElement;
  return { store, content, ui, view };
}

describe('host render window (§7.6)', () => {
  test('only listed entered nodes render; state and serializeBoard keep every node', () => {
    const { store, content, ui, view } = setup();

    expect(within(content).queryByText('first')).toBeInTheDocument();
    expect(within(content).queryByText('second')).toBeInTheDocument();

    ui.rerender(view(['first']));
    expect(within(content).queryByText('first')).toBeInTheDocument();
    expect(within(content).queryByText('second')).toBeNull();

    ui.rerender(view(['second']));
    expect(within(content).queryByText('second')).toBeInTheDocument();
    expect(within(content).queryByText('first')).toBeNull();

    expect(Object.keys(store.getState().nodes)).toEqual(['first', 'second']);
    const outline = serializeBoard(store.getState());
    expect(outline).toContain('first [text]');
    expect(outline).toContain('second [text]');
  });

  test('hidden nodes are absent from the live region and onEnter notifications', () => {
    const registry = createRegistry();
    const store = createBoardStore({ registry });
    const enters: string[] = [];
    const ui = render(
      <DreamerProvider registry={registry}>
        <Board
          store={store}
          camera="off"
          ambience="off"
          visibleNodeIds={['first']}
          onEnter={(id) => enters.push(id)}
        />
      </DreamerProvider>
    );

    act(() => {
      store.applyFinal(twoBeats());
    });

    const content = ui.container.querySelector('.dg-board-content') as HTMLElement;
    expect(within(screen.getByRole('status')).queryByText('first')).toBeInTheDocument();
    expect(within(screen.getByRole('status')).queryByText('second')).toBeNull();
    expect(enters).toContain('first');
    expect(enters).not.toContain('second');

    ui.rerender(
      <DreamerProvider registry={registry}>
        <Board store={store} camera="off" ambience="off" visibleNodeIds={['second']} onEnter={(id) => enters.push(id)} />
      </DreamerProvider>
    );
    expect(within(content).getByText('second')).toBeInTheDocument();
    expect(within(content).queryByText('first')).toBeNull();
  });

  test('omitting the prop renders every entered node again', () => {
    const { ui, view, content } = setup();
    ui.rerender(view(['first']));
    expect(within(content).queryByText('second')).toBeNull();
    ui.rerender(view());
    expect(within(content).queryByText('first')).toBeInTheDocument();
    expect(within(content).queryByText('second')).toBeInTheDocument();
  });

  test('an open detour keeps its target mounted even outside the window', () => {
    const registry = createRegistry();
    const store = createBoardStore({ registry });
    store.applyFinal({ v: 1, ops: [{ op: 'append', blocks: [text('target'), text('other')] }] });
    const ui = render(
      <DreamerProvider registry={registry}>
        <Board store={store} camera="off" ambience="off" visibleNodeIds={['other']} />
      </DreamerProvider>
    );
    const content = ui.container.querySelector('.dg-board-content') as HTMLElement;
    expect(within(content).queryByText('target')).toBeNull();

    act(() => {
      store.applyFinal({
        v: 1,
        ops: [{ op: 'attach', to: 'target', blocks: [text('explainer')] }],
      });
    });

    expect(within(content).getByText('target')).toBeInTheDocument();
    expect(within(content).getByText('explainer')).toBeInTheDocument();
    expect(within(content).getByText('other')).toBeInTheDocument();
    ui.unmount();
  });
});
