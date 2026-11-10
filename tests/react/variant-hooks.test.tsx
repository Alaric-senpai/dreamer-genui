// @vitest-environment jsdom
import { describe, expect, test, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DreamerProvider } from '../../packages/dreamer-genui/src/react/provider';
import { Board } from '../../packages/dreamer-genui/src/react/board';
import { createBoardStore } from '../../packages/dreamer-genui/src/react/use-board';
import { createRegistry } from '../../packages/dreamer-genui/src/core/registry';
import type { ReplyLike } from '../../packages/dreamer-genui/src/core/resolver';

afterEach(cleanup);

function setup(reply: ReplyLike) {
  const store = createBoardStore({ registry: createRegistry() });
  store.applyFinal(reply);
  const ui = render(
    <DreamerProvider registry={createRegistry()}>
      <Board store={store} />
    </DreamerProvider>
  );
  return { store, container: ui.container };
}

describe('§7.6 data-* styling hooks (M3e)', () => {
  test('text nodes carry data-dg-variant; hero rides its variant default (slam)', () => {
    const reply: ReplyLike = {
      v: 1,
      ops: [
        {
          op: 'append',
          blocks: [
            { id: 'h1', type: 'text', variant: 'hero', content: ['Big idea'] },
            { id: 'b1', type: 'text', variant: 'body', content: ['Body text'] },
          ],
        },
      ],
    };
    const { container } = setup(reply);
    const hero = container.querySelector('h1[data-node-id="h1"]');
    expect(hero).toHaveAttribute('data-dg-variant', 'hero');
    expect(hero!.className).toContain('dg-text-hero');
    // hero's variant default is a kinetic slam (§9.2) — animated units present
    expect([...(hero!.firstElementChild as HTMLElement).children].some((c) => c.hasAttribute('style'))).toBe(true);
    const body = container.querySelector('p[data-node-id="b1"]');
    expect(body).toHaveAttribute('data-dg-variant', 'body');
  });

  test('node shells carry data-dg-state for host CSS (receding/dimmed is M4 styling)', () => {
    const reply: ReplyLike = {
      v: 1,
      ops: [{ op: 'append', blocks: [{ id: 'n1', type: 'text', variant: 'body', content: ['hello'] }] }],
    };
    const { container } = setup(reply);
    const shell = container.querySelector('[data-node-id="n1"].dg-node');
    expect(shell).toBeInTheDocument();
    expect(shell).toHaveAttribute('data-dg-state', 'complete');
  });
});
