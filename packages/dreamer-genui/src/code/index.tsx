/**
 * Lazy code chunk (M6a). Shiki (v4) with a small, deliberate language set —
 * loaded only when a `code` block mounts. Everything is rendered from a
 * validated `source` string; the highlighted markup is generated locally
 * with the JavaScript regex engine (no WASM, no network, no CDN).
 *
 * The theme is Shiki's CSS-variables theme: tokens reference `--shiki-*`
 * variables, which the board maps onto `--dg-code-*` tokens in base CSS.
 * That keeps token colours themeable and avoids inline hard-coded colours.
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { createCssVariablesTheme, createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

const LANGUAGES = {
  javascript: () => import('@shikijs/langs/javascript'),
  typescript: () => import('@shikijs/langs/typescript'),
  python: () => import('@shikijs/langs/python'),
  json: () => import('@shikijs/langs/json'),
  bash: () => import('@shikijs/langs/bash'),
  css: () => import('@shikijs/langs/css'),
  xml: () => import('@shikijs/langs/xml'),
  sql: () => import('@shikijs/langs/sql'),
} as const;

type LanguageName = keyof typeof LANGUAGES;

const ALIASES: Record<string, LanguageName> = {
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

const THEME = 'dg';
const theme = createCssVariablesTheme({ name: THEME, variablePrefix: '--shiki-' });

let corePromise: Promise<HighlighterCore> | null = null;
const loaded = new Set<LanguageName>();

function getCore(): Promise<HighlighterCore> {
  corePromise ??= createHighlighterCore({
    themes: [theme],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  });
  return corePromise;
}

function resolveLanguage(lang: string): LanguageName | undefined {
  const name = lang.toLowerCase().trim();
  return ALIASES[name] ?? (name in LANGUAGES ? (name as LanguageName) : undefined);
}

/** Highlight `source` into safe HTML, or `null` when the language is unknown. */
export async function highlightCode(source: string, lang: string): Promise<string | null> {
  const language = resolveLanguage(lang);
  if (!language) return null;
  try {
    const core = await getCore();
    if (!loaded.has(language)) {
      const module = (await LANGUAGES[language]()) as {
        default: Parameters<HighlighterCore['loadLanguage']>[0];
      };
      await core.loadLanguage(module.default);
      loaded.add(language);
    }
    return core.codeToHtml(source, { lang: language, theme: THEME });
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
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setHtml(null);
    highlightCode(source, lang).then((result) => {
      if (live) setHtml(result);
    });
    return () => {
      live = false;
    };
  }, [source, lang]);

  return (
    <div className="dg-code" data-dg-part="root" data-lang={lang}>
      <span className="dg-code-lang" data-dg-part="lang">
        {lang}
      </span>
      <div className="dg-code-pre" data-dg-part="pre">
        {html === null ? (
          <pre className="dg-code-plain" data-dg-part="fallback">
            <code>{source}</code>
          </pre>
        ) : (
          <div
            data-dg-part="code"
            // Shiki output generated locally from a plain, validated string;
            // no model HTML is ever passed through here.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </div>
  );
}

export default CodeView;
