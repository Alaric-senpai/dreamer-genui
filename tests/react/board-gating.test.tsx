// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { afterEach } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { DreamerProvider } from '../../packages/dreamer-genui/src/react/provider';
import { Board } from '../../packages/dreamer-genui/src/react/board';
import { createBoardStore, type BoardStore } from '../../packages/dreamer-genui/src/react/use-board';
import { createRegistry } from '../../packages/dreamer-genui/src/core/registry';
import type { ReplyLike } from '../../packages/dreamer-genui/src/core/resolver';

afterEach(cleanup);

function text(id: string, trigger?: unknown): Record<string, unknown> {
  return { id, type: 'text', variant: 'body', content: [id], ...(trigger !== undefined ? { enter: trigger } : {}) };
}

function cuedReply(): ReplyLike {
  return {
    v: 1,
    ops: [
      { op: 'append', blocks: [text('opening')] },
      { op: 'append', blocks: [text('beat-1', { effect: 'words', trigger: { on: 'cue', id: 'beat-1' } })] },
    ],
  };
}

function setup(reply: ReplyLike = cuedReply(), props?: { pacing?: 'cued' | 'auto' }) {
  const store = createBoardStore({ registry: createRegistry() });
  store.applyFinal(reply);
  const ui = render(
    <DreamerProvider registry={createRegistry()}>
      <Board store={store} {...props} />
    </DreamerProvider>
  );
  const content = ui.container.querySelector('.dgui-board-content') as HTMLElement;
  return { store, content, ...ui };
}

describe('not mounted until triggered (§6.3)', () => {
  test('a cued node is absent from the DOM and accessibility tree until its cue fires', () => {
    const { store, content } = setup();
    expect(within(content).queryByText('beat-1')).toBeNull();
    act(() => store.cue('beat-1'));
    expect(within(content).queryByText('opening')).toBeInTheDocument();
    expect(within(content).queryByText('beat-1')).toBeInTheDocument();
  });

  test('start-trigger nodes mount immediately alongside cued siblings', () => {
    const { content } = setup();
    expect(within(content).queryByText('opening')).toBeInTheDocument();
    expect(within(content).queryByText('beat-1')).toBeNull();
  });

  test('cue fired before arrival: the late node mounts immediately (race, §6.3)', () => {
    const store = createBoardStore({ registry: createRegistry() });
    store.cue('late-beat');
    const ui = render(
      <DreamerProvider registry={createRegistry()}>
        <Board store={store} />
      </DreamerProvider>
    );
    const content = ui.container.querySelector('.dgui-board-content') as HTMLElement;
    act(() => store.applyFinal({
      v: 1,
      ops: [{ op: 'append', blocks: [text('crawler', { effect: 'words', trigger: { on: 'cue', id: 'late-beat' } })] }],
    }));
    expect(within(content).queryByText('crawler')).toBeInTheDocument();
  });

  test('pacing "auto" ignores cue triggers and mounts by order', () => {
    const { content } = setup(cuedReply(), { pacing: 'auto' });
    expect(within(content).queryByText('beat-1')).toBeInTheDocument();
  });

  test('flush mounts everything pending; state shows flushed', () => {
    const { store, content } = setup();
    expect(within(content).queryByText('beat-1')).toBeNull();
    act(() => store.flush());
    expect(within(content).queryByText('beat-1')).toBeInTheDocument();
    expect(store.getState().flushed).toBe(true);
  });

  test('seek fires every cue up to the target', () => {
    const { store, content } = setup({
      v: 1,
      ops: [
        { op: 'append', blocks: [
          text('a', { effect: 'words' as const, trigger: { on: 'cue', id: 'c1' } }),
          text('b', { effect: 'words' as const, trigger: { on: 'cue', id: 'c2' } }),
          text('c', { effect: 'words' as const, trigger: { on: 'cue', id: 'c3' } }),
        ] },
      ],
    });
    act(() => store.seek('c2'));
    expect(within(content).queryByText('a')).toBeInTheDocument();
    expect(within(content).queryByText('b')).toBeInTheDocument();
    expect(within(content).queryByText('c')).toBeNull();
  });

  test('replace unmounts old nodes and mounts the new board; fired cues reset (§6.3)', () => {
    const { store, content } = setup();
    act(() => store.cue('beat-1'));
    expect(within(content).queryByText('beat-1')).toBeInTheDocument();
    act(() =>
      store.applyFinal({
        v: 1,
        ops: [{ op: 'replace', title: 'Next', blocks: [text('fresh')] }],
      })
    );
    expect(within(content).queryByText('fresh')).toBeInTheDocument();
    expect(within(content).queryByText('opening')).toBeNull();
    expect(within(content).queryByText('beat-1')).toBeNull();
    // reset fired-cue set: a new cued node with the same id stays pending
    act(() =>
      store.applyFinal({
        v: 1,
        ops: [{ op: 'append', blocks: [text('gated', { effect: 'reveal' as const, trigger: { on: 'cue', id: 'beat-1' } })] }],
      })
    );
    expect(within(content).queryByText('gated')).toBeNull();
  });

  test('back() restores the previous board including its fired cues', () => {
    const { store, content } = setup();
    act(() => store.cue('beat-1'));
    act(() =>
      store.applyFinal({
        v: 1,
        ops: [{ op: 'replace', title: 'Next', blocks: [text('fresh')] }],
      })
    );
    expect(within(content).queryByText('beat-1')).toBeNull();
    act(() => store.back());
    expect(within(content).queryByText('beat-1')).toBeInTheDocument();
  });

  test('detour blocks render inline when a detour opens', () => {
    const { store, container } = setup({ v: 1, ops: [{ op: 'append', blocks: [text('target')] }] });
    act(() =>
      store.applyFinal({
        v: 1,
        ops: [{ op: 'attach', to: 'target', blocks: [text('detour-1')] }],
      })
    );
    const detourEl = container.querySelector('.dgui-detour') as HTMLElement;
    expect(detourEl).not.toBeNull();
    expect(within(detourEl).queryByText('detour-1')).toBeInTheDocument();
  });
});

describe('theme on the board root (§6.8 render side)', () => {
  test('a theme op sets --dg-* variables and data-dg-mood on the board section', () => {
    const { store, container } = setup({ v: 1, ops: [{ op: 'append', blocks: [text('plain')] }] });
    const section = () => container.querySelector('section.dgui-board') as HTMLElement;
    const before = section().style.getPropertyValue('--dg-motion-speed');
    act(() =>
      store.applyFinal({
        v: 1,
        ops: [{ op: 'theme', theme: { mood: 'eerie' } }],
      })
    );
    expect(section().getAttribute('data-dg-mood')).toBe('eerie');
    expect(section().style.getPropertyValue('--dg-color-bg')).toBeTruthy();
    const after = section().style.getPropertyValue('--dg-motion-speed');
    expect(after).not.toBe(before); // eerie's tempo landed
  });

  test('no theme op → engine default vars (light) with no mood attribute', () => {
    const { container } = setup({ v: 1, ops: [{ op: 'append', blocks: [text('plain')] }] });
    const section = container.querySelector('section.dgui-board') as HTMLElement;
    expect(section.getAttribute('data-dg-mood')).toBeNull();
    expect(section.style.getPropertyValue('--dg-color-bg')).toBeTruthy();
    expect(section.style.getPropertyValue('--dg-motion-speed')).toBe('1');
  });
});
