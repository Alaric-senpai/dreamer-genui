import type { BoardState, Detour } from '../types';

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

function serializeNodes(nodes: BoardState['nodes']): string {
  const lines: string[] = [];
  for (const [id, node] of Object.entries(nodes)) {
    const block = node.block as { type?: string; variant?: string; content?: unknown[] };
    const label = block.type === 'text'
      ? String((block.content as string[])?.[0] ?? '').slice(0, 40)
      : undefined;
    lines.push(`  ${nodeLabel(id, block.type ?? '?', label)}`);
  }
  return lines.join('\n');
}

function serializeDetour(d: Detour, depth: number): string {
  const prefix = '  '.repeat(depth + 1);
  const blockCount = d.blocks.length;
  return `${prefix}→ Detour at "${d.targetNodeId}" (depth ${depth}): ${blockCount} block(s)`;
}

/** Compact board outline for the tutor's next-turn context. */
export function serializeBoard(state: BoardState): string {
  const parts: string[] = [];

  parts.push(`Board: ${state.id}${state.title ? ` "${state.title}"` : ''}`);
  parts.push(`Nodes: ${Object.keys(state.nodes).length}`);
  parts.push(serializeNodes(state.nodes));

  if (state.detours.length > 0) {
    parts.push('Open detours:');
    state.detours.forEach((d, i) => {
      parts.push(serializeDetour(d, i));
    });
  }

  if (state.history.length > 0) {
    parts.push(`History: ${state.history.length} snapshot(s)`);
  }

  return parts.join('\n');
}
