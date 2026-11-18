// @vitest-environment jsdom
import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AnnotationStroke, Annotated } from '../../packages/dreamer-genui/src/react/components/annotations';
import type { AnnotationKind } from '../../packages/dreamer-genui/src/react/components/annotations';

afterEach(cleanup);

describe('hand-drawn annotations (§6.6)', () => {
  const kinds: AnnotationKind[] = ['circle', 'underline', 'box', 'bracket', 'strike'];

  test.each(kinds)('%s renders a draw-on SVG stroke with a unique path', (kind) => {
    const { container } = render(<AnnotationStroke kind={kind} />);
    const svg = container.querySelector(`svg[data-dg-kind="${kind}"]`) as SVGSVGElement;
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 200 70');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    const path = svg.querySelector('path') as SVGPathElement;
    expect(path).toHaveAttribute('data-dg-part', 'stroke');
    expect(path).toHaveAttribute('pathLength', '1');
    expect(path.getAttribute('d')).toMatch(/^M /);
  });

  test('jitter is deterministic for the same seed and differs across seeds', () => {
    const a = render(<AnnotationStroke kind="underline" seed="abc" />);
    const pathA = a.container.querySelector('path')!.getAttribute('d');
    a.unmount();
    const b = render(<AnnotationStroke kind="underline" seed="abc" />);
    expect(b.container.querySelector('path')!.getAttribute('d')).toBe(pathA);
    b.unmount();
    const c = render(<AnnotationStroke kind="underline" seed="xyz" />);
    expect(c.container.querySelector('path')!.getAttribute('d')).not.toBe(pathA);
  });

  test('colour is passed as a token-safe CSS variable, never a raw style', () => {
    const { container } = render(<AnnotationStroke kind="circle" color="var(--dg-color-accent)" />);
    const svg = container.querySelector('svg') as SVGSVGElement;
    expect(svg.style.getPropertyValue('--dg-annotation-color')).toBe('var(--dg-color-accent)');
    expect(svg.style.stroke).toBe('');
  });

  test('Annotated wraps text and overlays the stroke', () => {
    const { container } = render(<Annotated kind="underline">key idea</Annotated>);
    const wrapper = container.querySelector('[data-dg-part="annotated"]') as HTMLElement;
    expect(wrapper).toHaveClass('dg-annotated', 'dg-annotated-underline');
    expect(wrapper).toHaveTextContent('key idea');
    expect(wrapper.querySelector('svg[data-dg-kind="underline"]')).toBeInTheDocument();
  });
});
