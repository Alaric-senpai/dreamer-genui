// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AmbienceLayer } from '../../packages/dreamer-genui/src/react/ambience/AmbienceLayer';
import type { AmbiencePreset } from '../../packages/dreamer-genui/src/theme/presets';

const PARTICLES: AmbiencePreset = {
  name: 'test-motes',
  description: 'test only',
  layer: 'particles',
  particles: {
    count: 40,
    color: 'ink',
    minSize: 1,
    maxSize: 2,
    speed: 10,
    drift: 4,
    twinkle: true,
    direction: 'up',
  },
};

const GRAIN: AmbiencePreset = { name: 'test-grain', description: 'test only', layer: 'grain', intensity: 0.5 };

function fakeContext(): CanvasRenderingContext2D {
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    globalAlpha: 1,
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D;
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeContext() as never);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ambience runtime (§6.9)', () => {
  test('the layer is decorative and below content', () => {
    const { container } = render(<AmbienceLayer preset={GRAIN} mode="auto" reducedMotion={false} />);
    const layer = container.querySelector('.dg-ambience');
    expect(layer).toHaveAttribute('aria-hidden', 'true');
    expect(layer).toHaveAttribute('data-dg-ambience-preset', 'test-grain');
    expect(container.querySelector('.dg-ambience-grain')).toBeInTheDocument();
  });

  test('mode="off" renders no preset layer', () => {
    const { container } = render(<AmbienceLayer preset={GRAIN} mode="off" reducedMotion={false} />);
    expect(container.querySelector('.dg-ambience-grain')).toBeNull();
  });

  test('reduced motion draws a static particle frame and never starts the loop', async () => {
    const { container } = render(<AmbienceLayer preset={PARTICLES} mode="auto" reducedMotion />);
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    await waitFor(() => expect(canvas.getAttribute('data-dg-ambience-state')).toBe('static'));
  });

  test('particles run, then pause when the tab is hidden', async () => {
    const { container } = render(<AmbienceLayer preset={PARTICLES} mode="auto" reducedMotion={false} />);
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    await waitFor(() => expect(canvas.getAttribute('data-dg-ambience-state')).toBe('running'));

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(canvas.getAttribute('data-dg-ambience-state')).toBe('paused'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });

  test('texture tokens add grain/vignette overlays independent of the preset', () => {
    const { container } = render(
      <AmbienceLayer
        preset={null}
        texture={{ grain: 0.4, vignette: 0.7 }}
        mode="auto"
        reducedMotion={false}
      />
    );
    expect(container.querySelector('.dg-ambience-grain')).toBeInTheDocument();
    expect(container.querySelector('.dg-ambience-vignette')).toBeInTheDocument();
  });
});
