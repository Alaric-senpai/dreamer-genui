/**
 * Live tutor endpoint for the `/app` playground route.
 *
 * The playground is the only place allowed to talk to a model: the library
 * itself never makes network calls. This route uses the Vercel AI SDK against
 * an OpenAI-compatible endpoint (Dahl inference by default) and streams raw
 * `Reply` JSON back to the client, which applies the ops to the board.
 *
 * Configuration lives in `apps/playground/.env.local`:
 *   DAHL_BASE_URL  default https://inference.dahl.global/v1
 *   DAHL_API_KEY   required
 *   DAHL_MODELS    comma-separated allowlist, first is the default
 *   DAHL_MODEL     optional explicit default
 *   DAHL_MAX_TOKENS / DAHL_TIMEOUT optional
 */
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText, type ModelMessage } from 'ai';
import { z } from 'zod';
import { createRegistry } from 'dreamer-genui/core';
import { getSystemPromptGuide } from 'dreamer-genui/core';

export const maxDuration = 120;

const registry = createRegistry();

const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(60_000),
      }),
    )
    .max(40)
    .default([]),
  board: z.string().max(120_000).optional(),
  mode: z.enum(['lesson', 'assessment']).optional(),
  model: z.string().max(200).optional(),
});

const BASE_URL =
  process.env.DAHL_BASE_URL ?? process.env.LLM_BASE_URL ?? 'https://inference.dahl.global/v1';
const API_KEY = process.env.DAHL_API_KEY ?? process.env.LLM_API_KEY ?? '';
const MODELS = (process.env.DAHL_MODELS ?? process.env.LLM_MODELS ?? '')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);
const EXPLICIT_DEFAULT = process.env.DAHL_MODEL ?? process.env.LLM_MODEL;
const DEFAULT_MODEL = EXPLICIT_DEFAULT ?? MODELS[0] ?? 'MiniMaxAI/MiniMax-M2.7';
const MAX_TOKENS = Number(process.env.DAHL_MAX_TOKENS ?? process.env.LLM_MAX_TOKENS ?? 4096);
const TIMEOUT_SECONDS = Number(process.env.DAHL_TIMEOUT ?? process.env.LLM_TIMEOUT ?? 120);

const provider = createOpenAICompatible({
  name: 'dahl',
  baseURL: BASE_URL,
  apiKey: API_KEY,
});

/** Extra instructions for the live demo: one JSON object, no prose. */
const LIVE_CONTRACT = `## Live playground contract

You are driving a **live** dreamer-genui board in a browser. Reply with **exactly one JSON object** and nothing else — no prose, no markdown fences, no commentary:

{"v":1,"ops":[...]}

Rules for this live session:
- Choose **fresh, short node ids** that do not collide with the current board outline (for example: beat-1, beat-2 …). The outline below lists every id already used.
- Prefer **append** with 1–4 small blocks per turn: the student should see the next beat, not a whole lesson at once.
- Give every figure and plugin node a plain-text \`alt\`.
- Use \`enter: { trigger: { on: "cue", id: "..." } }\` for beats that follow your narration, and reuse one cue id per beat. The playground fires the cues in order after each turn.
- Choose a layout deliberately (\`split\` to put an explanation next to a question; a \`layout\` op when a question appears).
- Stay generic: any subject is fine. Keep metadata (title, ids, labels) short.
- Never include answer keys in assessment payloads.
- When the student answers a question, respond with \`update\` or follow-up blocks — do not repeat the whole board.
`;

export async function POST(request: Request): Promise<Response> {
  if (!API_KEY) {
    return Response.json(
      {
        error:
          'Missing DAHL_API_KEY. Copy the LLM credentials into apps/playground/.env.local (see .env.example).',
      },
      { status: 500 },
    );
  }

  let parsed: z.infer<typeof BodySchema>;
  try {
    parsed = BodySchema.parse(await request.json());
  } catch (error) {
    return Response.json({ error: `Invalid request: ${String(error)}` }, { status: 400 });
  }

  const requested = parsed.model && MODELS.length > 0 && MODELS.includes(parsed.model)
    ? parsed.model
    : DEFAULT_MODEL;

  const mode = parsed.mode ?? 'lesson';
  const guide = getSystemPromptGuide(registry, { profile: mode });
  const system = [
    guide,
    LIVE_CONTRACT,
    `## Current board outline\n\n${parsed.board?.trim() || '(empty board)'}`,
  ].join('\n\n');

  const messages: ModelMessage[] = parsed.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  const abortSignal = AbortSignal.timeout(Math.max(5, TIMEOUT_SECONDS) * 1000);

  try {
    const result = streamText({
      model: provider(requested),
      system,
      messages,
      maxOutputTokens: MAX_TOKENS,
      abortSignal,
    });

    return result.toTextStreamResponse({
      headers: {
        'cache-control': 'no-store',
        'x-dg-model': requested,
      },
    });
  } catch (error) {
    return Response.json(
      { error: `The tutor request failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 502 },
    );
  }
}
