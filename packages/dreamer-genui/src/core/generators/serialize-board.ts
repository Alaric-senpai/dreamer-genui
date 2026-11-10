import type { BoardState, Detour } from '../types';
import { computeEntryPlan } from '../cues';

const BLOCK_TYPE_LABELS: Record<string, string> = {
  text: 'text',
  figure: 'figure',
  choices: 'choices',
  steps: 'steps',
  callout: 'callout',
  group: 'group',
  table: 'table',
  math: 'math',
  code: 'code',
};

function nodeLabel(id: string, type: string, label?: string): string {
  const t = BLOCK_TYPE_LABELS[type] ?? type;
  return label ? `${id} [${t}] "${label}"` : `${id} [${t}]`;
}

function nodeItemList(id: string, type: string, block: { type?: string; items?: unknown; columns?: unknown }): string | undefined {
  const list = (arr: unknown): string[] | undefined =>
    Array.isArray(arr) ? arr.map((it: unknown) => (typeof it === 'object' && it !== null && 'id' in it ? String((it as { id: unknown }).id) : undefined)).filter((s): s is string => s !== undefined) : undefined;
  if (type === 'choices' || type === 'steps') {
    const items = list(block.items);
    if (items && items.length) return `${id}/${items.join(` ${id}/`)}`;
  }
  if (type === 'table') {
    const cols = list(block.columns);
    if (cols && cols.length) return `columns: ${cols.join(' ')}`;
  }
  return undefined;
}

function serializeDetour(d: Detour, depth: number): string {
  const prefix = '  '.repeat(depth + 1);
  const head = `${prefix}→ Detour at "${d.targetNodeId}" (depth ${depth})${d.theme?.mood ? ` [mood: ${d.theme.mood}]` : ''}:`;
  // Detour block ids are real NodeIds — emit them so the tutor can reference,
  // update or remove them next turn.
  const blocks = d.blocks.map(b => {
    const type = b.type;
    return `${prefix}    ${b.id} [${type}]`;
  });
  return [head, ...blocks].join('\n');
}

/** Compact board outline for the tutor's next-turn context (§8.3). */
export function serializeBoard(state: BoardState): string {
  const parts: string[] = [];
  const entry = computeEntryPlan(state);

  parts.push(`Board: ${state.id}${state.title ? ` "${state.title}"` : ''}`);

  // Theme summary (mood, ambience, surface — tokens stay out of the outline)
  const themeBits: string[] = [];
  if (state.theme?.mood) themeBits.push(`mood: ${state.theme.mood}`);
  if (state.theme?.ambience) themeBits.push(`ambience: ${state.theme.ambience.preset}`);
  if (state.theme?.surface) themeBits.push(`surface: ${state.theme.surface}`);
  parts.push(`Theme: ${themeBits.length ? themeBits.join(', ') : 'default'}`);

  // Entered vs pending so the tutor knows what the student has seen
  const pendingIds = new Set(entry.pending);
  parts.push(`Nodes: ${Object.keys(state.nodes).length} (entered ${entry.entered.length}, pending ${entry.pending.length})`);
  for (const [id, node] of Object.entries(state.nodes)) {
    const block = node.block as { type?: string; variant?: string; content?: unknown[]; items?: unknown; columns?: unknown };
    const label = block.type === 'text'
      ? String((block.content as string[])?.[0] ?? '').slice(0, 40)
      : undefined;
    const items = nodeItemList(id, block.type ?? '?', block);
    const status = pendingIds.has(id) ? ' (pending)' : '';
    parts.push(`  ${nodeLabel(id, block.type ?? '?', label)}${status}${items ? ` (${items})` : ''}`);
  }

  if (entry.pendingCues.length > 0) {
    parts.push(`Pending cues: ${entry.pendingCues.join(' ')}`);
  }

  if (state.detours.length > 0) {
    parts.push('Open detours:');
    state.detours.forEach((d, i) => {
      parts.push(serializeDetour(d, i));
    });
  }

  if (state.history.length > 0) {
    const titles = state.history.map(s => `"${s.title ?? 'untitled'}"`);
    parts.push(`History: ${state.history.length} snapshot(s): ${titles.join(' → ')}`);
  }

  return parts.join('\n');
}
