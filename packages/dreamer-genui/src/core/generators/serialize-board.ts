import type { BoardState, Detour } from '../types';
import type { LayoutSpec } from '../../schema/layout';
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
  list: 'list',
  compare: 'compare',
  flashcards: 'flashcards',
  question: 'question',
  assessment: 'assessment',
};

function nodeLabel(id: string, type: string, label?: string): string {
  const t = BLOCK_TYPE_LABELS[type] ?? type;
  return label ? `${id} [${t}] "${label}"` : `${id} [${t}]`;
}

function nodeItemList(id: string, type: string, block: { type?: string; items?: unknown; columns?: unknown }): string | undefined {
  const list = (arr: unknown): string[] | undefined =>
    Array.isArray(arr) ? arr.map((it: unknown) => (typeof it === 'object' && it !== null && 'id' in it ? String((it as { id: unknown }).id) : undefined)).filter((s): s is string => s !== undefined) : undefined;
  if (type === 'choices' || type === 'steps' || type === 'list' || type === 'flashcards' || type === 'ordering') {
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
  const head = `${prefix}→ Detour at "${d.targetNodeId}" (depth ${depth}, ${d.placement}/${d.mode}${d.connector !== 'none' ? `, ${d.connector}` : ''})${d.theme?.mood ? ` [mood: ${d.theme.mood}]` : ''}:`;
  // Detour block ids are real NodeIds — emit them so the tutor can reference,
  // update or remove them next turn.
  const blocks = d.blocks.map(b => {
    const type = b.type;
    return `${prefix}    ${b.id} [${type}]`;
  });
  return [head, ...blocks].join('\n');
}

/** One-line layout summary: kind plus only the options that were authored. */
function serializeLayout(layout: LayoutSpec): string {
  const bits: string[] = [];
  if (layout.kind === 'flow') {
    if (layout.gap) bits.push(`gap: ${layout.gap}`);
    if (layout.align) bits.push(`align: ${layout.align}`);
  } else if (layout.kind === 'split') {
    if (layout.sides) bits.push(`sides: ${layout.sides}`);
    if (layout.ratio) bits.push(`ratio: ${layout.ratio}`);
    if (layout.gap) bits.push(`gap: ${layout.gap}`);
    if (layout.narrow) bits.push(`narrow: ${layout.narrow}`);
    if (layout.narrowOrder) bits.push(`narrowOrder: ${layout.narrowOrder}`);
    if (layout.pin) bits.push(`pin: ${layout.pin}`);
  } else if (layout.kind === 'grid') {
    if (layout.columns) bits.push(`columns: ${layout.columns}`);
    if (layout.gap) bits.push(`gap: ${layout.gap}`);
    if (layout.narrowColumns) bits.push(`narrowColumns: ${layout.narrowColumns}`);
  } else {
    if (layout.regions) bits.push(`regions: ${layout.regions.join(',')}`);
    if (layout.narrow) bits.push(`narrow: ${layout.narrow}`);
  }
  return bits.length ? `${layout.kind} (${bits.join(', ')})` : layout.kind;
}

function questionCount(state: BoardState, assessmentId: string): number | undefined {
  const node = state.nodes[assessmentId];
  const block = node?.block as { type?: string; sections?: { questions?: unknown[] }[] } | undefined;
  if (!block || block.type !== 'assessment' || !Array.isArray(block.sections)) return undefined;
  return block.sections.reduce(
    (sum, section) => sum + (Array.isArray(section.questions) ? section.questions.length : 0),
    0,
  );
}

/** Assessment mode, progress and timer so the tutor knows what is on screen (§10.3). */
function serializeAssessments(state: BoardState): string[] {
  const lines: string[] = [];
  for (const [id, assessment] of Object.entries(state.assessments)) {
    const total = questionCount(state, id);
    const answered = Object.keys(assessment.answers).length;
    const bits = [
      `mode: ${assessment.mode}`,
      total !== undefined ? `${answered}/${total} answered` : `${answered} answered`,
    ];
    if (assessment.flags.length) bits.push(`${assessment.flags.length} flagged`);
    if (assessment.currentQuestionId) bits.push(`current: ${assessment.currentQuestionId}`);
    if (assessment.submittedAt) bits.push('submitted');
    if (assessment.timerRemainingMs !== undefined) bits.push(`timer: ${Math.ceil(assessment.timerRemainingMs / 1000)}s`);
    lines.push(`  ${id} [assessment]: ${bits.join(', ')}`);
  }
  return lines;
}

interface Model3DLike {
  kind?: string;
  model?: string;
  view?: unknown;
  highlight?: string[];
  isolate?: string[];
  dim?: string[] | 'others';
  objects?: unknown[];
}

function describeView(view: unknown): string | undefined {
  if (typeof view === 'string') return view;
  if (typeof view === 'object' && view !== null) {
    const v = view as { view?: string; focus?: string };
    if (v.view) return v.view;
    if (v.focus) return `focus:${v.focus}`;
  }
  return undefined;
}

function modelSummary(id: string, figure: Model3DLike): string | undefined {
  if (figure.kind === 'model3d') {
    const bits: string[] = [];
    if (figure.model) bits.push(`model: ${figure.model}`);
    const view = describeView(figure.view);
    if (view) bits.push(`view: ${view}`);
    if (figure.highlight?.length) bits.push(`highlight: ${figure.highlight.join(',')}`);
    if (figure.isolate?.length) bits.push(`isolate: ${figure.isolate.join(',')}`);
    if (figure.dim?.length) bits.push(`dim: ${figure.dim === 'others' ? 'others' : figure.dim.join(',')}`);
    return `  ${id} [model3d]: ${bits.join(', ') || 'no directives'}`;
  }
  if (figure.kind === 'scene3d') {
    const count = Array.isArray(figure.objects) ? figure.objects.length : 0;
    return `  ${id} [scene3d]: ${count} object${count === 1 ? '' : 's'}`;
  }
  return undefined;
}

/** Models in use, from board nodes and open detours (§6.16). */
function serializeModels(state: BoardState): string[] {
  const lines: string[] = [];
  const scan = (nodeId: string, block: unknown, prefix = '') => {
    const b = block as { type?: string; figure?: Model3DLike };
    if (b?.type !== 'figure' || !b.figure) return;
    const summary = modelSummary(`${prefix}${nodeId}`, b.figure);
    if (summary) lines.push(summary);
  };
  for (const [id, node] of Object.entries(state.nodes)) scan(id, node.block);
  for (const detour of state.detours) {
    for (const block of detour.blocks) scan(block.id, block, `detour:${detour.id}/`);
  }
  return lines;
}

/** Compact board outline for the tutor's next-turn context (§10.3). */
export function serializeBoard(state: BoardState): string {
  const parts: string[] = [];
  const entry = computeEntryPlan(state);

  parts.push(`Board: ${state.id}${state.title ? ` "${state.title}"` : ''}`);
  parts.push(`Layout: ${serializeLayout(state.layout)}`);

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

  const assessments = serializeAssessments(state);
  if (assessments.length) {
    parts.push('Assessments:');
    parts.push(...assessments);
  }

  const models = serializeModels(state);
  if (models.length) {
    parts.push('Models in use:');
    parts.push(...models);
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
