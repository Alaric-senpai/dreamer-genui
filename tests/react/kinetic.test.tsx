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

/** The run wrapper (KineticText's root element). */
function run(container: HTMLElement): HTMLElement {
  return container.firstElementChild as HTMLElement;
}

/** All text inside the run, in DOM order (used for split integrity). */
function joinedText(container: HTMLElement): string {
  return run(container).textContent ?? '';
}

/** Text of the animated (aria-hidden) copy — typed/clip/count digits, excluding the sr-only announcement. */
function animatedText(container: HTMLElement): string {
  return run(container).querySelector('[aria-hidden]')?.textContent ?? '';
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
  return [...run(container).children].filter(
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
    const all = [...run(container).children].map((s) => s.textContent);
    expect(all).toEqual(['a', ' ', ' ', 'b', '!']);
  });

  test('join integrity: all unit text concatenates to the exact source', () => {
    for (const [effect, split] of [['words', undefined], ['chars', undefined], ['slam', undefined], ['slam', 'chars']] as const) {
      const { container } = renderKinetic(['The count is 42 — wow!'], effect, split as 'chars' | undefined);
      expect(joinedText(container), `${effect}${split ?? ''}`).toBe('The count is 42 — wow!');
    }
  });

  test('split runs are fully visible to AT — no hidden copy, no aria-label (naming a generic span is spec-prohibited)', () => {
    const { container } = renderKinetic(['hello there'], 'words');
    expect(run(container).querySelector('[aria-label]')).toBeNull();
    expect(run(container).querySelector('[aria-hidden]')).toBeNull();
    expect(run(container).querySelector('.dg-sr-only')).toBeNull();
    expect(joinedText(container)).toBe('hello there');
  });

  test('marks never split — a highlight mark renders whole through MarkRenderer, live at its position', () => {
    const mark = { mark: 'highlight', text: ['highlighted phrase'] } as Inline;
    const { container } = renderKinetic(['look at the ', mark, ' now'], 'words');
    expect(container.querySelector('mark.dg-mark-highlight')).toBeInTheDocument();
    expect(container.querySelector('mark.dg-mark-highlight')!.textContent).toBe('highlighted phrase');
    // the mark is a live sibling — never inside an aria-hidden subtree
    expect(container.querySelector('mark.dg-mark-highlight')!.closest('[aria-hidden]')).toBeNull();
  });

  test('interactive marks stay in the accessibility tree through split runs (term/focusable)', () => {
    const term = { mark: 'term', text: 'photosynthesis', definition: 'how plants make food' } as Inline;
    const focusable = { mark: 'focusable', text: ['the diagram'], ref: 'diag-1' } as Inline;
    const { container } = renderKinetic(['learn ', term, ' via ', focusable], 'words');
    // neither interactive mark may sit under an aria-hidden wrapper
    for (const el of container.querySelectorAll('[role="button"], button')) {
      expect(el.closest('[aria-hidden]'), el.textContent ?? '').toBeNull();
    }
    // no hidden/labelled copy at all — AT reads the live DOM in order
    // (the term's own aria-label = its accessible name, which is correct)
    expect(run(container).getAttribute('aria-label')).toBeNull();
    expect(container.querySelector('[aria-hidden]')).toBeNull();
  });

  test('whole-run effects degrade to a static render when content holds interactive marks', () => {
    const term = { mark: 'term', text: 'mitosis', definition: 'cell division' } as Inline;
    for (const effect of ['typewriter', 'wipe'] as const) {
      const { container, unmount } = renderKinetic(['about ', term], effect);
      // no hidden/altered run: exact content, no sr copy, live term
      expect(container.querySelector('[aria-hidden]'), effect).toBeNull();
      expect(container.querySelector('.dg-sr-only'), effect).toBeNull();
      expect(container.querySelector('[role="button"]')!.closest('[aria-hidden]'), effect).toBeNull();
      unmount();
    }
  });

  test('count-up degrades to a static render when content carries ANY mark (its renderer shows string parts only)', () => {
    const mark = { mark: 'highlight', text: ['299'] } as Inline;
    const { container } = renderKinetic(['speed of light: ', mark], 'count-up');
    expect(container.querySelector('[aria-hidden]')).toBeNull();
    expect(container.querySelector('.dg-sr-only')).toBeNull();
    expect(container.querySelector('mark.dg-mark-highlight')).toBeInTheDocument();
    expect(joinedText(container)).toBe('speed of light: 299');
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
  test('wipe: sr-only copy announces the full text; the animated run is aria-hidden', () => {
    const { container } = renderKinetic(['kicker text'], 'wipe');
    expect(container.querySelector('.dg-sr-only')!.textContent).toBe('kicker text');
    const hiddenRun = container.querySelector('[aria-hidden]');
    expect(hiddenRun).toBeInTheDocument();
    expect(hiddenRun!.textContent).toBe('kicker text');
  });

  test('count-up ends exactly on the source number', () => {
    stubRafForTimers();
    const { container } = renderKinetic(['speed of light: 299'], 'count-up');
    // mid-animation it is below target; ends exactly at 299 (animated run text)
    advanceClock(160);
    const mid = Number(/[0-9.]+/.exec(animatedText(container))?.[0] ?? 0);
    expect(mid).toBeLessThan(299);
    advanceClock(1000);
    expect(/[0-9.]+/.exec(animatedText(container))![0]).toBe('299');
    // and the sr-only copy carries the final content
    expect(container.querySelector('.dg-sr-only')!.textContent).toBe('speed of light: 299');
  });

  test('count-up renders plainly when there is no number (static fallback, not a rise)', () => {
    const { container } = renderKinetic(['just words'], 'count-up');
    expect(joinedText(container)).toBe('just words');
    expect(container.querySelector('[aria-hidden]')).toBeNull();
    expect(container.querySelector('.dg-sr-only')).toBeNull();
  });

  test('typewriter starts empty and ends with the full text', () => {
    stubRafForTimers();
    const { container } = renderKinetic(['typing this out'], 'typewriter');
    expect(animatedText(container)).toBe('');
    advanceClock(26 * 8); // 8 chars
    expect(animatedText(container)).toBe('typing t');
    advanceClock(400);
    expect(animatedText(container)).toBe('typing this out');
    expect(container.querySelector('.dg-sr-only')!.textContent).toBe('typing this out');
  });

  test('typewriter renders a non-interactive mark once its slot is typed (animated, marks inline)', () => {
    stubRafForTimers();
    const mark = { mark: 'highlight', text: ['best'] } as Inline;
    const { container } = renderKinetic(['the ', mark, ' part'], 'typewriter');
    // sr-only copy announces the full final text; the animated run types
    expect(container.querySelector('.dg-sr-only')!.textContent).toBe('the best part');
    // before the mark's slot: not rendered yet
    advanceClock(20); // ~3 chars of 'the '
    expect(container.querySelector('mark')).toBeNull();
    // once typed past its slot: the whole mark appears inline, unsplitted
    advanceClock(400);
    expect(container.querySelector('mark.dg-mark-highlight')!.textContent).toBe('best');
    expect(container.querySelector('mark.dg-mark-highlight')!.closest('[aria-hidden]')!.tagName).not.toBe('MARK');
  });

  test('scribble draws its stroke next to intact content (only the decorative svg is hidden)', () => {
    const { container } = renderKinetic(['underlined point'], 'scribble');
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden]')!.tagName).toBe('svg');
    expect(joinedText(container)).toBe('underlined point');
  });
});

describe('reduced motion (§9.3) — content never gated', () => {
  test("'instant' presets render plain static text (whole, unsplit)", () => {
    setReducedMotion(true);
    const { container } = renderKinetic(['slammed words'], 'slam');
    expect(joinedText(container)).toBe('slammed words');
    expect(container.querySelector('[aria-hidden]')).toBeNull();
  });

  test("'fade' presets apply one short fade but show the full content immediately", () => {
    setReducedMotion(true);
    const { container } = renderKinetic(['faded words'], 'words');
    expect(joinedText(container)).toBe('faded words');
  });

  test('unknown/non-kinetic effects render plain inline content', () => {
    const { container } = renderKinetic(['plain content'], 'reveal');
    expect(joinedText(container)).toBe('plain content');
    expect(container.querySelector('[aria-label]')).toBeNull();
    expect(container.querySelector('[aria-hidden]')).toBeNull();
  });
});
