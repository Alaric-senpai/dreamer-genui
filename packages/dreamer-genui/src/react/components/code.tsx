/**
 * Code wrapper (M6a). highlight.js and its language definitions live in the
 * lazy `dreamer-genui/code` chunk; the fallback is escaped plain text.
 */
import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';

const LazyCode = lazy(() => import('dreamer-genui/code'));

export function CodeView({ source, lang }: { source: string; lang: string }): ReactNode {
  return (
    <Suspense
      fallback={
        <div className="dg-code" data-dg-part="root" data-lang={lang}>
          <pre className="dg-code-pre" data-dg-part="pre">
            <code className="dg-code-source">{source}</code>
          </pre>
        </div>
      }
    >
      <LazyCode source={source} lang={lang} />
    </Suspense>
  );
}
