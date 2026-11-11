'use client';

/**
 * Plain-CSS-only host sample (§7.6): no Tailwind in this route — the board
 * is styled purely by dreamer-genui/styles.css plus the plain-CSS overrides
 * in plain.css. Fixtures: a small inline reply (no fixture imports needed).
 */
import { useEffect, useRef, useState } from 'react';
import { DreamerProvider, Board, useBoard, type UIEvent, type Reply } from 'dreamer-genui';
import { createRegistry } from 'dreamer-genui/core';
import type { LibraryError } from 'dreamer-genui/core';
import './plain.css';

const registry = createRegistry();

// keep it focused: the host override + zero-config board look
const reply: Reply = {
  v: 1,
  ops: [
    {
      op: 'append',
      blocks: [
        { id: 'h', type: 'text', variant: 'heading', content: ['Plain-CSS host'] },
        {
          id: 'p1',
          type: 'text',
          variant: 'body',
          content: ['The accent colour here comes from the host override — ', { mark: 'highlight', text: ['no Tailwind anywhere'] }, ' in this route.'],
        },
        {
          id: 'c',
          type: 'callout',
          tone: 'warn',
          title: 'Precedence reminder',
          content: ['This gold accent is plain-CSS host CSS beating the library default — but a tutor theme op (inline) would still win over it.'],
        },
      ],
    },
  ],
};

export default function PlainCssPage() {
  const board = useBoard();
  const loadedRef = useRef(false);
  const [events, setEvents] = useState<UIEvent[]>([]);
  const [errors, setErrors] = useState<LibraryError[]>([]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    board.reset();
    board.applyFinal(reply);
  }, [board]);

  return (
    <DreamerProvider registry={registry} onEvent={(e) => setEvents((p) => [...p, e])} onError={(e) => setErrors((p) => [...p, e])}>
      <main style={{ padding: 16 }}>
        <a href="/" style={{ color: 'var(--dg-color-accent)' }}>← back to the Tailwind playground</a>
        <Board store={board} />
        <section aria-label="event log" style={{ marginTop: 16 }}>
          <h2>Events</h2>
          <ul>{events.map((e, i) => <li key={i}><code>{JSON.stringify(e)}</code></li>)}</ul>
        </section>
        <section aria-label="error log">
          <h2>Errors</h2>
          <ul>{errors.map((e, i) => <li key={i}><code>{JSON.stringify(e)}</code></li>)}</ul>
        </section>
      </main>
    </DreamerProvider>
  );
}
