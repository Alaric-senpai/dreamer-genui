import { z } from 'zod';

/**
 * One spoken beat of a lesson turn (§6.17). Beat ids are cue ids: a node with
 * `trigger: { on: "cue", id: "b1" }` enters when beat `b1` starts. Text may
 * contain inline markers such as `[[cue:w1]]`, which fire at their position.
 */
export const BeatSchema = z.object({
  id: z.string().min(1).max(64),
  text: z.string().min(1).max(8_000),
  /** BCP-47 language tag for this beat. */
  lang: z.string().min(1).max(35).optional(),
  /** A registered voice/profile name; provider-defined. */
  voice: z.string().min(1).max(64).optional(),
  /** Delivery hint such as "calm" or "serious"; providers map or ignore it. */
  style: z.string().min(1).max(64).optional(),
  pauseAfterMs: z.number().min(0).max(30_000).optional(),
});
export type Beat = z.infer<typeof BeatSchema>;

/** The inline cue marker grammar the library strips before synthesis (§6.17). */
export const CUE_MARKER_PATTERN = /\[\[cue:([^\]\s]+)\]\]/g;

export interface CueMarker {
  cueId: string;
  /** Character offset of the marker in the original text. */
  index: number;
}

/** Extract inline `[[cue:id]]` markers in text order (§6.17). */
export function parseCueMarkers(text: string): CueMarker[] {
  const markers: CueMarker[] = [];
  for (const match of text.matchAll(CUE_MARKER_PATTERN)) {
    markers.push({ cueId: match[1]!, index: match.index ?? 0 });
  }
  return markers;
}

/** Remove inline cue markers before synthesis or caption display (§6.17). */
export function stripCueMarkers(text: string): string {
  return text.replace(CUE_MARKER_PATTERN, '').replace(/\s{2,}/g, ' ').trim();
}

export interface BeatsParseResult {
  beats: Beat[];
  /** Human-readable reason when the narration block is malformed. */
  error?: string;
}

/**
 * Validate a turn's narration block. Beat ids must be unique per turn (§6.17);
 * malformed beats yield `turn-invalid` in the resolver.
 */
export function parseBeats(raw: unknown): BeatsParseResult {
  if (raw === undefined) return { beats: [] };
  const parsed = z.array(BeatSchema).safeParse(raw);
  if (!parsed.success) {
    return { beats: [], error: parsed.error.issues[0]?.message ?? 'Invalid narration beats' };
  }
  const seen = new Set<string>();
  for (const beat of parsed.data) {
    if (seen.has(beat.id)) return { beats: [], error: `Duplicate beat id: ${beat.id}` };
    seen.add(beat.id);
  }
  return { beats: parsed.data };
}
