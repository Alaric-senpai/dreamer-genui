/**
 * Math wrappers (M6a). The KaTeX renderer and its stylesheet live in the lazy
 * `dreamer-genui/math` chunk; this module is the only thing the initial bundle
 * imports.
 */
import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';

const LazyMath = lazy(() => import('dreamer-genui/math'));
const LazyInlineMath = lazy(() =>
  import('dreamer-genui/math').then((module) => ({ default: module.InlineMathView })),
);

export function MathView({ tex, display }: { tex: string; display?: boolean }): ReactNode {
  return (
    <Suspense
      fallback={
        <code className="dg-math-fallback dg-math-loading" data-dg-part="fallback">
          {tex}
        </code>
      }
    >
      <LazyMath tex={tex} display={display} />
    </Suspense>
  );
}

export function InlineMathView({ tex }: { tex: string }): ReactNode {
  return (
    <Suspense fallback={<code className="dg-math-fallback">{tex}</code>}>
      <LazyInlineMath tex={tex} />
    </Suspense>
  );
}
