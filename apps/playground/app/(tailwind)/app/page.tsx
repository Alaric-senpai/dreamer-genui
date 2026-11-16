'use client';

/**
 * `/app` — the live playground route.
 *
 * Connects the board to a real tutor through the Vercel AI SDK (see
 * `app/api/tutor/route.ts`). The model streams a `Reply` JSON object; this
 * page extracts complete ops as they arrive, applies them to the board
 * (`applyPartial`), validates the final reply and fires its cues in order so
 * entrance animations follow the "narration".
 *
 * Everything is playground code: the library itself never talks to a model.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Board,
  DreamerProvider,
  createBoardStore,
  useBoardVersion,
  type Reply,
  type UIEvent,
} from 'dreamer-genui';
import {
  createRegistry,
  serializeBoard,
  type LibraryError,
} from 'dreamer-genui/core';
import { BlockSchema, ReplySchema } from 'dreamer-genui/schema';

const registry = createRegistry();

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

/** Remove inline reasoning tags some models emit (MiniMax M2.7 does). */
function tidy(text: string): string {
  let out = text.replace(/<think[\s\S]*?<\/think>/gi, '');
  const open = out.search(/<think\b/i);
  if (open !== -1) out = out.slice(0, open);
  out = out.replace(/```(?:json)?/gi, '').replace(/```/g, '');
  return out;
}

/** Pull every complete top-level op object out of a partially streamed `ops` array. */
function extractOps(text: string): unknown[] {
  const opsKey = text.search(/"ops"\s*:/);
  if (opsKey === -1) return [];
  const arrayStart = text.indexOf('[', opsKey);
  if (arrayStart === -1) return [];

  const ops: unknown[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;

  for (let i = arrayStart + 1; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (char === '\\') escape = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }
    if (char === '}') {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        try {
          ops.push(JSON.parse(text.slice(start, i + 1)));
        } catch {
          // Not complete yet — wait for more chunks.
        }
        start = -1;
      }
      continue;
    }
    if (char === ']' && depth === 0) break;
  }
  return ops;
}

const ENTER_EFFECT_ALIASES: Record<string, string> = {
  fade: 'reveal',
  'fade-in': 'reveal',
  fadeIn: 'reveal',
  appear: 'reveal',
  'slide-in': 'rise',
  'slide-up': 'rise',
  slide: 'rise',
  'zoom-in': 'zoom',
  grow: 'pop',
  'pop-in': 'pop',
};

/** Models sometimes use exit effects (fade) for entrances; map known aliases. */
function repairEffects(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) repairEffects(item);
    return;
  }
  const record = value as Record<string, unknown>;
  const enter = record.enter;
  if (enter && typeof enter === 'object') {
    const enterRecord = enter as Record<string, unknown>;
    const effect = enterRecord.effect;
    if (typeof effect === 'string' && ENTER_EFFECT_ALIASES[effect]) {
      enterRecord.effect = ENTER_EFFECT_ALIASES[effect];
    }
  }
  for (const key of ['blocks', 'items', 'sections', 'questions', 'cards']) {
    if (Array.isArray(record[key])) repairEffects(record[key]);
  }
}

/**
 * Playground-only tolerance: drop blocks the library schema cannot render
 * (for example a figure missing its figure object) instead of failing the
 * whole turn. The library itself stays strict; this keeps the live demo alive.
 */
function repairOp(value: unknown): unknown {
  repairEffects(value);
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.blocks)) return value;
  record.blocks = record.blocks
    .map((block) => {
      repairEffects(block);
      if (block && typeof block === 'object') {
        const blockRecord = block as Record<string, unknown>;
        if (Array.isArray(blockRecord.blocks)) {
          blockRecord.blocks = blockRecord.blocks
            .map(repairOp)
            .filter((child) => BlockSchema.safeParse(child).success);
        }
      }
      return block;
    })
    .filter((block) => BlockSchema.safeParse(block).success);
  return value;
}

function repairReply(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.ops)) record.ops = record.ops.map(repairOp);
  return value;
}

type CueTarget = { on?: unknown; id?: unknown };

function pushCue(trigger: CueTarget | undefined, out: string[]): void {
  if (trigger && trigger.on === 'cue' && typeof trigger.id === 'string' && trigger.id.trim()) {
    out.push(trigger.id.trim());
  }
}

function collectCues(value: unknown, out: string[]): void {
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  const enter = record.enter as Record<string, unknown> | undefined;
  if (enter) pushCue(enter.trigger as CueTarget | undefined, out);

  if (Array.isArray(record.blocks)) for (const block of record.blocks) collectCues(block, out);
  if (Array.isArray(record.items)) for (const item of record.items) collectCues(item, out);
  if (Array.isArray(record.sections)) for (const section of record.sections) collectCues(section, out);
  if (Array.isArray(record.questions)) for (const question of record.questions) collectCues(question, out);

  if (record.op === 'camera') pushCue(record.trigger as CueTarget | undefined, out);
}

function cuesOf(reply: Reply): string[] {
  const cues: string[] = [];
  for (const op of reply.ops) collectCues(op, cues);
  return Array.from(new Set(cues));
}

export default function LiveDemonstrationApp() {
  const [board] = useState(() => createBoardStore({ registry }));
  useBoardVersion(board);

  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState<string>(MODELS[0]);
  const [mode, setMode] = useState<Mode>('lesson');
  const [streaming, setStreaming] = useState(false);
  const [autoReply, setAutoReply] = useState(true);
  const [rawPreview, setRawPreview] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<UIEvent[]>([]);
  const [errors, setErrors] = useState<LibraryError[]>([]);
  const [cues, setCues] = useState<string[]>([]);

  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const streamingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const timersRef = useRef<number[]>([]);
  const chatIdRef = useRef(0);

  const clearCueTimers = useCallback(() => {
    for (const timer of timersRef.current) window.clearTimeout(timer);
    timersRef.current = [];
  }, []);

  useEffect(() => () => {
    clearCueTimers();
    abortRef.current?.abort();
  }, [clearCueTimers]);

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
          setCues((prev) => [...prev, cueId]);
        }, 450 + index * 900);
        timersRef.current.push(timer);
      });
    },
    [board, clearCueTimers]
  );

  const send = useCallback(
    async (text: string) => {
      const prompt = text.trim();
      if (!prompt || streamingRef.current) return;

      streamingRef.current = true;
      setStreaming(true);
      setError(null);
      setRawPreview('');
      pushChat({ role: 'user', text: prompt });

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
        let opCount = 0;

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          raw += decoder.decode(value, { stream: true });
          const ops = extractOps(tidy(raw)).map(repairOp);
          if (ops.length > opCount) {
            const fresh = ops.slice(opCount);
            opCount = ops.length;
            board.applyPartial({ v: 1, ops: fresh as Reply['ops'] });
          }
          setRawPreview(tidy(raw).slice(-1200));
        }
        raw += decoder.decode();

        const finalText = tidy(raw).trim();
        const first = finalText.indexOf('{');
        const last = finalText.lastIndexOf('}');
        if (first === -1 || last <= first) throw new Error('The tutor did not return a JSON reply.');

        const jsonText = finalText.slice(first, last + 1);
        let reply: Reply;
        try {
          reply = ReplySchema.parse(repairReply(JSON.parse(jsonText))) as Reply;
        } catch (parseError) {
          // Keep whatever complete ops did stream in, then report the mismatch.
          if (opCount > 0) {
            board.applyFinal({ v: 1, ops: extractOps(finalText).map(repairOp) as Reply['ops'] });
          }
          throw new Error(
            `Invalid reply from the tutor: ${
              parseError instanceof Error ? parseError.message : String(parseError)
            }`,
          );
        }

        board.applyFinal(reply);
        const cueIds = cuesOf(reply);
        narrate(cueIds);
        historyRef.current = [
          ...historyRef.current,
          { role: 'assistant' as const, content: jsonText },
        ].slice(-24);

        pushChat({
          role: 'assistant',
          text: `Board updated — ${reply.ops.length} op${reply.ops.length === 1 ? '' : 's'}${
            cueIds.length ? `, ${cueIds.length} cue${cueIds.length === 1 ? '' : 's'}` : ''
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
    [board, mode, model, narrate, pushChat]
  );

  const sendRef = useRef(send);
  sendRef.current = send;

  const handleEvent = useCallback(
    (event: UIEvent) => {
      setEvents((prev) => [...prev.slice(-49), event]);
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
    clearCueTimers();
    board.reset();
    historyRef.current = [];
    setChat([]);
    setEvents([]);
    setErrors([]);
    setCues([]);
    setRawPreview('');
    setError(null);
  };

  const skip = () => {
    clearCueTimers();
    board.flush();
  };

  return (
    <DreamerProvider registry={registry} colorScheme="auto">
      <main className="min-h-dvh bg-background text-foreground">
        <header className="mx-auto flex max-w-[1500px] flex-wrap items-end justify-between gap-3 px-4 pt-5">
          <div>
            <Link href="/" className="text-xs text-muted-foreground underline underline-offset-4">
              ← playground index
            </Link>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              Live board app
            </h1>
            <p className="text-sm text-muted-foreground">
              The board is driven by a real tutor over the Dahl inference endpoint. Ask for a lesson
              and watch it write itself, beat by beat.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">Model</span>
              <select
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="rounded-md border border-border bg-card px-2 py-1"
              >
                {MODELS.map((name) => (
                  <option key={name} value={name}>
                    {name.split('/').pop()}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">Profile</span>
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as Mode)}
                className="rounded-md border border-border bg-card px-2 py-1"
              >
                <option value="lesson">lesson</option>
                <option value="assessment">assessment</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-muted-foreground">
              <input
                type="checkbox"
                checked={autoReply}
                onChange={(event) => setAutoReply(event.target.checked)}
              />
              auto-respond to answers
            </label>
          </div>
        </header>

        <div className="mx-auto grid max-w-[1500px] gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_400px]">
          <section aria-label="live board" className="relative min-h-[62vh] min-w-0 lg:min-h-[calc(100dvh-8rem)]">
            <Board
              store={board}
              camera="auto"
              ambience="auto"
              pacing="cued"
              onEvent={handleEvent}
              onError={(err) => setErrors((prev) => [...prev.slice(-49), err])}
              classNames={{
                root: 'h-full rounded-2xl ring-1 ring-border shadow-sm',
                content: 'max-w-3xl',
              }}
            />
            <div className="absolute right-3 top-3 flex gap-2 text-xs">
              <button
                type="button"
                onClick={skip}
                className="rounded-md border border-border bg-card px-2 py-1 shadow-sm hover:bg-accent"
              >
                Skip cues
              </button>
              <button
                type="button"
                onClick={() => board.back()}
                className="rounded-md border border-border bg-card px-2 py-1 shadow-sm hover:bg-accent"
              >
                Back
              </button>
              <button
                type="button"
                onClick={reset}
                className="rounded-md border border-border bg-card px-2 py-1 shadow-sm hover:bg-accent"
              >
                Reset
              </button>
            </div>
            {streaming && (
              <p className="absolute bottom-3 left-3 rounded-full border border-border bg-card px-3 py-1 text-xs shadow-sm">
                Tutor is writing…
              </p>
            )}
          </section>

          <aside aria-label="tutor chat" className="flex min-h-0 flex-col gap-3">
            <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {QUICK_STARTS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    disabled={streaming}
                    onClick={() => {
                      setInput(starter);
                    }}
                    className="rounded-full border border-border px-2.5 py-1 text-[11px] leading-tight text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
                  >
                    {starter.split('.')[0]}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const value = input;
                  setInput('');
                  void send(value);
                }}
                className="flex flex-col gap-2"
              >
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      const value = input;
                      setInput('');
                      void send(value);
                    }
                  }}
                  rows={3}
                  placeholder="Ask for a lesson, a question, a diagram, a mood shift…"
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    Enter to send · Shift+Enter for a new line
                  </span>
                  <button
                    type="submit"
                    disabled={streaming || !input.trim()}
                    className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                  >
                    {streaming ? 'Writing…' : 'Send'}
                  </button>
                </div>
              </form>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}

            <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border bg-card p-3 shadow-sm">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Conversation
              </h2>
              {chat.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing yet. Try one of the starters above.
                </p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {chat.map((entry) => (
                    <li
                      key={entry.id}
                      className={
                        entry.role === 'user'
                          ? 'ml-6 rounded-xl bg-accent px-3 py-2 text-sm'
                          : 'mr-2 rounded-xl border border-border px-3 py-2 text-sm'
                      }
                    >
                      <p className="whitespace-pre-wrap">{entry.text}</p>
                      {entry.detail && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-[11px] text-muted-foreground">
                            view reply JSON
                          </summary>
                          <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-[10px] leading-snug">
                            {entry.detail}
                          </pre>
                        </details>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <details className="rounded-2xl border border-border bg-card p-3 text-xs shadow-sm">
              <summary className="cursor-pointer font-semibold text-muted-foreground">
                Debug: cues, events, errors, stream
              </summary>
              <div className="mt-2 grid gap-2">
                <p>
                  <strong>Cues fired:</strong> {cues.length ? cues.join(', ') : '—'}
                </p>
                <p>
                  <strong>Events:</strong> {events.length ? JSON.stringify(events.slice(-3)) : '—'}
                </p>
                <p>
                  <strong>Errors:</strong>{' '}
                  {errors.length ? JSON.stringify(errors.slice(-2)) : '—'}
                </p>
                <pre className="max-h-40 overflow-auto rounded bg-muted p-2 text-[10px] leading-snug">
                  {rawPreview || 'No stream yet.'}
                </pre>
              </div>
            </details>
          </aside>
        </div>
      </main>
    </DreamerProvider>
  );
}
