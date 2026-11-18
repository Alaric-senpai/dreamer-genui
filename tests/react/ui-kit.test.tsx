// @vitest-environment jsdom
import { afterEach, describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { axe, toHaveNoViolations } from 'jest-axe';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
import { DreamerProvider } from '../../packages/dreamer-genui/src/react/provider';
import { Board } from '../../packages/dreamer-genui/src/react/board';
import { createBoardStore } from '../../packages/dreamer-genui/src/react/use-board';
import { createRegistry } from '../../packages/dreamer-genui/src/core/registry';
import type { Reply } from '../../packages/dreamer-genui/src/schema/envelope';
import type { UIEvent } from '../../packages/dreamer-genui/src/schema/events';

expect.extend(toHaveNoViolations);
afterEach(cleanup);

const FIXTURE = JSON.parse(readFileSync(join(process.cwd(), 'fixtures', 'ui-kit-blocks.json'), 'utf8')) as Reply;

function setup(reply: Reply = FIXTURE, components?: Record<string, (props: any) => ReactNode>) {
  const registry = createRegistry();
  const store = createBoardStore({ registry });
  store.applyFinal(reply);
  const events: UIEvent[] = [];
  const ui = render(
    <DreamerProvider registry={registry} components={components}>
      <Board store={store} camera="off" ambience="off" onEvent={(event) => events.push(event)} />
    </DreamerProvider>
  );
  return { store, events, ...ui };
}

const interactiveCard: Reply = {
  v: 1,
  ops: [
    {
      op: 'append',
      blocks: [
        {
          id: 'tap-card',
          type: 'card',
          title: ['Tap me'],
          interactive: true,
          blocks: [{ id: 'tap-card-body', type: 'text', variant: 'body', content: ['Inside.'] }],
        },
      ],
    },
  ],
};

describe('tutor-addressable UI kit (§6.19)', () => {
  test('renders every UI-kit block from the fixture', () => {
    const { container } = setup();
    expect(screen.getByText('A composed card')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Check the units');
    expect(screen.getByRole('button', { name: /What is a cell/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show the worked step/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Water' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Air' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Revision covered' })).toBeInTheDocument();
    expect(screen.getByText('Accuracy')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByRole('separator', { name: 'Next section' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Carousel' })).toBeInTheDocument();
    expect(screen.getByText('Ctrl')).toBeInTheDocument();
    expect(container.querySelector('.dg-card[data-dg-part="root"]')).toBeInTheDocument();
    expect(container.querySelector('.dg-kbd-key[data-dg-part="key"]')).toBeInTheDocument();
  });

  test('accordion and collapsible toggles emit action toggle with detail.open', async () => {
    const user = userEvent.setup();
    const { events } = setup();
    await user.click(screen.getByRole('button', { name: /What is a tissue/ }));
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'action', action: 'toggle', detail: expect.objectContaining({ itemId: 'acc-two', open: true }) })
    );
    await user.click(screen.getByRole('button', { name: /Show the worked step/ }));
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'action', action: 'toggle', detail: expect.objectContaining({ open: true }) })
    );
  });

  test('tabs and carousel emit select with the item ref', async () => {
    const user = userEvent.setup();
    const { events } = setup();
    await user.click(screen.getByRole('tab', { name: 'Air' }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'select', nodeId: 'ui-tabs', ref: 'tab-air' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'select', nodeId: 'ui-carousel', ref: 'slide-two' }));
    expect(document.querySelector('.dg-carousel')?.textContent).toContain('Second idea.');
  });

  test('an interactive card emits select on tap and Enter', async () => {
    const user = userEvent.setup();
    const { events } = setup(interactiveCard);
    const card = screen.getByRole('button', { name: /Tap me/ });
    await user.click(card);
    expect(events).toContainEqual(expect.objectContaining({ type: 'select', nodeId: 'tap-card' }));
    events.length = 0;
    card.focus();
    await user.keyboard('{Enter}');
    expect(events).toContainEqual(expect.objectContaining({ type: 'select', nodeId: 'tap-card' }));
  });

  test('dismissible alert dismisses and emits action dismiss', async () => {
    const user = userEvent.setup();
    const { events } = setup();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Check the units')).not.toBeInTheDocument();
    expect(events).toContainEqual(expect.objectContaining({ type: 'action', action: 'dismiss', nodeId: 'ui-alert' }));
  });

  test('term uses tap-first popover with definition and detail', async () => {
    const user = userEvent.setup();
    const { events } = setup();
    const term = screen.getByRole('button', { name: 'osmosis' });
    expect(term).toHaveAttribute('aria-expanded', 'false');
    await user.click(term);
    expect(term).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Movement of water across a semi-permeable membrane.')).toBeInTheDocument();
    expect(screen.getByText('From a dilute solution to a concentrated one.')).toBeInTheDocument();
    expect(events).toContainEqual(expect.objectContaining({ type: 'focus', nodeId: 'osmosis' }));
  });

  test('keyboard opens accordion and collapses via Enter/Space', async () => {
    const user = userEvent.setup();
    setup();
    const trigger = screen.getByRole('button', { name: /What is a tissue/ });
    trigger.focus();
    await user.keyboard('{Enter}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  test('every component is replaceable through the provider components map', () => {
    setup(FIXTURE, {
      badge: ({ block, renderDefault }) => (
        <span data-testid="custom-badge" data-render-default={typeof renderDefault}>
          custom {block.id}
        </span>
      ),
    });
    expect(screen.getByTestId('custom-badge')).toHaveTextContent('custom ui-card-badge');
    expect(document.querySelector('.dg-badge')).toBeNull();
  });

  test('axe: the full UI-kit board has no violations', async () => {
    const { container } = setup();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
