// @vitest-environment jsdom
import { describe, expect, test, afterEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DreamerProvider } from '../../packages/dreamer-genui/src/react/provider';
import { TextBlockView } from '../../packages/dreamer-genui/src/react/components/blocks';
import { createRegistry } from '../../packages/dreamer-genui/src/core/registry';
import type { TextBlock } from '../../packages/dreamer-genui/src/schema/blocks';

expect.extend(toHaveNoViolations);

afterEach(() => cleanup());

function textBlock(partial: Partial<TextBlock>): TextBlock {
  return {
    type: 'text',
    id: partial.id ?? 't1',
    variant: partial.variant ?? 'body',
    content: partial.content ?? ['plain body sentence'],
    ...partial,
  } as TextBlock;
}

/** Animated kinetic units: styled spans that are not the aria-hidden whole-run copies. */
function kineticUnits(container: HTMLElement): number {
  return [...container.querySelectorAll('span')].filter(
    (s) => s.hasAttribute('style') && !s.hasAttribute('aria-hidden')
  ).length;
}

/** Direct unit children of the kinetic run inside a rendered text block. */
function runUnits(container: HTMLElement): string[] {
  const run = container.querySelector('p[data-node-id="t1"]')!.firstElementChild as HTMLElement;
  return [...run.children].map((c) => c.textContent);
}

function renderView(block: TextBlock) {
  return render(
    <DreamerProvider registry={createRegistry()}>
      <TextBlockView block={block} />
    </DreamerProvider>
  );
}

describe('TextBlockView dispatch (DECISIONS M3 batch-2 ruling)', () => {
  test('no enter → variant default kinetic entrance (body → words units)', () => {
    const { container } = renderView(textBlock({}));
    expect(kineticUnits(container)).toBeGreaterThan(0);
  });

  test('container-level effect (rise) → plain text, no kinetic units', () => {
    const { container } = renderView(
      textBlock({ enter: { effect: 'rise', duration: 400 } })
    );
    expect(kineticUnits(container)).toBe(0);
    expect(container.querySelector('p[data-node-id="t1"]')!.textContent).toBe('plain body sentence');
  });

  test('explicit kinetic effect + split override is honoured (words preset + chars split)', () => {
    const { container } = renderView(
      textBlock({ enter: { effect: 'words', split: 'chars' } })
    );
    // chars: every character is its own unit ('plain body sentence' has 17 chars + 2 spaces)
    const units = runUnits(container);
    expect(units).toEqual([...'plain body sentence']);
  });

  test("'lines' split falls back to the effect's native split (pinned ruling)", () => {
    const { container } = renderView(
      textBlock({ enter: { effect: 'words', split: 'lines' } })
    );
    // words engine, no explicit override → word units, not phrase-per-line
    const run = container.querySelector('p[data-node-id="t1"]')!.firstElementChild as HTMLElement;
    const styled = [...run.children].filter((s) => s.hasAttribute('style'));
    expect(styled.length).toBe(3);
  });

  test("'none' is not kinetic — static render, no units, no aria-label", () => {
    const { container } = renderView(textBlock({ enter: { effect: 'none' } }));

    expect(kineticUnits(container)).toBe(0);
    expect(container.querySelector('[aria-label]')).toBeNull();
  });
});

describe('a11y (review round 1 guard)', () => {
  test('axe: a default-kinetic body text with term + focusable marks has no violations', async () => {
    const term = { mark: 'term', text: 'photosynthesis', definition: 'how plants make food' };
    const focusable = { mark: 'focusable', text: ['the leaf diagram'], ref: 'leaf-1' };
    const { container } = renderView(
      textBlock({ content: ['Plants run ', term, ' — see ', focusable] as TextBlock['content'] })
    );
    // default dispatch → words kinetic: interactive marks MUST stay live
    expect(kineticUnits(container)).toBeGreaterThan(0);
    expect(container.querySelector('button.dg-mark-focusable')!.closest('[aria-hidden]')).toBeNull();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
