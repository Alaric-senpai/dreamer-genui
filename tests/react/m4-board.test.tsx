// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { DreamerProvider } from '../../packages/dreamer-genui/src/react/provider';
import { Board } from '../../packages/dreamer-genui/src/react/board';
import { createBoardStore, type BoardStore } from '../../packages/dreamer-genui/src/react/use-board';
import { createRegistry } from '../../packages/dreamer-genui/src/core/registry';
import type { ReplyLike } from '../../packages/dreamer-genui/src/core/resolver';
import type { UIEvent } from '../../packages/dreamer-genui/src/schema/events';
import type { ResolvedTheme } from '../../packages/dreamer-genui/src/core/theme';
import { setReducedMotion } from '../setup';

function fixture(name: string): ReplyLike {
  return JSON.parse(readFileSync(join(process.cwd(), 'fixtures', name), 'utf8')) as ReplyLike;
}

const DEFINE_TERM = fixture('define-term.json');
const ATTACH_EXPLAINER = fixture('attach-explainer.json');
const THEME_MOOD_SHIFT = fixture('theme-mood-shift.json');
const STREAMING_PARTIAL = fixture('streaming-partial.json');

function text(id: string): Record<string, unknown> {
  return { id, type: 'text', variant: 'body', content: [id] };
}

interface SetupOptions {
  camera?: 'auto' | 'off';
  ambience?: 'auto' | 'off' | 'lite';
  recede?: boolean;
  reply?: ReplyLike;
  onThemeChange?: (theme: ResolvedTheme) => void;
}

function setup(options: SetupOptions = {}) {
  const registry = createRegistry();
  const store = createBoardStore({ registry });
  if (options.reply) store.applyFinal(options.reply);
  const events: UIEvent[] = [];
  const ui = render(
    <DreamerProvider registry={registry}>
      <Board
        store={store}
        camera={options.camera ?? 'off'}
        ambience={options.ambience ?? 'auto'}
        recede={options.recede}
        onEvent={(event) => events.push(event)}
        onThemeChange={options.onThemeChange}
      />
    </DreamerProvider>
  );
  return { store, events, registry, ...ui };
}

function cameraEl(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('.dg-camera');
  if (!el) throw new Error('missing .dg-camera');
  return el;
}

beforeEach(() => {
  setReducedMotion(false);
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  setReducedMotion(false);
  vi.restoreAllMocks();
});

describe('M4 attach end to end (§7.5)', () => {
  test('attach-explainer opens a floating spotlight explainer with return control', async () => {
    const { store, container } = setup({ reply: DEFINE_TERM });
    act(() => {
      store.applyFinal(ATTACH_EXPLAINER);
    });

    const region = await screen.findByRole('region', { name: 'Explainer' });
    expect(within(region).getByText(/Botany is the scientific study of plants/)).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: /Return/ })).toBeInTheDocument();

    expect(container.querySelector('.dg-detour-overlay')?.getAttribute('data-dg-detour-overlay-placement')).toBe('spotlight');
    expect(container.querySelector('.dg-detour-backdrop')).toBeInTheDocument();
    expect(container.querySelector('.dg-board')?.getAttribute('data-dg-detour-open')).toBe('spotlight');
  });

  test('return emits the action event, closes the detour and restores focus to the target item', async () => {
    const user = userEvent.setup();
    const { store, events } = setup({ reply: DEFINE_TERM });
    act(() => {
      store.applyFinal(ATTACH_EXPLAINER);
    });
    const region = await screen.findByRole('region', { name: 'Explainer' });
    await user.click(within(region).getByRole('button', { name: /Return/ }));

    expect(events).toContainEqual({ type: 'action', action: 'return', nodeId: 'branches' });
    expect(screen.queryByRole('region', { name: 'Explainer' })).toBeNull();
    const botany = screen.getByRole('button', { name: /Botany/i });
    await waitFor(() => expect(botany).toHaveFocus());
  });

  test('Escape closes the detour', async () => {
    const { store } = setup({ reply: DEFINE_TERM });
    act(() => {
      store.applyFinal(ATTACH_EXPLAINER);
    });
    const region = await screen.findByRole('region', { name: 'Explainer' });
    await act(async () => {
      region.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Explainer' })).toBeNull());
  });

  test('flow placements render inside the board content, not the floating overlay', async () => {
    const { store, container } = setup({ reply: DEFINE_TERM });
    act(() => {
      store.applyFinal({
        v: 1,
        ops: [{ op: 'attach', to: 'branches', blocks: [{ id: 'flow-note', type: 'text', variant: 'body', content: ['Inline note'] }], placement: 'below' }],
      });
    });
    const region = await screen.findByRole('region', { name: 'Explainer' });
    expect(region.getAttribute('data-dg-placement')).toBe('below');
    expect(region.closest('.dg-detour-overlay')).toBeNull();
    expect(region.closest('.dg-board-content')).not.toBeNull();
    expect(container.querySelector('.dg-detour-overlay')).toBeNull();
  });

  test('background nodes leave the a11y tree and tab order while open, and return on close', async () => {
    const user = userEvent.setup();
    const { store, container } = setup({ reply: DEFINE_TERM });
    act(() => {
      store.applyFinal(ATTACH_EXPLAINER);
    });

    const background = container.querySelector<HTMLElement>('.dg-node[data-node-id="def-bio"]');
    const target = container.querySelector<HTMLElement>('.dg-node[data-node-id="branches"]');
    expect(background).not.toBeNull();
    expect(target).not.toBeNull();

    await waitFor(() => expect(background).toHaveAttribute('inert'));
    expect(background).toHaveAttribute('aria-hidden', 'true');
    expect(target).not.toHaveAttribute('inert');
    expect(target).not.toHaveAttribute('aria-hidden');

    await user.click(await screen.findByRole('button', { name: /Return/ }));
    await waitFor(() => expect(background).not.toHaveAttribute('inert'));
    expect(background).not.toHaveAttribute('aria-hidden');
  });

  test('target annotation is applied while open and removed on return', async () => {
    const user = userEvent.setup();
    const { store } = setup({ reply: DEFINE_TERM });
    act(() => {
      store.applyFinal(ATTACH_EXPLAINER);
    });
    const botany = screen.getByRole('button', { name: /Botany/i });
    await waitFor(() => expect(botany.getAttribute('data-dg-annotated')).toBe('circle'));

    await user.click(await screen.findByRole('button', { name: /Return/ }));
    await waitFor(() => expect(botany.hasAttribute('data-dg-annotated')).toBe(false));
  });
});

describe('M4 theme op end to end (§6.8)', () => {
  test('theme-mood-shift changes mood, ambience and board variables after mount', async () => {
    const changes: ResolvedTheme[] = [];
    const { store, container } = setup({ onThemeChange: (theme) => changes.push(theme) });
    act(() => {
      store.applyFinal(THEME_MOOD_SHIFT);
    });

    const board = container.querySelector('.dg-board') as HTMLElement;
    await waitFor(() => expect(board.getAttribute('data-dg-mood')).toBe('solemn'));
    expect(board.style.getPropertyValue('--dg-color-bg')).not.toBe('');
    expect(container.querySelector('.dg-ambience')?.getAttribute('data-dg-ambience-preset')).toBe('fog');
    expect(container.querySelector('.dg-ambience-haze')).toBeInTheDocument();
    expect(changes.at(-1)?.mood).toBe('solemn');
  });

  test('a detour-scoped theme leaves the board theme untouched before and after return', async () => {
    const user = userEvent.setup();
    const { store, container } = setup();
    act(() => {
      store.applyFinal({ v: 1, ops: [{ op: 'append', blocks: [text('root')] }] });
      store.applyFinal({ v: 1, ops: [{ op: 'theme', theme: { mood: 'calm' } }] });
    });
    const board = container.querySelector('.dg-board') as HTMLElement;
    const before = board.getAttribute('style');

    act(() => {
      store.applyFinal({
        v: 1,
        ops: [{ op: 'attach', to: 'root', theme: { mood: 'solemn' }, blocks: [text('scoped')] }],
      });
    });
    const region = await screen.findByRole('region', { name: 'Explainer' });
    expect(region.getAttribute('style')).toContain('--dg-color-bg');
    expect(board.getAttribute('style')).toBe(before);

    await user.click(within(region).getByRole('button', { name: /Return/ }));
    expect(board.getAttribute('style')).toBe(before);
  });
});

describe('M4 streaming partials (§7.2)', () => {
  test('streaming-partial applies progressively, idempotently', () => {
    const { store, container } = setup();
    const content = container.querySelector('.dg-board-content') as HTMLElement;
    act(() => {
      store.applyPartial({ v: 1, ops: [STREAMING_PARTIAL.ops[0]!] });
    });
    expect(within(content).getByText('This node is being streamed in progressively...')).toBeInTheDocument();
    expect(within(content).queryByRole('button', { name: 'Option A' })).toBeNull();

    act(() => {
      store.applyPartial(STREAMING_PARTIAL);
    });
    expect(within(content).getByRole('button', { name: 'Option A' })).toBeInTheDocument();

    act(() => {
      store.applyFinal(STREAMING_PARTIAL);
    });
    expect(document.querySelectorAll('.dg-node[data-node-id="streaming-text"]')).toHaveLength(1);
    expect(document.querySelectorAll('.dg-node[data-node-id="streaming-choices"]')).toHaveLength(1);
    expect(Object.keys(store.getState().nodes)).toHaveLength(2);
  });
});

describe('M4 receding scenes (§9.2)', () => {
  test('a node that entered in an earlier commit recedes when new content arrives', async () => {
    const { store, container } = setup();
    act(() => {
      store.applyFinal({ v: 1, ops: [{ op: 'append', blocks: [text('first')] }] });
    });
    const firstNode = await waitFor(() => {
      const node = container.querySelector<HTMLElement>('[data-node-id="first"].dg-node');
      if (!node) throw new Error('first node not rendered');
      return node;
    });
    expect(firstNode.getAttribute('data-dg-receded')).toBeNull();

    act(() => {
      store.applyFinal({ v: 1, ops: [{ op: 'append', blocks: [text('second')] }] });
    });
    await waitFor(() => expect(container.querySelector('[data-node-id="second"].dg-node')).toBeInTheDocument());
    await waitFor(() => expect(firstNode.getAttribute('data-dg-receded')).toBe('true'));
  });

  test('nodes entering in the same commit form one scene and none recede', async () => {
    const { store, container } = setup();
    act(() => {
      store.applyFinal({ v: 1, ops: [{ op: 'append', blocks: [text('one'), text('two')] }] });
    });
    await waitFor(() => expect(container.querySelector('[data-node-id="two"].dg-node')).toBeInTheDocument());
    expect(container.querySelector('[data-node-id="one"].dg-node')?.getAttribute('data-dg-receded')).toBeNull();
    expect(container.querySelector('[data-node-id="two"].dg-node')?.getAttribute('data-dg-receded')).toBeNull();
  });

  test('recede={false} disables the de-emphasis hook', async () => {
    const { store, container } = setup({ recede: false });
    act(() => {
      store.applyFinal({ v: 1, ops: [{ op: 'append', blocks: [text('first')] }] });
    });
    act(() => {
      store.applyFinal({ v: 1, ops: [{ op: 'append', blocks: [text('second')] }] });
    });
    await waitFor(() => expect(container.querySelector('[data-node-id="second"].dg-node')).toBeInTheDocument());
    expect(container.querySelector('[data-node-id="first"].dg-node')?.getAttribute('data-dg-receded')).toBeNull();
  });
});

describe('M4 camera (§6.10)', () => {
  test('a camera op zooms in and overview restores the frame', async () => {
    const { store, container } = setup({ camera: 'auto' });
    act(() => {
      store.applyFinal({
        v: 1,
        ops: [
          { op: 'append', blocks: [text('focus')] },
          { op: 'camera', to: 'focus', zoom: 1.35, duration: 400, ease: 'snappy' },
        ],
      });
    });
    await waitFor(() => expect(cameraEl(container).style.transform).toContain('scale(1.35)'));

    act(() => {
      store.applyFinal({ v: 1, ops: [{ op: 'camera', to: 'overview' }] });
    });
    await waitFor(() => expect(cameraEl(container).style.transform).toContain('scale(1)'));
  });

  test('zoom is bounded to 1.6x at the renderer', async () => {
    const { store, container } = setup({ camera: 'auto' });
    act(() => {
      store.applyFinal({
        v: 1,
        ops: [
          { op: 'append', blocks: [text('focus')] },
          { op: 'camera', to: 'focus', zoom: 2 },
        ],
      });
    });
    await waitFor(() => expect(cameraEl(container).style.transform).toContain('scale(1.6)'));
  });

  test('camera="auto" pushes in on newly entered content', async () => {
    const { store, container } = setup({ camera: 'auto' });
    act(() => {
      store.applyFinal({ v: 1, ops: [{ op: 'append', blocks: [text('auto-focus')] }] });
    });
    await waitFor(() => expect(cameraEl(container).style.transform).toMatch(/scale\(1\.09\)/));
  });

  test('camera="off" never transforms the board', async () => {
    const { store, container } = setup({ camera: 'off' });
    act(() => {
      store.applyFinal({
        v: 1,
        ops: [
          { op: 'append', blocks: [text('focus')] },
          { op: 'camera', to: 'focus', zoom: 1.4 },
        ],
      });
    });
    await waitFor(() => expect(cameraEl(container).style.transform).toBe('scale(1)'));
  });

  test('reduced motion replaces the push-in with scroll-into-view', async () => {
    setReducedMotion(true);
    const scroll = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, writable: true, value: scroll });
    const { store, container } = setup({ camera: 'auto' });
    act(() => {
      store.applyFinal({
        v: 1,
        ops: [
          { op: 'append', blocks: [text('focus')] },
          { op: 'camera', to: 'focus', zoom: 1.5 },
        ],
      });
    });
    await waitFor(() => expect(scroll).toHaveBeenCalled());
    expect(cameraEl(container).style.transform).toBe('scale(1)');
  });
});

describe('M4 host notifications and skip (§6.3/§7.7)', () => {
  test('onEnter, onCue and onThemeChange are reported', async () => {
    const enters: string[] = [];
    const cues: string[] = [];
    const themes: ResolvedTheme[] = [];
    const registry = createRegistry();
    const store = createBoardStore({ registry });
    render(
      <DreamerProvider registry={registry}>
        <Board store={store} camera="off" onEnter={(id) => enters.push(id)} onCue={(id) => cues.push(id)} onThemeChange={(theme) => themes.push(theme)} />
      </DreamerProvider>
    );
    act(() => {
      store.applyFinal({
        v: 1,
        ops: [
          { op: 'append', blocks: [text('now')] },
          { op: 'append', blocks: [{ ...text('later'), enter: { effect: 'rise', trigger: { on: 'cue', id: 'beat' } } }] },
          { op: 'theme', theme: { mood: 'calm' } },
        ],
      });
    });
    expect(enters).toEqual(['now']);
    act(() => store.cue('beat'));
    expect(cues).toEqual(['beat']);
    expect(enters).toContain('later');
    await waitFor(() => expect(themes.at(-1)?.mood).toBe('calm'));
  });

  test('the visible skip control flushes pending entries', async () => {
    const user = userEvent.setup();
    const store = createBoardStore({ registry: createRegistry() });
    store.applyFinal({
      v: 1,
      ops: [{ op: 'append', blocks: [{ ...text('gated'), enter: { effect: 'rise', trigger: { on: 'cue', id: 'beat' } } }] }],
    });
    render(
      <DreamerProvider registry={createRegistry()}>
        <Board store={store} camera="off" />
      </DreamerProvider>
    );
    expect(screen.queryByText('gated')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expect(document.querySelector('[data-node-id="gated"].dg-node')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
  });
});
