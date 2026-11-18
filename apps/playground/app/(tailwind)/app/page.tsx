'use client';

/**
 * `/app` — the live playground route.
 *
 * Connects the board to a real tutor through the Vercel AI SDK (see
 * `app/api/tutor/route.ts`). The model streams a `Reply` JSON object; this
 * page validates the final reply, plans its ops into beats (one visual op per
 * page), applies them to the board and fires each beat's cues in order so
 * entrance animations follow the "narration". Previous beats stay in board
 * state but leave the live viewport, so a long lesson cannot overflow it.
 *
 * Everything is playground code: the library itself never talks to a model.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Board,
  BoardStoreProvider,
  DreamerProvider,
  createBoardStore,
  type Reply,
  type UIEvent,
} from 'dreamer-genui';
import { createRegistry, serializeBoard } from 'dreamer-genui/core';
import { ReplySchema } from 'dreamer-genui/schema';

import {
  extractOps,
  extractReplyObject,
  repairReply,
  repairedOps,
  tidy,
  type PlaygroundRepairStats,
} from './reply-repair';
import { planBeats, type Beat } from './playback';

const registry = createRegistry();

const DevtoolsOverlay = dynamic(
  () => import('dreamer-genui/devtools').then((mod) => mod.DevtoolsOverlay),
  { ssr: false }
);

const MODELS = [
  'MiniMaxAI/MiniMax-M2.7',
  'deepseek-ai/DeepSeek-V4-Flash-0731',
  'zai-org/GLM-5.3-Flash',
] as const;

type Mode = 'lesson' | 'assessment';
type ChatEntry = { id: number; role: 'user' | 'assistant'; text: string; detail?: string };

const QUICK_STARTS = [
  'Teach me photosynthesis. Use a split layout with a diagram and end with a quick question.',
  'Explain the water cycle with a flowchart, then test me on the main stages.',
  'Explain equivalent fractions with a visual example and a short practice question.',
  'Give me a three-beat lesson on the causes of the First World War, with a sombre mood.',
];

/** Join conditional class strings without pulling in another dependency. */
function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

/** First sentence becomes the quick-start title, the rest is supporting text. */
function splitStarter(starter: string): { title: string; detail: string } {
  const end = starter.indexOf('.');
  if (end === -1) return { title: starter, detail: '' };
  return {
    title: starter.slice(0, end + 1),
    detail: starter.slice(end + 1).trim(),
  };
}

export default function LiveDemonstrationApp() {
  const [board] = useState(() => createBoardStore({ registry }));

  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState<string>(MODELS[0]);
  const [mode, setMode] = useState<Mode>('lesson');
  const [streaming, setStreaming] = useState(false);
  const [autoReply, setAutoReply] = useState(true);
  const [rawPreview, setRawPreview] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [beatIndex, setBeatIndex] = useState(-1);
  const [visibleIds, setVisibleIds] = useState<string[] | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const streamingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const timersRef = useRef<number[]>([]);
  const chatIdRef = useRef(0);
  const beatsRef = useRef<Beat[]>([]);
  const appliedRef = useRef(-1);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const clearCueTimers = useCallback(() => {
    for (const timer of timersRef.current) window.clearTimeout(timer);
    timersRef.current = [];
  }, []);

  useEffect(() => () => {
    clearCueTimers();
    abortRef.current?.abort();
  }, [clearCueTimers]);

  useEffect(() => {
    if (!panelOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanelOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [panelOpen]);

  const pushChat = useCallback((entry: Omit<ChatEntry, 'id'>) => {
    chatIdRef.current += 1;
    setChat((prev) => [...prev, { ...entry, id: chatIdRef.current }]);
  }, []);

  const narrate = useCallback(
    (cueIds: string[]) => {
      clearCueTimers();
      cueIds.forEach((cueId, index) => {
        const timer = window.setTimeout(() => {
          board.cue(cueId);
        }, 1200 + index * 2200);
        timersRef.current.push(timer);
      });
    },
    [board, clearCueTimers]
  );

  const showBeat = useCallback(
    (index: number, options?: { narrate?: boolean }) => {
      const list = beatsRef.current;
      if (list.length === 0) return;
      const target = Math.max(0, Math.min(index, list.length - 1));
      for (let i = appliedRef.current + 1; i <= target; i += 1) {
        const beat = list[i];
        if (beat) board.applyFinal({ v: 1, ops: beat.ops });
      }
      appliedRef.current = Math.max(appliedRef.current, target);
      const beat = list[target];
      if (beat && beat.nodeIds.length > 0) setVisibleIds(beat.nodeIds);
      setBeatIndex(target);
      if (beat && options?.narrate !== false) narrate(beat.cueIds);
      window.requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      });
    },
    [board, narrate]
  );

  /** Apply every remaining beat so the tutor sees the whole board next turn. */
  const commitPending = useCallback(() => {
    const list = beatsRef.current;
    for (let i = appliedRef.current + 1; i < list.length; i += 1) {
      const beat = list[i];
      if (beat) board.applyFinal({ v: 1, ops: beat.ops });
    }
    appliedRef.current = Math.max(appliedRef.current, list.length - 1);
  }, [board]);

  const appendBeats = useCallback(
    (planned: Beat[]) => {
      if (planned.length === 0) return;
      const first = beatsRef.current.length;
      const next = [...beatsRef.current, ...planned];
      beatsRef.current = next;
      setBeats(next);
      showBeat(first);
    },
    [showBeat]
  );

  const clearPlayback = useCallback(() => {
    clearCueTimers();
    beatsRef.current = [];
    appliedRef.current = -1;
    setBeats([]);
    setBeatIndex(-1);
    setVisibleIds(null);
  }, [clearCueTimers]);

  const send = useCallback(
    async (text: string) => {
      const prompt = text.trim();
      if (!prompt || streamingRef.current) return;

      streamingRef.current = true;
      setStreaming(true);
      setError(null);
      setRawPreview('');
      pushChat({ role: 'user', text: prompt });
      // Anything still waiting behind the current beat must reach board state
      // before `serializeBoard`, even though it stays outside the viewport.
      commitPending();

      const userMessage = { role: 'user' as const, content: prompt };
      const history = [...historyRef.current, userMessage].slice(-24);
      historyRef.current = history;

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch('/api/tutor', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            messages: history,
            board: serializeBoard(board.getState()),
            mode,
            model,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? `Tutor request failed (${response.status})`);
        }
        if (!response.body) throw new Error('The tutor response had no body.');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let raw = '';

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          raw += decoder.decode(value, { stream: true });
          setRawPreview(tidy(raw).slice(-1200));
        }
        raw += decoder.decode();

        const finalText = tidy(raw).trim();
        const candidate = extractReplyObject(finalText);
        // If the outer object is malformed or truncated, recover the complete
        // ops that did make it through instead of losing the whole turn.
        const scannedOps = candidate ? [] : extractOps(finalText);
        if (!candidate && scannedOps.length === 0) {
          throw new Error('The tutor did not return a JSON reply.');
        }
        const source = candidate?.value ?? { v: 1, ops: scannedOps };
        const jsonText = candidate?.jsonText ?? finalText;
        const repairStats: PlaygroundRepairStats = { droppedOps: 0, salvagedBlocks: 0 };
        let reply: Reply;
        let recovered = false;
        try {
          reply = ReplySchema.parse(repairReply(source, repairStats)) as Reply;
        } catch (parseError) {
          // Keep whatever complete ops survived repairs, then continue with a
          // visible note rather than blanking the board.
          const salvaged = repairedOps(source);
          if (salvaged.length === 0) {
            throw new Error(
              `Invalid reply from the tutor: ${
                parseError instanceof Error ? parseError.message : String(parseError)
              }`,
            );
          }
          reply = { v: 1, ops: salvaged };
          recovered = true;
        }

        const planned = planBeats(reply);
        appendBeats(planned);
        const cueIds = Array.from(new Set(planned.flatMap((beat) => beat.cueIds)));
        historyRef.current = [
          ...historyRef.current,
          { role: 'assistant' as const, content: jsonText },
        ].slice(-24);

        pushChat({
          role: 'assistant',
          text: `Board updated — ${reply.ops.length} op${reply.ops.length === 1 ? '' : 's'}${
            cueIds.length ? `, ${cueIds.length} cue${cueIds.length === 1 ? '' : 's'}` : ''
          }${planned.length ? `, ${planned.length} page${planned.length === 1 ? '' : 's'}` : ''}${
            recovered ? ' (recovered a partial reply)' : ''
          }${
            repairStats.salvagedBlocks || repairStats.droppedOps
              ? ` (recovered ${repairStats.salvagedBlocks} loose block${
                  repairStats.salvagedBlocks === 1 ? '' : 's'
                }, skipped ${repairStats.droppedOps} invalid entr${
                  repairStats.droppedOps === 1 ? 'y' : 'ies'
                })`
              : ''
          }.`,
          detail: jsonText,
        });
        setRawPreview(jsonText);
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        pushChat({ role: 'assistant', text: `Something went wrong: ${message}` });
      } finally {
        streamingRef.current = false;
        abortRef.current = null;
        setStreaming(false);
      }
    },
    [appendBeats, board, commitPending, mode, model, pushChat]
  );

  const sendRef = useRef(send);
  sendRef.current = send;

  const handleEvent = useCallback(
    (event: UIEvent) => {
      if (!autoReply || streamingRef.current) return;
      if (event.type !== 'answer' && event.type !== 'select') return;
      const label = 'label' in event && event.label ? ` (“${event.label}”)` : '';
      const ref = 'ref' in event && event.ref ? ` (${event.ref})` : '';
      if (event.type === 'answer') {
        void sendRef.current(
          `The student answered node "${event.nodeId}"${ref}${label} with: ${JSON.stringify(
            event.value,
          )}. Respond to the answer and continue the lesson.`,
        );
      } else if (event.type === 'select') {
        void sendRef.current(
          `The student selected "${event.ref ?? event.nodeId}"${ref}${label} on the board. Respond and continue.`,
        );
      }
    },
    [autoReply]
  );

  const reset = () => {
    abortRef.current?.abort();
    clearPlayback();
    board.reset();
    historyRef.current = [];
    setChat([]);
    setRawPreview('');
    setError(null);
  };

  const back = () => {
    board.back();
    clearPlayback();
  };

  const skip = () => {
    clearCueTimers();
    board.flush();
  };

  const submitInput = useCallback(() => {
    const value = input.trim();
    if (!value || streamingRef.current) return;
    setInput('');
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      setPanelOpen(false);
    }
    void send(value);
  }, [input, send]);

  const startQuick = useCallback(
    (starter: string) => {
      if (streamingRef.current) return;
      if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
        setPanelOpen(false);
      }
      void send(starter);
    },
    [send]
  );

  const modelLabel = model.split('/').pop() ?? model;
  const progress = beats.length > 0 ? ((Math.max(beatIndex, 0) + 1) / beats.length) * 100 : 0;

  return (
    <DreamerProvider registry={registry} colorScheme="auto">
      <BoardStoreProvider store={board} status={streaming ? 'thinking' : 'idle'}>
        <main className="relative flex h-dvh flex-col overflow-hidden bg-background text-foreground">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(80rem_40rem_at_115%_-10%,rgba(29,78,216,0.10),transparent_60%),radial-gradient(55rem_30rem_at_-10%_110%,rgba(16,185,129,0.10),transparent_60%)]"
          />

          {panelOpen && (
            <button
              type="button"
              aria-label="Close tutor panel"
              onClick={() => setPanelOpen(false)}
              className="fixed inset-0 z-60 bg-slate-950/25 backdrop-blur-[2px] md:hidden"
            />
          )}

          <div className="relative z-10 flex h-full min-h-0 w-full">
            {/* ---------------------------------------------------------------- */}
            {/* Tutor panel: conversation, prompt controls and composer           */}
            {/* ---------------------------------------------------------------- */}
            <aside
              aria-label="tutor panel"
              className={cx(
                'min-h-0 shrink-0 flex-col border-r border-border/80 bg-card/90 backdrop-blur-xl',
                panelOpen
                  ? 'fixed inset-y-0 left-0 z-70 flex w-[min(92vw,400px)] shadow-2xl'
                  : 'hidden w-full md:flex md:w-[360px] lg:w-[400px]'
              )}
            >
              <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border/80 px-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary font-heading text-[11px] font-bold text-primary-foreground shadow-sm shadow-primary/25">
                  DG
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading text-sm font-semibold tracking-tight">
                    dreamer-genui
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">Live tutor studio</p>
                </div>
                <Link
                  href="/"
                  title="Back to the playground index"
                  aria-label="Back to the playground index"
                  className="grid size-8 place-items-center rounded-lg border border-border/80 bg-card text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  ←
                </Link>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  aria-label="Close tutor panel"
                  className="grid size-8 place-items-center rounded-lg border border-border/80 bg-card text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground md:hidden"
                >
                  ×
                </button>
              </div>

              <div className="grid shrink-0 gap-3 border-b border-border/80 px-4 py-3">
                <div className="grid gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Profile
                  </span>
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
                    {(['lesson', 'assessment'] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setMode(value)}
                        className={cx(
                          'rounded-lg px-2 py-1.5 text-xs font-medium capitalize transition',
                          mode === value
                            ? 'bg-card text-foreground shadow-sm ring-1 ring-border/80'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="grid gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Model
                  </span>
                  <select
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    className="w-full rounded-lg border border-border/80 bg-background px-2.5 py-2 text-xs outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                  >
                    {MODELS.map((name) => (
                      <option key={name} value={name}>
                        {name.split('/').pop()}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex items-center justify-between px-4 pb-2 pt-3">
                  <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Conversation
                  </h2>
                  {chat.length > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      {chat.length} message{chat.length === 1 ? '' : 's'}
                    </span>
                  )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
                  {chat.length === 0 ? (
                    <div className="px-1">
                      <div className="rounded-2xl border border-dashed border-primary/25 bg-gradient-to-br from-primary/5 via-card to-secondary/5 p-4">
                        <p className="font-heading text-sm font-semibold">Start a lesson</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          The tutor streams a reply and the board plays it one beat at a time. Use
                          Continue to move through the lesson at your own pace.
                        </p>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {QUICK_STARTS.map((starter, index) => {
                          const { title, detail } = splitStarter(starter);
                          return (
                            <button
                              key={starter}
                              type="button"
                              disabled={streaming}
                              onClick={() => startQuick(starter)}
                              className="group flex w-full items-start gap-2.5 rounded-xl border border-border/80 bg-card p-3 text-left text-xs transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm disabled:pointer-events-none disabled:opacity-50"
                            >
                              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-primary/10 font-heading text-[10px] font-bold text-primary">
                                {index + 1}
                              </span>
                              <span className="min-w-0">
                                <span className="block font-medium leading-snug text-foreground">
                                  {title}
                                </span>
                                {detail && (
                                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                                    {detail}
                                  </span>
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <ol className="flex flex-col gap-2.5 px-1">
                      {chat.map((entry) => (
                        <li
                          key={entry.id}
                          className={cx(
                            'flex',
                            entry.role === 'user' ? 'justify-end' : 'justify-start'
                          )}
                        >
                          <div
                            className={cx(
                              'max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm',
                              entry.role === 'user'
                                ? 'rounded-br-md bg-primary text-primary-foreground'
                                : 'rounded-bl-md border border-border/80 bg-card text-card-foreground'
                            )}
                          >
                            <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.16em] opacity-60">
                              {entry.role === 'user' ? 'You' : 'Tutor'}
                            </p>
                            <p className="whitespace-pre-wrap leading-relaxed">{entry.text}</p>
                            {entry.detail && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-[10px] text-muted-foreground transition hover:text-foreground">
                                  Reply JSON
                                </summary>
                                <pre className="mt-1.5 max-h-48 overflow-auto rounded-lg bg-muted p-2 text-[10px] leading-snug">
                                  {entry.detail}
                                </pre>
                              </details>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>

              <div className="shrink-0 border-t border-border/80 bg-card/80 p-3">
                {error && (
                  <p
                    role="alert"
                    className="mb-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs leading-snug text-destructive"
                  >
                    {error}
                  </p>
                )}

                <details className="mb-2 rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-[11px]">
                  <summary className="cursor-pointer select-none text-muted-foreground">
                    Raw stream
                  </summary>
                  <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-background/80 p-2 text-[10px] leading-snug">
                    {rawPreview || 'No stream yet.'}
                  </pre>
                </details>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitInput();
                  }}
                  className="rounded-2xl border border-border/80 bg-background p-2 shadow-sm transition focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15"
                >
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        submitInput();
                      }
                    }}
                    rows={2}
                    placeholder="Ask for a lesson, a question, a diagram, a mood shift…"
                    className="w-full resize-none bg-transparent px-1.5 py-1 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
                  />
                  <div className="flex items-center justify-between gap-2 px-1 pt-1">
                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={autoReply}
                        onChange={(event) => setAutoReply(event.target.checked)}
                        className="size-3.5 accent-primary"
                      />
                      Auto-respond
                    </label>
                    <button
                      type="submit"
                      disabled={streaming || !input.trim()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                    >
                      {streaming ? (
                        <>
                          <span className="size-1.5 animate-pulse rounded-full bg-primary-foreground" />
                          Writing…
                        </>
                      ) : (
                        <>
                          Send
                          <span aria-hidden="true">→</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
                <p className="mt-2 text-center text-[10px] text-muted-foreground">
                  Enter to send · Shift+Enter for a new line
                </p>
              </div>
            </aside>

            {/* ---------------------------------------------------------------- */}
            {/* Stage: the live board, beat navigation and board controls         */}
            {/* ---------------------------------------------------------------- */}
            <section className="flex min-w-0 flex-1 flex-col" aria-label="live board">
              <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/80 bg-card/60 px-3 backdrop-blur md:px-5">
                <button
                  type="button"
                  onClick={() => setPanelOpen(true)}
                  aria-label="Open tutor panel"
                  aria-expanded={panelOpen}
                  className="grid size-8 shrink-0 place-items-center rounded-lg border border-border/80 bg-card text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground md:hidden"
                >
                  ☰
                </button>

                <div className="min-w-0">
                  <h1 className="truncate font-heading text-sm font-semibold tracking-tight">
                    Live classroom
                  </h1>
                  <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
                    {modelLabel} · {mode} profile
                  </p>
                </div>

                <div className="ml-auto flex items-center gap-1.5">
                  <span
                    className={cx(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium',
                      streaming
                        ? 'border-primary/30 bg-primary/5 text-primary'
                        : 'border-emerald-600/20 bg-emerald-500/10 text-emerald-700'
                    )}
                  >
                    <span
                      className={cx(
                        'size-1.5 rounded-full',
                        streaming ? 'animate-pulse bg-primary' : 'bg-emerald-500'
                      )}
                    />
                    <span className="hidden sm:inline">{streaming ? 'Tutor writing' : 'Ready'}</span>
                  </span>

                  <span className="mx-0.5 h-5 w-px bg-border" />

                  <button
                    type="button"
                    onClick={skip}
                    title="Skip the remaining cues for this page"
                    className="rounded-lg border border-transparent px-2 py-1.5 text-[11px] text-muted-foreground transition hover:border-border/80 hover:bg-accent hover:text-foreground"
                  >
                    Skip cues
                  </button>
                  <button
                    type="button"
                    onClick={back}
                    title="Undo the board's last replace operation"
                    className="rounded-lg border border-transparent px-2 py-1.5 text-[11px] text-muted-foreground transition hover:border-border/80 hover:bg-accent hover:text-foreground"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    title="Clear the board and conversation"
                    className="rounded-lg border border-transparent px-2 py-1.5 text-[11px] text-muted-foreground transition hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  >
                    Reset
                  </button>
                </div>
              </header>

              <div className="relative min-h-0 flex-1 p-2 sm:p-3 lg:p-4">
                <div className="relative h-full overflow-hidden rounded-[1.75rem] border border-border/80 bg-card shadow-[0_24px_80px_-36px_rgba(15,42,66,0.45)] ring-1 ring-black/[0.02]">
                  <div ref={scrollRef} className="h-full overflow-y-auto">
                    <Board
                      store={board}
                      status={streaming ? 'thinking' : 'idle'}
                      camera="off"
                      ambience="auto"
                      pacing="cued"
                      onEvent={handleEvent}
                      classNames={{
                        root: 'min-h-full !border-0 !shadow-none',
                        content: 'max-w-4xl px-4 py-6 sm:px-8 sm:py-10',
                      }}
                    />
                  </div>

                  {beats.length > 0 && (
                    <div className="pointer-events-none absolute inset-x-2 bottom-[4.5rem] z-40 flex justify-center sm:inset-x-4 sm:bottom-4">
                      <div className="pointer-events-auto flex w-full max-w-xl items-center gap-1.5 rounded-2xl border border-border/80 bg-card/95 p-1.5 shadow-xl shadow-slate-900/5 backdrop-blur">
                        <button
                          type="button"
                          onClick={() => showBeat(beatIndex - 1)}
                          disabled={beatIndex <= 0}
                          aria-label="Previous page"
                          className="grid size-8 shrink-0 place-items-center rounded-lg border border-border/80 text-sm transition hover:bg-accent disabled:opacity-35"
                        >
                          ←
                        </button>

                        <div className="min-w-0 flex-1 px-1">
                          <div className="flex items-baseline justify-between gap-2 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                            <span className="shrink-0">
                              Page {Math.max(beatIndex, 0) + 1} / {beats.length}
                            </span>
                            <span className="truncate normal-case tracking-normal">
                              {beats[beatIndex]?.label}
                            </span>
                          </div>
                          <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => showBeat(beatIndex + 1)}
                          disabled={beatIndex >= beats.length - 1}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-35"
                        >
                          Continue
                          <span aria-hidden="true">→</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

          <DevtoolsOverlay store={board} registry={registry} title="live board" />
        </main>
      </BoardStoreProvider>
    </DreamerProvider>
  );
}
