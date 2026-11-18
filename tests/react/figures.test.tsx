// @vitest-environment jsdom
import { afterEach, describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { axe, toHaveNoViolations } from 'jest-axe';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { DreamerProvider } from '../../packages/dreamer-genui/src/react/provider';
import { Board } from '../../packages/dreamer-genui/src/react/board';
import { createBoardStore } from '../../packages/dreamer-genui/src/react/use-board';
import { createRegistry } from '../../packages/dreamer-genui/src/core/registry';
import type { Reply } from '../../packages/dreamer-genui/src/schema/envelope';
import type { UIEvent } from '../../packages/dreamer-genui/src/schema/events';
import { setReducedMotion } from '../setup';

expect.extend(toHaveNoViolations);
afterEach(() => {
  cleanup();
  setReducedMotion(false);
});

function fixture(name: string): Reply {
  return JSON.parse(readFileSync(join(process.cwd(), 'fixtures', name), 'utf8')) as Reply;
}

function setup(reply: Reply, opts: { resolveAsset?: (id: string) => string } = {}) {
  const registry = createRegistry();
  const store = createBoardStore({ registry });
  store.applyFinal(reply);
  const events: UIEvent[] = [];
  const errors: unknown[] = [];
  const ui = render(
    <DreamerProvider registry={registry} resolveAsset={opts.resolveAsset}>
      <Board
        store={store}
        camera="off"
        ambience="off"
        onEvent={(event) => events.push(event)}
        onError={(error) => errors.push(error)}
      />
    </DreamerProvider>
  );
  return { store, events, errors, ...ui };
}

describe('M5 figures', () => {
  test('flowchart draws in with nodes, lanes, decision, recycle edge and pulse', async () => {
    const { container } = setup(fixture('process-flowchart.json'));
    const figure = await waitFor(() => {
      const el = container.querySelector('[data-dg-figure="flowchart"]');
      expect(el).toBeInTheDocument();
      return el as HTMLElement;
    });
    expect(figure).toHaveAttribute('aria-label', expect.stringContaining('A flowchart'));
    // stepper mode hides all but the active layer, so query the DOM nodes directly
    expect(figure.querySelectorAll('[data-dg-part="node"]')).toHaveLength(6);
    expect(figure.querySelectorAll('.dg-figure-step-dot')).toHaveLength(6);
    expect(figure.querySelectorAll('[data-dg-part="lane"]')).toHaveLength(2);
    expect(figure.querySelectorAll('[data-dg-part="lane-label"]')).toHaveLength(2);
    expect(figure.querySelector('[data-dg-shape="decision"]')).toBeInTheDocument();
    expect(figure.querySelector('.dg-figure-edge-recycle')).toBeInTheDocument();
    expect(figure.querySelectorAll('.dg-figure-edge-pulse').length).toBeGreaterThan(0);
    expect(figure.querySelector('.dg-figure-stepper')).toBeInTheDocument();
    // Stepper mode is responsive: on a wide board every step stays in the DOM and
    // visible; hiding inactive layers is purely a narrow-container CSS concern.
    expect(figure.querySelector('[data-dg-shape="start"]')).not.toHaveStyle('display: none');
    expect(figure.querySelector('[data-dg-shape="start"]')).toHaveAttribute('data-dg-active', 'true');
    expect(figure.querySelector('[data-dg-shape="end"]')).toHaveAttribute('data-dg-active', 'false');
  });

  test('focusable steps emit focus with ref = nodeId/nodeId', async () => {
    const { container, events } = setup(fixture('process-flowchart.json'));
    const heat = await waitFor(() => container.querySelector('[data-dg-ref="process-map/heat"]') as HTMLElement);
    expect(heat).toBeInTheDocument();
    await userEvent.click(heat);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'focus', nodeId: 'process-map', ref: 'process-map/heat', label: 'Apply heat' })
    );
  });

  test('stepper dots reveal one layer at a time', async () => {
    const { container } = setup(fixture('process-flowchart.json'));
    await waitFor(() => expect(container.querySelector('.dg-figure-stepper')).toBeInTheDocument());
    const dots = container.querySelectorAll('.dg-figure-step-dot');
    expect(dots).toHaveLength(6);
    expect(dots[0]).toHaveAttribute('aria-current', 'step');
    expect(container.querySelector('[data-dg-ref="process-map/intake"]')).toHaveAttribute('data-dg-active', 'true');
    await userEvent.click(dots[2] as HTMLElement);
    expect(dots[2]).toHaveAttribute('aria-current', 'step');
    // Clicking a dot moves the active layer; CSS hides the rest only when narrow.
    expect(container.querySelector('[data-dg-ref="process-map/intake"]')).toHaveAttribute('data-dg-active', 'false');
    expect(container.querySelector('[data-dg-ref="process-map/heat"]')).toHaveAttribute('data-dg-active', 'true');
    expect(container.querySelectorAll('[data-dg-part="node"][data-dg-active="true"]')).toHaveLength(1);
  });

  test.each([
    ['diagram-radial.json', 'diagram', 'kingdoms-diagram'],
    ['timeline.json', 'timeline', 'timeline-steps'],
    ['labeled-art.json', 'labeled', 'cell-figure'],
    ['chart-bar.json', 'chart', 'score-chart'],
  ])('renders %s (%s)', async (file, kind, id) => {
    const { container } = setup(fixture(file));
    const figure = await waitFor(() => {
      const el = container.querySelector(`[data-dg-figure="${kind}"]`);
      expect(el).toBeInTheDocument();
      return el as HTMLElement;
    });
    expect(figure.closest('[data-node-id]')).toHaveAttribute('data-node-id', id);
    expect(figure).toHaveAttribute('aria-label', expect.any(String));
  });

  test('compare block renders a table with columns and a highlighted cell', async () => {
    const { container } = setup(fixture('compare.json'));
    const table = await waitFor(() => {
      const el = container.querySelector('[data-dg-part="root"].dg-compare-root');
      expect(el).toBeInTheDocument();
      return el as HTMLElement;
    });
    expect(table).toHaveAttribute('role', 'table');
    expect(table.querySelector('[data-dg-col="way-b"]')).toBeInTheDocument();
    expect(table.querySelector('[data-dg-highlight="true"]')).toBeInTheDocument();
  });

  test('image resolves {asset} references through the host callback only', async () => {
    const imageReply: Reply = {
      v: 1,
      ops: [{
        op: 'append',
        blocks: [{
          id: 'asset-image',
          type: 'figure',
          figure: { kind: 'image', src: { asset: 'poster-1' }, alt: 'A resolved diagram' },
        }],
      }],
    };
    const { container } = setup(imageReply, { resolveAsset: (id) => `data:image/png;base64,${id}` });
    const img = await waitFor(() => {
      const found = container.querySelector('img[data-dg-part="poster"]') as HTMLImageElement | null;
      expect(found).toBeInTheDocument();
      return found!;
    });
    expect(img).toHaveAttribute('src', 'data:image/png;base64,poster-1');
    expect(img).toHaveAttribute('alt', 'A resolved diagram');
  });

  test('3D kinds fall back to alt until M5b', async () => {
    const reply = {
      v: 1,
      ops: [{
        op: 'append',
        blocks: [{
          id: 'model-figure',
          type: 'figure',
          figure: { kind: 'model3d', model: 'demo:heart', alt: 'An interactive model' },
        }],
      }],
    } as unknown as Reply;
    const { container } = setup(reply);
    await waitFor(() => expect(screen.getByText('An interactive model')).toBeInTheDocument());
    expect(container.querySelector('[data-dg-figure]')).not.toBeInTheDocument();
  });

  test('reduced motion removes stagger delays from figure nodes', async () => {
    setReducedMotion(true);
    const { container } = setup(fixture('process-flowchart.json'));
    const node = await waitFor(() => container.querySelector('[data-dg-part="node"]') as HTMLElement);
    expect(node.style.animationDelay).toBe('');
  });

  test('flowchart has no axe violations', async () => {
    const { container } = setup(fixture('process-flowchart.json'));
    await waitFor(() => expect(container.querySelector('[data-dg-figure="flowchart"]')).toBeInTheDocument());
    expect(await axe(container)).toHaveNoViolations();
  });
});
