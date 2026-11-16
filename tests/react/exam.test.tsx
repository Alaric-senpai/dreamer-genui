// @vitest-environment jsdom
import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, describe, expect, test } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DreamerProvider } from '../../packages/dreamer-genui/src/react/provider';
import { Board } from '../../packages/dreamer-genui/src/react/board';
import { createBoardStore } from '../../packages/dreamer-genui/src/react/use-board';
import { createRegistry } from '../../packages/dreamer-genui/src/core/registry';
import type { ReplyLike } from '../../packages/dreamer-genui/src/core/resolver';

const examFixture = JSON.parse(
  readFileSync(join(process.cwd(), 'fixtures', 'assessment-exam.json'), 'utf-8'),
) as ReplyLike;

afterEach(cleanup);

describe('M4b exam mode presentation locks (§6.8)', () => {
  test('camera and ambience go dark during an exam and return on submit', () => {
    const registry = createRegistry();
    const store = createBoardStore({ registry });
    store.applyFinal(examFixture);

    const { container } = render(
      <DreamerProvider registry={registry}>
        <Board
          store={store}
          camera="auto"
          cameraControls="pinch-pan"
          ambience="auto"
        />
      </DreamerProvider>,
    );
    const board = container.querySelector<HTMLElement>('.dg-board');
    expect(board?.getAttribute('data-dg-exam')).toBeNull();

    act(() => {
      store.assessments.get('exam-paper')?.start();
    });
    expect(board?.getAttribute('data-dg-exam')).toBe('true');
    expect(board?.getAttribute('data-dg-camera')).toBe('off');
    expect(board?.getAttribute('data-dg-ambience')).toBe('off');
    // No reset control is offered while the camera is locked off.
    expect(container.querySelector('.dg-camera-reset')).toBeNull();

    act(() => {
      store.assessments.get('exam-paper')?.submit();
    });
    expect(board?.getAttribute('data-dg-exam')).toBeNull();
    expect(board?.getAttribute('data-dg-camera')).toBe('auto');
    expect(board?.getAttribute('data-dg-ambience')).toBe('auto');
  });

  test('the host can opt out of individual locks', () => {
    const registry = createRegistry();
    const store = createBoardStore({ registry });
    store.applyFinal(examFixture);

    const { container } = render(
      <DreamerProvider registry={registry}>
        <Board store={store} camera="auto" ambience="auto" examLocks={{ camera: false }} />
      </DreamerProvider>,
    );
    const board = container.querySelector<HTMLElement>('.dg-board');

    act(() => {
      store.assessments.get('exam-paper')?.start();
    });
    // Camera remains available; ambience is still locked.
    expect(board?.getAttribute('data-dg-camera')).toBe('auto');
    expect(board?.getAttribute('data-dg-ambience')).toBe('off');
    expect(board?.getAttribute('data-dg-exam')).toBe('true');
  });
});
