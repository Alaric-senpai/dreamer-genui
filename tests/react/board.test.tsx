// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { afterEach } from 'vitest';
import { useState } from 'react';
import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { DreamerProvider } from '../../packages/dreamer-genui/src/react/provider';
import { Board } from '../../packages/dreamer-genui/src/react/board';
import { createBoardStore } from '../../packages/dreamer-genui/src/react/use-board';
import { createRegistry } from '../../packages/dreamer-genui/src/core/registry';
import { resolveTheme } from '../../packages/dreamer-genui/src/theme/tokens';
import type { Reply } from '../../packages/dreamer-genui/src/schema/envelope';
import type { LibraryError } from '../../packages/dreamer-genui/src/core/types';
import { setReducedMotion } from '../setup';

expect.extend(toHaveNoViolations);
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

const FIXTURE = JSON.parse(
  readFileSync(join(process.cwd(), 'fixtures/define-term.json'), 'utf8')
) as Reply;

function setup(reply: Reply = FIXTURE, onEvent?: (e: unknown) => void) {
  const registry = createRegistry();
  const store = createBoardStore();
  store.applyFinal(reply);
  const ui = render(
    <DreamerProvider registry={registry} onEvent={onEvent}>
      <Board store={store} />
    </DreamerProvider>
  );
  return { store, ...ui };
}

describe('<Board> with define-biology.json', () => {
  test('renders the definition text and the highlighted phrase', () => {
    setup();
    expect(screen.getByRole('region', { name: /blackboard/i })).toBeInTheDocument();
    const para = screen.getByText(/Biology is the study of/i);
    expect(para).toBeInTheDocument();
    const mark = screen.getByText('living things');
    expect(mark).toBeInTheDocument();
    expect(mark).toMatchSnapshot();
  });

  test('renders all three choice buttons with their refs', () => {
    setup();
    expect(screen.getByRole('button', { name: /Botany/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Zoology/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Microbiology/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Botany/i })).toHaveAttribute('data-ref', 'branches/botany');
  });

  test('clicking a choice (intent navigate) emits select with ref and label', async () => {
    const events: unknown[] = [];
    const user = userEvent.setup();
    setup(FIXTURE, (e) => events.push(e));
    await user.click(screen.getByRole('button', { name: /Botany/i }));
    expect(events).toEqual([
      { type: 'select', nodeId: 'branches', ref: 'branches/botany', label: 'Botany' },
    ]);
  });

  test('choices with intent answer emit answer with the item id as value', async () => {
    const events: unknown[] = [];
    const user = userEvent.setup();
    const reply: Reply = {
      v: 1,
      ops: [
        {
          op: 'append',
          blocks: [
            {
              id: 'quiz',
              type: 'choices',
              intent: 'answer',
              layout: 'list',
              items: [{ id: 'a', label: 'Yes' }, { id: 'b', label: 'No' }],
            },
          ],
        },
      ],
    };
    setup(reply, (e) => events.push(e));
    await user.click(screen.getByRole('button', { name: /Yes/i }));
    expect(events).toEqual([{ type: 'answer', nodeId: 'quiz', value: 'a' }]);
  });

  test('keyboard: Tab to a choice and press Enter emits select', async () => {
    const events: unknown[] = [];
    const user = userEvent.setup();
    setup(FIXTURE, (e) => events.push(e));
    await user.tab(); // focus first choice button (marks are not buttons in this fixture)
    await user.keyboard('{Enter}');
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toMatchObject({ type: 'select', ref: 'branches/botany' });
  });

  test('axe: no accessibility violations', async () => {
    const { container } = setup();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('live region announces the last appended node politely', () => {
    setup();
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  test('live region announces a replace even though node count drops', async () => {
    const store = createBoardStore();
    store.applyFinal(FIXTURE);
    const REPLACE = JSON.parse(
      readFileSync(join(process.cwd(), 'fixtures/replace-new-topic.json'), 'utf8')
    ) as Reply;
    render(
      <DreamerProvider registry={createRegistry()}>
        <Board store={store} />
      </DreamerProvider>
    );
    store.applyFinal(REPLACE);
    // The newest node is the steps block — titles and contents are announced.
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('Carbon fixation');
    });
  });
});

describe('reduced motion', () => {
  test('renders all content instantly with no animation wrapper', () => {
    setReducedMotion(true);
    try {
      const { container } = setup();
      // content identical...
      expect(screen.getByText(/Biology is the study of/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Microbiology/i })).toBeInTheDocument();
      // ...and the node wrappers are plain divs — no inline animation styles
      const wrappers = Array.from(container.querySelectorAll('.dgui-node'));
      expect(wrappers).toHaveLength(2);
      for (const el of wrappers) {
        expect(el.getAttribute('style')).toBeNull();
      }
      expect(container.textContent).toContain('living things');
    } finally {
      setReducedMotion(false);
    }
  });
});

describe('errors and fallbacks', () => {
  test('unknown type is rejected end-to-end and reported through onError (default store path)', () => {
    const errors: LibraryError[] = [];
    const store = createBoardStore(); // default resolver — errors must still reach the host
    const reply: Reply = {
      v: 1,
      ops: [{ op: 'append', blocks: [{ id: 'x1', type: 'made-up-widget' } as unknown as never] }],
    };
    const results = store.applyFinal(reply);
    expect(results[0]?.status).toBe('error');
    render(
      <DreamerProvider registry={createRegistry()} onError={(e) => errors.push(e)}>
        <Board store={store} />
      </DreamerProvider>
    );
    expect(errors).toEqual([expect.objectContaining({ code: 'unknown-type', type: 'made-up-widget' })]);
    expect(Object.keys(store.getState().nodes)).toHaveLength(0); // rejected, not rendered
  });

  test('duplicate-id errors reach onError through the default store path', () => {
    const errors: LibraryError[] = [];
    const store = createBoardStore();
    const reply: Reply = {
      v: 1,
      ops: [
        { op: 'append', blocks: [{ id: 'dup', type: 'text', variant: 'body', content: ['one'] }] },
        { op: 'append', blocks: [{ id: 'dup', type: 'text', variant: 'body', content: ['two'] }] },
      ],
    };
    store.applyFinal(reply);
    render(
      <DreamerProvider registry={createRegistry()} onError={(e) => errors.push(e)}>
        <Board store={store} />
      </DreamerProvider>
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((e) => e.code === 'duplicate-id')).toBe(true);
  });
});

describe('themes', () => {
  test('light and dark presets define every token and differ in background', () => {
    const light = resolveTheme('light');
    const dark = resolveTheme('dark');
    for (const key of Object.keys(light)) {
      expect(dark[key]).toBeDefined();
    }
    expect(dark['--dgui-color-bg']).not.toBe(light['--dgui-color-bg']);
  });

  test('DreamerProvider applies theme tokens as CSS variables on its root', () => {
    const registry = createRegistry();
    const { container } = render(
      <DreamerProvider registry={registry} theme="dark">
        <div>child</div>
      </DreamerProvider>
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('data-dreamer-root')).toBe('');
    expect(root.style.getPropertyValue('--dgui-color-bg')).toBe('#0f1115');
  });
});

describe('board store', () => {
  test('subscribers are notified when ops are applied', () => {
    const store = createBoardStore();
    let notified = 0;
    store.subscribe(() => notified++);
    store.applyFinal(FIXTURE);
    expect(notified).toBe(1);
    store.back();
    expect(notified).toBe(2);
  });

  test('clicking a choice fires both provider and board-level sinks', async () => {
    const providerEvents: unknown[] = [];
    const boardEvents: unknown[] = [];
    const user = userEvent.setup();
    const registry = createRegistry();
    const store = createBoardStore();
    store.applyFinal(FIXTURE);
    render(
      <DreamerProvider registry={registry} onEvent={(e) => providerEvents.push(e)}>
        <Board store={store} onEvent={(e) => boardEvents.push(e)} />
      </DreamerProvider>
    );
    await user.click(screen.getByRole('button', { name: /Zoology/i }));
    expect(providerEvents).toEqual([{ type: 'select', nodeId: 'branches', ref: 'branches/zoology', label: 'Zoology' }]);
    expect(boardEvents).toEqual(providerEvents); // both sinks receive the same event
  });

  test('multi-select choices accumulate selections across re-renders', async () => {
    const events: unknown[] = [];
    const user = userEvent.setup();
    const reply: Reply = {
      v: 1,
      ops: [
        {
          op: 'append',
          blocks: [
            {
              id: 'quiz',
              type: 'choices',
              intent: 'answer',
              multi: true,
              layout: 'list',
              items: [{ id: 'a', label: 'Iron' }, { id: 'b', label: 'Oxygen' }, { id: 'c', label: 'Carbon' }],
            },
          ],
        },
      ],
    };
    const registry = createRegistry();
    const store = createBoardStore();
    store.applyFinal(reply);
    // A host that re-renders on every event (like the playground does).
    function Host(): ReactNode {
      const [, force] = useState(0);
      return (
        <DreamerProvider registry={registry} onEvent={() => force((n) => n + 1)}>
          <Board store={store} onEvent={(e) => events.push(e)} />
        </DreamerProvider>
      );
    }
    render(<Host />);
    await user.click(screen.getByRole('button', { name: /Iron/i }));
    await user.click(screen.getByRole('button', { name: /Oxygen/i }));
    await user.click(screen.getByRole('button', { name: /Carbon/i }));
    const answerEvents = events.filter((e) => (e as { type: string }).type === 'answer');
    expect(answerEvents[answerEvents.length - 1]).toEqual({ type: 'answer', nodeId: 'quiz', value: ['a', 'b', 'c'] });
    expect(answerEvents[answerEvents.length - 2]).toEqual({ type: 'answer', nodeId: 'quiz', value: ['a', 'b'] });
  });
});
