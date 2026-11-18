/**
 * Initial-bundle wrapper for M5 figures. The renderer itself lives in the
 * lazy `dreamer-genui/figures` chunk and is only downloaded when a figure node
 * actually mounts. 3D kinds fall back to their `alt` until M5b.
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Node } from '../../core/types';
import type { Figure } from '../../schema/figures';
import { useDreamer, useEmitEvent } from '../provider';
import { useOverride, useParts } from '../anatomy';
import { renderInline } from './inline';

const LazyFigureRenderer = lazy(() => import('dreamer-genui/figures'));

const TWO_D_KINDS = new Set<Figure['kind']>([
  'image', 'icon', 'diagram', 'flowchart', 'timeline', 'labeled', 'chart', 'lottie',
]);

function FigureFallback({ node }: { node: Node }): ReactNode {
  const p = useParts('fallback');
  const block = node.block as { figure?: { alt?: string } };
  const text = node.altText ?? block.figure?.alt ?? `(unable to render "${node.id}")`;
  return (
    <div {...p.props('root', 'dg-fallback')} data-node-id={node.id}>
      <span {...p.props('alt', 'dg-fallback-text')}>{text}</span>
    </div>
  );
}

export function FigureView({ node }: { node: Node }): ReactNode {
  const figure = (node.block as { figure?: Figure }).figure;
  const p = useParts('figure');
  const override = useOverride('figure');
  const { assets } = useDreamer();
  const emit = useEmitEvent();
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  if (!figure || !TWO_D_KINDS.has(figure.kind)) return <FigureFallback node={node} />;

  const defaultView = (
    <Suspense
      fallback={
        <div {...p.props('poster', 'dg-figure-poster dg-figure-loading')} role="status" aria-label={figure.alt}>
          {figure.alt}
        </div>
      }
    >
      <LazyFigureRenderer
        figure={figure}
        nodeId={node.id}
        emit={emit}
        renderInline={renderInline}
        assets={assets}
        reducedMotion={reducedMotion}
      />
    </Suspense>
  );
  return override ? (
    <>{override({ node, figure, renderDefault: () => defaultView })}</>
  ) : (
    <div {...p.props('root', 'dg-figure-wrapper')}>{defaultView}</div>
  );
}
