// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
import { DreamerProvider } from '../../packages/dreamer-genui/src/react/provider';
import { Board } from '../../packages/dreamer-genui/src/react/board';
import { createBoardStore } from '../../packages/dreamer-genui/src/react/use-board';
import { createRegistry } from '../../packages/dreamer-genui/src/core/registry';
import { COMPONENT_REGISTRY } from '../../packages/dreamer-genui/src/react/anatomy-meta';
import { partProps } from '../../packages/dreamer-genui/src/react/anatomy';
import type { Reply } from '../../packages/dreamer-genui/src/schema/envelope';

afterEach(cleanup);

const fixture = (name: string): Reply => JSON.parse(readFileSync(join(process.cwd(), 'fixtures', name), 'utf8')) as Reply;

const ALL_BLOCKS: Reply = {
  v: 1,
  ops: [
    {
      op: 'append',
      blocks: [
        { id: 'intro', type: 'text', variant: 'body', content: ['A short introduction.'] },
        {
          id: 'pick',
          type: 'choices',
          intent: 'navigate',
          layout: 'chips',
          items: [{ id: 'a', label: 'Choice A', caption: 'First', icon: 'leaf', ref: 'pick/a' }],
        },
        { id: 'note', type: 'callout', tone: 'info', title: 'Key point', content: ['Remember this.'] },
        {
          id: 'how',
          type: 'steps',
          reveal: 'all',
          items: [{ id: 'one', title: 'Step one', content: ['Do the first thing.'] }],
        },
        {
          id: 'items',
          type: 'list',
          style: 'check',
          items: [{ id: 'i1', content: ['First item'] }],
        },
        {
          id: 'box',
          type: 'group',
          layout: 'stack',
          blocks: [{ id: 'inner', type: 'text', variant: 'note', content: ['Nested note.'] }],
        },
      ],
    },
  ],
};

function setup(reply: Reply = ALL_BLOCKS, props: { components?: Record<string, (p: never) => ReactNode>; partClassNames?: never; partStyles?: never } = {}) {
  const registry = createRegistry();
  const store = createBoardStore();
  store.applyFinal(reply);
  return render(
    <DreamerProvider registry={registry} components={props.components as never}>
      <Board store={store} partClassNames={props.partClassNames} partStyles={props.partStyles} />
    </DreamerProvider>,
  );
}

describe('component anatomy (§8.5)', () => {
  test('every registry entry is complete and self-consistent', () => {
    const names = Object.keys(COMPONENT_REGISTRY);
    expect(names.length).toBeGreaterThanOrEqual(11);
    for (const name of names) {
      const meta = COMPONENT_REGISTRY[name]!;
      expect(meta.name, `${name} meta.name`).toBe(name);
      expect(meta.parts.length, `${name} parts`).toBeGreaterThan(0);
      expect(new Set(meta.parts).size, `${name} duplicate parts`).toBe(meta.parts.length);
      expect(Array.isArray(meta.tokens), `${name} tokens`).toBe(true);
      expect(Array.isArray(meta.variants), `${name} variants`).toBe(true);
      expect(Array.isArray(meta.dataAttrs), `${name} dataAttrs`).toBe(true);
      expect(Array.isArray(meta.events), `${name} events`).toBe(true);
      expect(Array.isArray(meta.effects), `${name} effects`).toBe(true);
    }
  });

  test('partProps emits the stable class and merges host class/style last', () => {
    const props = partProps('callout', 'root', { root: 'host-class' }, { root: { color: 'red' } }, 'dg-callout');

    expect(props['data-dg-part']).toBe('root');
    expect(props.className).toBe('dg-callout-root dg-callout host-class');
    expect(props.style).toEqual({ color: 'red' });
  });

  test('a plain board exposes the documented board, layout and node parts', () => {
    const { container } = setup();

    const board = container.querySelector('.dg-board-root');
    expect(board).toHaveAttribute('data-dg-part', 'root');
    expect(board).toHaveClass('dg-board');
    expect(container.querySelector('.dg-board-camera')).toHaveAttribute('data-dg-part', 'camera');
    expect(container.querySelector('.dg-board-content')).toHaveAttribute('data-dg-part', 'content');
    expect(container.querySelector('.dg-live-region')).toHaveAttribute('data-dg-part', 'live-region');

    expect(container.querySelector('.dg-node-root')).toHaveAttribute('data-dg-part', 'root');
    expect(container.querySelector('.dg-node-inner')).toHaveAttribute('data-dg-part', 'inner');
  });

  test('every rendered data-dg-part belongs to a documented component', () => {
    setup();
    const documented = new Set(Object.values(COMPONENT_REGISTRY).flatMap(meta => meta.parts));
    const rendered = Array.from(document.querySelectorAll('[data-dg-part]'));
    expect(rendered.length).toBeGreaterThan(0);
    for (const el of rendered) {
      expect(documented, `unknown part "${el.getAttribute('data-dg-part')}"`).toContain(el.getAttribute('data-dg-part'));
    }
  });

  test('blocks expose their documented parts and stable classes', () => {
    setup();

    const text = document.querySelector('.dg-text-root');
    expect(text).toHaveClass('dg-text', 'dg-text-body');
    expect(text).toHaveAttribute('data-dg-part', 'root');

    const choices = document.querySelector('.dg-choices-root')!;
    expect(choices).toHaveAttribute('data-dg-part', 'root');
    expect(choices.querySelector('.dg-choices-prompt')).toBeNull();
    expect(choices.querySelector('.dg-choices-item')).toHaveAttribute('data-dg-part', 'item');
    expect(choices.querySelector('.dg-choices-item-label')).toHaveAttribute('data-dg-part', 'item-label');
    expect(choices.querySelector('.dg-choices-item-icon')).toHaveAttribute('data-dg-part', 'item-icon');
    expect(choices.querySelector('.dg-choices-item-caption')).toHaveAttribute('data-dg-part', 'item-caption');

    const callout = document.querySelector('.dg-callout-root')!;
    expect(callout).toHaveClass('dg-callout', 'dg-callout-info');
    expect(callout.querySelector('.dg-callout-title')).toHaveAttribute('data-dg-part', 'title');
    expect(callout.querySelector('.dg-callout-content')).toHaveAttribute('data-dg-part', 'content');

    const steps = document.querySelector('.dg-steps-root')!;
    expect(steps.querySelector('.dg-steps-item')).toHaveAttribute('data-dg-part', 'item');
    expect(steps.querySelector('.dg-steps-number')).toHaveAttribute('data-dg-part', 'number');
    expect(steps.querySelector('.dg-steps-title')).toHaveAttribute('data-dg-part', 'title');
    expect(steps.querySelector('.dg-steps-content')).toHaveAttribute('data-dg-part', 'content');

    const list = document.querySelector('.dg-list-root')!;
    expect(list.querySelector('.dg-list-item')).toHaveAttribute('data-dg-part', 'item');
    expect(list.querySelector('.dg-list-marker')).toHaveAttribute('data-dg-part', 'marker');
    expect(list.querySelector('.dg-list-content')).toHaveAttribute('data-dg-part', 'content');

    const group = document.querySelector('.dg-group-root');
    expect(group).toHaveClass('dg-group', 'dg-group-stack');
    expect(group).toHaveAttribute('data-dg-part', 'root');
  });

  test('layout regions and ambience expose their parts', () => {
    const { container } = setup(fixture('theme-mood-shift.json'));
    expect(container.querySelector('.dg-ambience-root')).toHaveAttribute('data-dg-part', 'root');
    expect(container.querySelector('.dg-ambience-layer')).toHaveAttribute('data-dg-part', 'layer');
    // Mood shifts render as text blocks; the default layout is flow, so there
    // are no region wrappers — the flat DOM contract is preserved.
    expect(container.querySelector('.dg-board-content')?.children.length).toBeGreaterThan(0);
  });

  test('detour exposes its parts', () => {
    const base = fixture('define-term.json');
    const attach = fixture('attach-explainer.json');
    const { container } = setup({ v: 1, ops: [...base.ops, ...attach.ops] });
    expect(container.querySelector('.dg-detour-root')).toHaveAttribute('data-dg-part', 'root');
    expect(container.querySelector('.dg-detour-blocks')).toHaveAttribute('data-dg-part', 'blocks');
    expect(container.querySelector('.dg-detour-return')).toHaveAttribute('data-dg-part', 'return');
    expect(container.querySelector('.dg-detour-return-icon')).toHaveAttribute('data-dg-part', 'return-icon');
  });

  test('a component override replaces the default and can call renderDefault', () => {
    const calls = vi.fn();
    setup(ALL_BLOCKS, {
      components: {
        text: (({ renderDefault }: { renderDefault: () => ReactNode }) => {
          calls();
          return <div data-testid="custom-text">{renderDefault()}</div>;
        }) as never,
      },
    });

    expect(screen.getAllByTestId('custom-text').length).toBeGreaterThan(0);
    expect(calls).toHaveBeenCalled();
    expect(screen.getAllByTestId('custom-text')[0]).toHaveTextContent('A short introduction.');
  });

  test('partClassNames and partStyles are applied per part', () => {
    const { container } = setup(ALL_BLOCKS, {
      partClassNames: {
        board: { root: 'host-board', skip: 'host-skip' },
        text: { root: 'host-text' },
        callout: { root: 'host-callout' },
      } as never,
      partStyles: {
        callout: { root: { color: 'rgb(1, 2, 3)' } },
      } as never,
    });

    expect(container.querySelector('.dg-board-root')).toHaveClass('host-board');
    expect(container.querySelector('.dg-text-root')).toHaveClass('host-text');
    const callout = container.querySelector('.dg-callout-root');
    expect(callout).toHaveClass('host-callout');
    expect(callout).toHaveStyle({ color: 'rgb(1, 2, 3)' });
  });
});
