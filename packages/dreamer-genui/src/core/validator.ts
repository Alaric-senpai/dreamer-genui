import type { LibraryError, BoardState } from './types';
import { createError } from './errors';
import { OpSchema } from '../schema/ops';
import type { Op } from '../schema/ops';
import type { Block } from '../schema/blocks';
import type { QuestionBlock } from '../schema/question';
import type { AssessmentBlock, AssessmentMode } from '../schema/assessment';
import type { FlowchartFigure, Figure } from '../schema/figures';
import type { NodeId, NodeRef } from '../schema/common';

export interface ValidationResult {
  valid: boolean;
  error?: LibraryError;
  op?: Op;
  /** Non-fatal issues (e.g. cue-cycle rewritten to start) — applied, reported. */
  warnings?: LibraryError[];
}

/** Max detour nesting depth (0 = first detour, 1 = nested, 2 = second nested). */
export const MAX_DETOUR_DEPTH = 2;

/**
 * Resolve a NodeRef to a NodeId.
 *
 * NodeRef is either a plain node id or a `parentId/itemId` reference to an item
 * inside a node (e.g. `branches/botany`). Item contents are not modelled in the
 * board state (they live on the component in M3+), so an item ref resolves to
 * its parent node — and only if that parent actually exists, so a bogus parent
 * is rejected with `bad-target` instead of silently succeeding.
 */
export function resolveNodeRef(state: BoardState, ref: NodeRef): string | null {
  if (ref.includes('/')) {
    const parts = ref.split('/');
    const parent = parts[0];
    if (parent && !parent.includes('/') && parent in state.nodes) {
      return parent;
    }
    return null;
  }
  return ref in state.nodes ? ref : null;
}

/**
 * Check that every block id is unique: within the op itself, against existing
 * nodes, and against ids already used by open detour blocks.
 * AGENTS 6.1: "NodeId: short tutor-authored string, unique per board."
 */
function checkDuplicateIds(state: BoardState, blocks: readonly { id: string }[]): LibraryError | undefined {
  const seen = new Set<string>();
  for (const detour of state.detours) {
    for (const b of detour.blocks) seen.add(b.id);
  }
  for (const block of blocks) {
    if (block.id in state.nodes || seen.has(block.id)) {
      return createError('duplicate-id', `Duplicate node id: ${block.id}`, block.id);
    }
    seen.add(block.id);
  }
  return undefined;
}

/**
 * Validate a single op against the current board state.
 * Returns ValidationResult — if valid, pass through; if not, attach the error.
 * `after`-trigger cycles inside an op are non-fatal: affected triggers are
 * rewritten to `start` and a `cue-cycle` warning is attached (§6.3).
 */
export function validateOp(state: BoardState, rawOp: unknown): ValidationResult {
  // 1. Schema parse
  const parsed = OpSchema.safeParse(rawOp);
  if (!parsed.success) {
    return { valid: false, error: createError('invalid-node', parsed.error.message) };
  }
  const op = parsed.data as Op;

  switch (op.op) {
    case 'append': {
      const dup = checkDuplicateIds(state, op.blocks);
      if (dup) return { valid: false, error: dup };
      const semantic = checkBlockSemantics(op.blocks);
      if (semantic) return { valid: false, error: semantic };
      const { op: rewritten, warnings } = breakAfterCycles(op);
      return { valid: true, op: rewritten, warnings: warnings.length ? warnings : undefined };
    }

    case 'attach': {
      // Check target exists
      const targetId = resolveNodeRef(state, op.to);
      if (!targetId) {
        return { valid: false, error: createError('bad-target', `Target node not found: ${op.to}`, undefined, op.to) };
      }
      // Check depth
      if (state.detours.length >= MAX_DETOUR_DEPTH) {
        return { valid: false, error: createError('depth-exceeded', `Max detour depth (${MAX_DETOUR_DEPTH}) exceeded`, op.to) };
      }
      const dup = checkDuplicateIds(state, op.blocks);
      if (dup) return { valid: false, error: dup };
      const semantic = checkBlockSemantics(op.blocks);
      if (semantic) return { valid: false, error: semantic };
      const { op: rewritten, warnings } = breakAfterCycles(op);
      return { valid: true, op: rewritten, warnings: warnings.length ? warnings : undefined };
    }

    case 'replace': {
      const dup = checkDuplicateIds(state, op.blocks);
      if (dup) return { valid: false, error: dup };
      const semantic = checkBlockSemantics(op.blocks);
      if (semantic) return { valid: false, error: semantic };
      const { op: rewritten, warnings } = breakAfterCycles(op);
      return { valid: true, op: rewritten, warnings: warnings.length ? warnings : undefined };
    }

    case 'update': {
      if (!(op.id in state.nodes)) {
        return { valid: false, error: createError('invalid-node', `Node not found for update: ${op.id}`, op.id) };
      }
      return { valid: true, op };
    }

    case 'remove': {
      if (!(op.id in state.nodes)) {
        return { valid: false, error: createError('invalid-node', `Node not found for remove: ${op.id}`, op.id) };
      }
      return { valid: true, op };
    }

    // theme/camera ops are presentation-level (§6.8/§6.10); validity comes
    // from the schema parse above. Theme policy enforcement (allowlists,
    // contrast) lives in the theme resolver (M2 core).
    case 'theme':
    case 'camera':
    case 'layout':
      // TODO(M4b-B3): validate slots against the active layout regions.
      return { valid: true, op };
  }
}

/** Blocks from append/attach/replace ops — they all carry `blocks`. */
function opBlocks(op: Op): Block[] | undefined {
  return op.op === 'append' || op.op === 'attach' || op.op === 'replace' ? op.blocks : undefined;
}

// ---------------------------------------------------------------------------
// Semantic validation (§6.8, §6.15). The schema catches shapes; these rules
// catch relationships the schema cannot express on its own.
// ---------------------------------------------------------------------------

interface BlankHit {
  id: string;
  path: string[];
}

/** Find every `{ mark: "blank" }` in a value, with the key path that led to it. */
function collectBlanks(value: unknown, path: string[] = [], hits: BlankHit[] = []): BlankHit[] {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectBlanks(item, [...path, String(index)], hits));
    return hits;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (record.mark === 'blank' && typeof record.id === 'string') {
      hits.push({ id: record.id, path });
    }
    for (const [key, child] of Object.entries(record)) {
      collectBlanks(child, [...path, key], hits);
    }
  }
  return hits;
}

function checkBlockSemantics(blocks: readonly Block[]): LibraryError | undefined {
  for (const block of blocks) {
    const error = checkSingleBlock(block);
    if (error) return error;
  }
  return undefined;
}

function checkSingleBlock(block: Block): LibraryError | undefined {
  if (block.type === 'group') {
    // Group children are blocks in their own right; validate each in its own
    // context rather than treating the group as a flat inline container.
    return checkBlockSemantics(block.blocks as Block[]);
  }
  if (block.type === 'question') {
    return checkQuestion(block);
  }
  if (block.type === 'assessment') {
    return checkAssessment(block);
  }
  if (block.type === 'figure') {
    const figure = block.figure;
    if (figure.kind === 'flowchart') return checkFlowchart(block.id, figure);
    if (figure.kind === 'diagram') return checkDiagram(block.id, figure);
    // model3d directives are validated against a manifest at resolve time
    // (M5b); the schema-level rules are all that can be checked here.
    return checkNoStrayBlanks(block);
  }
  return checkNoStrayBlanks(block);
}

function checkNoStrayBlanks(block: Block): LibraryError | undefined {
  const stray = collectBlanks(block);
  if (stray.length === 0) return undefined;
  return createError(
    'invalid-node',
    `"blank" mark is only valid inside a cloze question (found in node "${block.id}")`,
    block.id,
    block.type,
  );
}

function checkQuestion(question: QuestionBlock, mode?: AssessmentMode): LibraryError | undefined {
  if (question.key !== undefined && (mode === 'exam' || mode === 'quiz')) {
    return createError(
      'key-in-exam',
      `Question "${question.id}" carries an answer key in ${mode} mode`,
      question.id,
      'question',
    );
  }

  const blanks = collectBlanks(question);
  const stray = blanks.filter(hit => hit.path[0] !== 'content');

  if (question.kind === 'cloze') {
    if (stray.length > 0) {
      return createError(
        'invalid-node',
        `"blank" mark outside a cloze question's content (question "${question.id}")`,
        question.id,
        'question',
      );
    }
    const contentBlanks = blanks.filter(hit => hit.path[0] === 'content');
    if (contentBlanks.length === 0) {
      return createError(
        'invalid-node',
        `Cloze question "${question.id}" has no blank marks`,
        question.id,
        'question',
      );
    }
    const seenBlankIds = new Set<string>();
    for (const hit of contentBlanks) {
      if (seenBlankIds.has(hit.id)) {
        return createError(
          'invalid-node',
          `Duplicate blank id "${hit.id}" in cloze question "${question.id}"`,
          question.id,
          'question',
        );
      }
      seenBlankIds.add(hit.id);
    }
  } else if (blanks.length > 0) {
    return createError(
      'invalid-node',
      `"blank" mark is only valid in a cloze question (question "${question.id}" is "${question.kind}")`,
      question.id,
      'question',
    );
  }

  switch (question.kind) {
    case 'mcq':
      return checkUniqueIds(question.id, question.options);
    case 'matching':
      return checkUniqueIds(question.id, question.left) ?? checkUniqueIds(question.id, question.right);
    case 'ordering':
      return checkUniqueIds(question.id, question.items);
    default:
      return undefined;
  }
}

function checkUniqueIds(nodeId: string, items: readonly { id: string }[]): LibraryError | undefined {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) {
      return createError('invalid-node', `Duplicate item id "${item.id}" in "${nodeId}"`, nodeId);
    }
    seen.add(item.id);
  }
  return undefined;
}

function checkAssessment(assessment: AssessmentBlock): LibraryError | undefined {
  const headerBlanks = collectBlanks({ title: assessment.title, instructions: assessment.instructions });
  if (headerBlanks.length > 0) {
    return createError(
      'assessment-invalid',
      `"blank" marks belong in question content, not assessment copy ("${assessment.id}")`,
      assessment.id,
      'assessment',
    );
  }

  const sectionIds = new Set<string>();
  const questionIds = new Set<string>();

  for (const section of assessment.sections) {
    if (sectionIds.has(section.id)) {
      return createError(
        'assessment-invalid',
        `Duplicate section id "${section.id}" in assessment "${assessment.id}"`,
        assessment.id,
        'assessment',
      );
    }
    sectionIds.add(section.id);

    const sectionBlanks = collectBlanks({ title: section.title, instructions: section.instructions });
    if (sectionBlanks.length > 0) {
      return createError(
        'assessment-invalid',
        `"blank" marks belong in question content, not section copy ("${section.id}")`,
        assessment.id,
        'assessment',
      );
    }

    for (const question of section.questions) {
      if (questionIds.has(question.id)) {
        return createError(
          'assessment-invalid',
          `Duplicate question id "${question.id}" in assessment "${assessment.id}"`,
          assessment.id,
          'assessment',
        );
      }
      questionIds.add(question.id);

      const questionError = checkQuestion(question, assessment.mode);
      if (questionError) return questionError;
    }
  }

  if (assessment.timer?.kind === 'countdown') {
    const { seconds, warnAtSeconds } = assessment.timer;
    if (warnAtSeconds?.some(warn => warn >= seconds)) {
      return createError(
        'assessment-invalid',
        `Timer warnings must fire before the countdown ends ("${assessment.id}")`,
        assessment.id,
        'assessment',
      );
    }
  }

  return undefined;
}

function checkFlowchart(nodeId: string, figure: FlowchartFigure): LibraryError | undefined {
  const ids = new Set<string>();
  for (const node of figure.nodes) {
    if (ids.has(node.id)) {
      return createError('invalid-node', `Duplicate flowchart node id "${node.id}"`, nodeId, 'figure');
    }
    ids.add(node.id);
  }

  const has = (id: string) => ids.has(id);
  for (const edge of figure.edges) {
    if (!has(edge.from) || !has(edge.to)) {
      return createError(
        'invalid-node',
        `Flowchart edge "${edge.from}" → "${edge.to}" references an unknown node`,
        nodeId,
        'figure',
      );
    }
  }
  for (const input of figure.inputs ?? []) {
    if (!has(input.to)) {
      return createError('invalid-node', `Flowchart input targets unknown node "${input.to}"`, nodeId, 'figure');
    }
  }
  for (const output of figure.outputs ?? []) {
    if (!has(output.from)) {
      return createError('invalid-node', `Flowchart output leaves unknown node "${output.from}"`, nodeId, 'figure');
    }
  }

  if (figure.lanes) {
    const laneIds = new Set<string>();
    for (const lane of figure.lanes) {
      if (laneIds.has(lane.id)) {
        return createError('invalid-node', `Duplicate flowchart lane id "${lane.id}"`, nodeId, 'figure');
      }
      laneIds.add(lane.id);
    }
    for (const node of figure.nodes) {
      if (node.lane !== undefined && !laneIds.has(node.lane)) {
        return createError(
          'invalid-node',
          `Flowchart node "${node.id}" names unknown lane "${node.lane}"`,
          nodeId,
          'figure',
        );
      }
    }
  }

  return undefined;
}

function checkDiagram(nodeId: string, figure: Extract<Figure, { kind: 'diagram' }>): LibraryError | undefined {
  const ids = new Set(figure.nodes.map(node => node.id));
  if (figure.root !== undefined && !ids.has(figure.root)) {
    return createError('invalid-node', `Diagram root "${figure.root}" is not a node`, nodeId, 'figure');
  }
  for (const edge of figure.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) {
      return createError(
        'invalid-node',
        `Diagram edge "${edge.from}" → "${edge.to}" references an unknown node`,
        nodeId,
        'figure',
      );
    }
  }
  return undefined;
}

/**
 * Detect `after`-trigger cycles among the incoming blocks (§6.3) and rewrite
 * the cyclic triggers to `start`, so those nodes enter immediately and the
 * op still applies. Returns the (possibly) rewritten op plus `cue-cycle`
 * warnings — one per affected node.
 */
function breakAfterCycles<T extends { blocks: Block[] }>(op: T): { op: T; warnings: LibraryError[] } {
  const warnings: LibraryError[] = [];

  // Collect after-references among the op's own blocks only (references into
  // existing state resolve through the entry plan and cannot cycle).
  const afterRefs = new Map<string, string>();
  for (const block of op.blocks) {
    const trigger = (block as { enter?: { trigger?: { on?: string; node?: string } } }).enter?.trigger;
    if (trigger && trigger.on === 'after' && typeof trigger.node === 'string') {
      afterRefs.set(block.id, trigger.node);
    }
  }
  if (afterRefs.size === 0) return { op, warnings };

  // For each starting node, walk the chain; if it returns to the start node,
  // every node on the cycle is broken out (trigger → start).
  const cyclic = new Set<string>();
  for (const start of afterRefs.keys()) {
    const path: string[] = [];
    let current: string | undefined = start;
    const seen = new Set<string>();
    while (current !== undefined && !seen.has(current)) {
      seen.add(current);
      path.push(current);
      current = afterRefs.get(current);
    }
    if (current === start) {
      const cycleStart = path.indexOf(start);
      for (const id of path.slice(cycleStart)) cyclic.add(id);
    }
  }
  if (cyclic.size === 0) return { op, warnings };

  const blocks = op.blocks.map(block => {
    if (!cyclic.has(block.id)) return block;
    const b = block as Block & { enter?: { trigger?: unknown } };
    warnings.push(
      createError(
        'cue-cycle',
        `Node "${block.id}" participates in an after-trigger cycle; its trigger falls back to "start"`,
        block.id,
        block.type,
      ),
    );
    const enter = b.enter ? { ...b.enter, trigger: undefined } : b.enter;
    const next = { ...b };
    if (enter && 'trigger' in enter) {
      next.enter = enter as typeof b.enter;
    }
    return next;
  });

  return { op: { ...op, blocks }, warnings };
}
