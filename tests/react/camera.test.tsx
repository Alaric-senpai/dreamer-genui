// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DreamerProvider } from '../../packages/dreamer-genui/src/react/provider';
import { Board } from '../../packages/dreamer-genui/src/react/board';
import { createBoardStore } from '../../packages/dreamer-genui/src/react/use-board';
import { createRegistry } from '../../packages/dreamer-genui/src/core/registry';
import type { ReplyLike } from '../../packages/dreamer-genui/src/core/resolver';
import { setReducedMotion } from '../setup';

function text(id: string): Record<string, unknown> {
  return { id, type: 'text', variant: 'body', content: [id] };
}

function setup(options: { cameraControls?: 'none' | 'pinch-pan'; reply?: ReplyLike } = {}) {
  const registry = createRegistry();
  const store = createBoardStore({ registry });
  if (options.reply) store.applyFinal(options.reply);
  const ui = render(
    <DreamerProvider registry={registry}>
      <Board
        store={store}
        camera="auto"
        cameraControls={options.cameraControls ?? 'none'}
        ambience="off"
      />
    </DreamerProvider>
  );
  const camera = ui.container.querySelector<HTMLElement>('.dg-camera');
  if (!camera) throw new Error('missing camera layer');
  return { store, camera, ...ui };
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

describe('M4b camera extension (§6.12)', () => {
  test('a preset move applies closeup zoom, tilt and dolly without skewing text', async () => {
    const { store, camera, container } = setup();
    act(() => {
      store.applyFinal({
        v: 1,
        ops: [
          { op: 'append', blocks: [text('focus')] },
          {
            op: 'camera',
            to: 'focus',
            preset: 'closeup',
            tilt: { x: 8, y: -4 },
            dolly: 'in',
            duration: 0,
          },
        ],
      });
    });

    await waitFor(() => expect(camera.style.transform).toContain('scale(1.45)'));
    const board = container.querySelector<HTMLElement>('.dg-board');
    expect(board?.style.getPropertyValue('--dg-camera-tilt-x')).toBe('8deg');
    expect(board?.style.getPropertyValue('--dg-camera-tilt-y')).toBe('-4deg');
    expect(board?.style.getPropertyValue('--dg-camera-dolly-z')).toBe('48px');
    // The camera layer itself stays a flat translate + scale: text never tilts.
    expect(camera.style.transform).not.toMatch(/rotate|perspective/);
    const backdrop = container.querySelector<HTMLElement>('[data-dg-camera-backdrop]');
    expect(backdrop?.style.transform).toContain('rotateX(8deg)');
    expect(backdrop?.style.transform).toContain('translateZ(48px)');
  });

  test('a guided path waits for each step cue and then moves', async () => {
    const { store, camera } = setup();
    act(() => {
      store.applyFinal({
        v: 1,
        ops: [
          { op: 'append', blocks: [text('focus')] },
          {
            op: 'camera',
            path: [
              { to: 'focus', zoom: 1.15, duration: 0 },
              {
                to: 'focus',
                zoom: 1.5,
                tilt: { y: 6 },
                duration: 0,
                trigger: { on: 'cue', id: 'detail' },
              },
            ],
          },
        ],
      });
    });

    await waitFor(() => expect(camera.style.transform).toContain('scale(1.15)'));
    expect(camera.style.transform).not.toContain('scale(1.5)');

    act(() => store.cue('detail'));
    await waitFor(() => expect(camera.style.transform).toContain('scale(1.5)'));
    const board = document.querySelector<HTMLElement>('.dg-board');
    expect(board?.style.getPropertyValue('--dg-camera-tilt-y')).toBe('6deg');
  });

  test('pinch-pan moves the camera, exposes reset and releases the override', async () => {
    const { store, camera, container } = setup({ cameraControls: 'pinch-pan' });
    act(() => {
      store.applyFinal({ v: 1, ops: [{ op: 'append', blocks: [text('focus')] }] });
    });

    fireEvent.pointerDown(camera, { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
    fireEvent.pointerMove(camera, { pointerId: 1, pointerType: 'touch', clientX: 140, clientY: 130 });
    fireEvent.pointerUp(camera, { pointerId: 1, pointerType: 'touch', clientX: 140, clientY: 130 });

    await waitFor(() => expect(camera.style.transform).toContain('translate(40px, 30px)'));
    const board = container.querySelector<HTMLElement>('.dg-board');
    expect(board?.getAttribute('data-dg-camera-user')).toBe('true');

    const reset = container.querySelector<HTMLButtonElement>('.dg-camera-reset');
    expect(reset).toBeInTheDocument();
    fireEvent.click(reset!);
    await waitFor(() => expect(board?.getAttribute('data-dg-camera-user')).toBeNull());
    expect(container.querySelector('.dg-camera-reset')).toBeNull();
  });

  test('reduced motion degrades a camera move to scroll-into-view', async () => {
    setReducedMotion(true);
    const scroll = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scroll,
    });
    const { store, camera } = setup();
    act(() => {
      store.applyFinal({
        v: 1,
        ops: [
          { op: 'append', blocks: [text('focus')] },
          { op: 'camera', to: 'focus', preset: 'closeup', tilt: { x: 10 }, dolly: 'in' },
        ],
      });
    });

    await waitFor(() => expect(scroll).toHaveBeenCalled());
    expect(camera.style.transform).toContain('scale(1)');
    expect(camera.style.transform).not.toContain('scale(1.45)');
  });
});
