/**
 * Lazy code chunk (M6a). highlight.js core with a small, deliberate language
 * set — loaded only when a `code` block mounts. Everything is rendered from a
 * validated `source` string; the highlighted markup is generated locally.
 */
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import sql from 'highlight.js/lib/languages/sql';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('css', css);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('sql', sql);

const ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  html: 'xml',
  svg: 'xml',
};

function resolveLanguage(lang: string): string | undefined {
  const name = lang.toLowerCase().trim();
  const resolved = ALIASES[name] ?? name;
  return hljs.getLanguage(resolved) ? resolved : undefined;
}

/** Highlight `source` into safe HTML, or `null` when the language is unknown. */
export function highlightCode(source: string, lang: string): string | null {
  const language = resolveLanguage(lang);
  if (!language) return null;
  try {
    return hljs.highlight(source, { language, ignoreIllegals: true }).value;
  } catch {
    return null;
  }
}

export interface CodeRendererProps {
  source: string;
  lang: string;
}

/** Code block. Unknown languages get escaped plain text, never a blank node. */
export function CodeView({ source, lang }: CodeRendererProps): ReactNode {
  const html = useMemo(() => highlightCode(source, lang), [source, lang]);
  return (
    <div className="dg-code" data-dg-part="root" data-lang={lang}>
      <span className="dg-code-lang" data-dg-part="lang">
        {lang}
      </span>
      <pre className="dg-code-pre" data-dg-part="pre">
        {html === null ? (
          <code className="dg-code-source" data-dg-part="fallback">
            {source}
          </code>
        ) : (
          <code
            className={`hljs language-${lang}`}
            data-dg-part="code"
            // highlight.js output over a plain string; no model HTML.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </pre>
    </div>
  );
}

export default CodeView;
