// @vitest-environment jsdom
import { describe, expect, test, vi, afterEach } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { DreamerProvider } from '../../packages/dreamer-genui/src/react/provider';
import { KineticText } from '../../packages/dreamer-genui/src/react/kinetic/KineticText';
import { createRegistry } from '../../packages/dreamer-genui/src/core/registry';
import { setReducedMotion } from '../setup';

import type { Inline } from '../../packages/dreamer-genui/src/schema/inline';

afterEach(() => {
  cleanup();
  setReducedMotion(false);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function renderKinetic(content: Inline[], effect: string, split?: 'words' | 'chars') {
  return render(
    <DreamerProvider registry={createRegistry()}>
      <KineticText content={content} effect={effect as never} split={split} />
    </DreamerProvider>
  );
}

/** All text inside the wrapper, in DOM order (used for split integrity). */
function joinedText(container: HTMLElement): string {
  return container.firstElementChild?.textContent ?? '';
}

/** Full announced text = the aria-label the wrapper carries. */
function ariaLabel(container: HTMLElement): string {
  expect(container.firstElementChild).toHaveAttribute('aria-label');
  return container.firstElementChild!.getAttribute('aria-label')!;
}

// rAF + performance.now driven by the fake-timer clock, so the rAF loops in
// TypewriterRun/CountUpRun are deterministic under fake timers.
let clock = 0;
function stubRafForTimers(): void {
  clock = 0;
  vi.stubGlobal('performance', { now: () => clock });
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) =>
    setTimeout(() => cb(clock), 16)
  );
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  vi.useFakeTimers();
}

function advanceClock(ms: number): void {
  act(() => {
    clock += ms;
    vi.advanceTimersByTime(ms);
  });
}

/** Animated unit spans (static space spans carry no style attribute). */
function unitsIn(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll('span[aria-hidden] > span')].filter(
    (s): s is HTMLElement => s.hasAttribute('style')
  );
}

describe('splitting effects — words / chars / slam (§9.1)', () => {
  test('words renders one animated unit per word with spaces static between them', () => {
    const { container } = renderKinetic(['hello kinetic world'], 'words');
    const words = unitsIn(container).map((s) => s.textContent);
    expect(words).toEqual(['hello', 'kinetic', 'world']);
  });

  test('chars splits letters and preserves every whitespace run', () => {
    const { container } = renderKinetic(['a  b!'], 'chars');
    const all = [...container.querySelectorAll('span[aria-hidden] > span')].map((s) => s.textContent);
    expect(all).toEqual(['a', ' ', ' ', 'b', '!']);
  });

  test('join integrity: all unit text concatenates to the exact source', () => {
    for (const [effect, split] of [['words', undefined], ['chars', undefined], ['slam', undefined], ['slam', 'chars']] as const) {
      const { container } = renderKinetic(['The count is 42 — wow!'], effect, split as 'chars' | undefined);
      expect(joinedText(container), `${effect}${split ?? ''}`).toBe('The count is 42 — wow!');
    }
  });

  test('the wrapper aria-label carries the full text; units are hidden from AT', () => {
    const { container } = renderKinetic(['hello there'], 'words');
    expect(ariaLabel(container)).toBe('hello there');
    expect(container.querySelector('span[aria-hidden]')).toBeInTheDocument();
  });

  test('marks never split — a highlight mark renders whole through MarkRenderer', () => {
    const mark = { mark: 'highlight', text: ['highlighted phrase'] } as Inline;
    const { container } = renderKinetic(['look at the ', mark, ' now'], 'words');
    expect(container.querySelector('mark.dg-mark-highlight')).toBeInTheDocument();
    expect(container.querySelector('mark.dg-mark-highlight')!.textContent).toBe('highlighted phrase');
    // aria-label announces plain strings (the mark's own text is visible in the DOM tree)
    expect(ariaLabel(container)).toBe('look at the  now');
  });

  test('slam gives each word an animated unit (no plain whole-text render)', () => {
    const { container } = renderKinetic(['big punchline'], 'slam');
    const units = unitsIn(container);
    expect(units.length).toBe(2);
    for (const unit of units) {
      expect(unit.style.display).toBe('inline-block');
    }
  });
});

describe('whole-run effects', () => {
  test('wipe renders the full content inside a clip-path animated run', () => {
    const { container } = renderKinetic(['kicker text'], 'wipe');
    expect(joinedText(container)).toBe('kicker text');
    const run = container.querySelector('span[aria-hidden]');
    expect(run).toBeInTheDocument();
    expect(run!.textContent).toBe('kicker text');
  });

  test('count-up ends exactly on the source number', () => {
    stubRafForTimers();
    const { container } = renderKinetic(['speed of light: 299'], 'count-up');
    // mid-animation it is below target; ends exactly at 299
    advanceClock(160);
    const mid = Number(/[0-9.]+/.exec(joinedText(container))?.[0] ?? 0);
    expect(mid).toBeLessThan(299);
    advanceClock(1000);
    expect(/[0-9.]+/.exec(joinedText(container))![0]).toBe('299');
  });

  test('count-up falls back to a rise when there is no number', () => {
    const { container } = renderKinetic(['just words'], 'count-up');
    expect(joinedText(container)).toBe('just words');
  });

  test('typewriter starts empty and ends with the full text', () => {
    stubRafForTimers();
    const { container } = renderKinetic(['typing this out'], 'typewriter');
    expect(joinedText(container)).toBe('');
    advanceClock(26 * 8); // 8 chars
    expect(joinedText(container)).toBe('typing t');
    advanceClock(400);
    expect(joinedText(container)).toBe('typing this out');
  });

  test('scribble draws its stroke next to intact content', () => {
    const { container } = renderKinetic(['underlined point'], 'scribble');
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(joinedText(container)).toBe('underlined point');
  });
});

describe('reduced motion (§9.3) — content never gated', () => {
  test("'instant' presets render plain static text (whole, unsplit)", () => {
    setReducedMotion(true);
    const { container } = renderKinetic(['slammed words'], 'slam');
    expect(joinedText(container)).toBe('slammed words');
    expect(container.querySelectorAll('span[aria-hidden] > span').length).toBe(0);
  });

  test("'fade' presets apply one short fade but show the full content immediately", () => {
    setReducedMotion(true);
    const { container } = renderKinetic(['faded words'], 'words');
    expect(joinedText(container)).toBe('faded words');
  });

  test('unknown/non-kinetic effects render plain inline content', () => {
    const { container } = renderKinetic(['plain content'], 'reveal');
    expect(joinedText(container)).toBe('plain content');
    expect(container.firstElementChild!.getAttribute('aria-label')).toBeNull();
  });
});
