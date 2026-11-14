import { describe, expect, test } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createBoard } from '../../packages/dreamer-genui/src/core/reducer';
import { validateOp } from '../../packages/dreamer-genui/src/core/validator';
import {
  DEFAULT_MODEL_BUDGET,
  checkModelBudget,
  findModelInManifests,
  parseModelManifest,
  parseModelRef,
  toModelSummary,
  validateModelDirectives,
} from '../../packages/dreamer-genui/src/core/model';
import { ModelManifestSchema } from '../../packages/dreamer-genui/src/schema/model';

const FIXTURE_DIR = new URL('../../fixtures', import.meta.url).pathname;

function loadFixture(name: string): any {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf-8'));
}

/** First append block of a fixture (the fixtures below use one append op). */
function firstBlock(name: string): any {
  for (const op of loadFixture(name).ops) {
    if (op.op === 'append' || op.op === 'replace') return op.blocks[0];
  }
  throw new Error(`No block in ${name}`);
}

function figureOf(name: string): any {
  return firstBlock(name).figure;
}

/** Validate every op in a fixture; return the first failure (or the last result). */
function validateFixture(name: string) {
  const state = createBoard('fixture-board');
  let result = validateOp(state, { op: 'append', blocks: [] });
  for (const op of loadFixture(name).ops) {
    result = validateOp(state, op);
    if (!result.valid) return result;
  }
  return result;
}

describe('M4b semantic validation', () => {
  test('bad slot is rejected at the schema boundary', () => {
    const result = validateFixture('invalid-bad-slot.json');
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('invalid-node');
  });

  test('answer key in exam mode rejects with key-in-exam', () => {
    const result = validateFixture('invalid-key-in-exam.json');
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('key-in-exam');
    expect(result.error?.nodeId).toBe('leaky-question');
  });

  test('answer key in practice mode is accepted', () => {
    expect(validateFixture('assessment-practice.json').valid).toBe(true);
  });

  test('answer key on a standalone question is accepted (practice semantics)', () => {
    expect(validateFixture('question-kinds.json').valid).toBe(true);
  });

  test('blank outside a cloze question rejects with invalid-node', () => {
    const result = validateFixture('invalid-blank-outside-cloze.json');
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('invalid-node');
    expect(result.error?.nodeId).toBe('stray-blank');
  });

  test('blank inside a cloze question is accepted', () => {
    expect(validateFixture('assessment-exam.json').valid).toBe(true);
  });

  test('blank in a non-cloze question prompt rejects with invalid-node', () => {
    const state = createBoard('t');
    const result = validateOp(state, {
      op: 'append',
      blocks: [
        {
          id: 'q',
          type: 'question',
          kind: 'short',
          prompt: [{ mark: 'blank', id: 'b1' }],
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('invalid-node');
  });

  test('cloze without blanks rejects with invalid-node', () => {
    const state = createBoard('t');
    const result = validateOp(state, {
      op: 'append',
      blocks: [
        {
          id: 'q',
          type: 'question',
          kind: 'cloze',
          prompt: ['Complete it.'],
          content: ['No blanks here.'],
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('invalid-node');
  });

  test('duplicate blank ids reject with invalid-node', () => {
    const state = createBoard('t');
    const result = validateOp(state, {
      op: 'append',
      blocks: [
        {
          id: 'q',
          type: 'question',
          kind: 'cloze',
          prompt: ['Complete it.'],
          content: [
            { mark: 'blank', id: 'same' },
            ' and ',
            { mark: 'blank', id: 'same' },
          ],
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('invalid-node');
  });

  test('duplicate section ids reject with assessment-invalid', () => {
    const state = createBoard('t');
    const question = {
      id: 'q1',
      type: 'question',
      kind: 'truefalse',
      prompt: ['True?'],
    };
    const result = validateOp(state, {
      op: 'append',
      blocks: [
        {
          id: 'a',
          type: 'assessment',
          mode: 'practice',
          sections: [
            { id: 'same', questions: [question] },
            { id: 'same', questions: [{ ...question, id: 'q2' }] },
          ],
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('assessment-invalid');
  });

  test('duplicate question ids across sections reject with assessment-invalid', () => {
    const state = createBoard('t');
    const question = {
      id: 'same-question',
      type: 'question',
      kind: 'truefalse',
      prompt: ['True?'],
    };
    const result = validateOp(state, {
      op: 'append',
      blocks: [
        {
          id: 'a',
          type: 'assessment',
          mode: 'practice',
          sections: [
            { id: 'one', questions: [question] },
            { id: 'two', questions: [{ ...question }] },
          ],
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('assessment-invalid');
  });

  test('timer warnings at or after the end reject with assessment-invalid', () => {
    const state = createBoard('t');
    const result = validateOp(state, {
      op: 'append',
      blocks: [
        {
          id: 'a',
          type: 'assessment',
          mode: 'exam',
          timer: { kind: 'countdown', seconds: 60, warnAtSeconds: [30, 60] },
          sections: [
            {
              id: 'one',
              questions: [{ id: 'q1', type: 'question', kind: 'truefalse', prompt: ['True?'] }],
            },
          ],
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('assessment-invalid');
  });

  test('flowchart with a dangling edge rejects with invalid-node', () => {
    const result = validateFixture('invalid-flowchart-dangling-edge.json');
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('invalid-node');
    expect(result.error?.nodeId).toBe('dangling-flow');
  });

  test('flowchart input targeting an unknown node rejects', () => {
    const state = createBoard('t');
    const result = validateOp(state, {
      op: 'append',
      blocks: [
        {
          id: 'f',
          type: 'figure',
          figure: {
            kind: 'flowchart',
            nodes: [{ id: 'only', label: ['Only'] }],
            edges: [],
            inputs: [{ to: 'ghost', label: ['Input'] }],
            alt: 'A flowchart',
          },
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('invalid-node');
  });

  test('flowchart node naming an unknown lane rejects', () => {
    const state = createBoard('t');
    const result = validateOp(state, {
      op: 'append',
      blocks: [
        {
          id: 'f',
          type: 'figure',
          figure: {
            kind: 'flowchart',
            nodes: [{ id: 'only', label: ['Only'], lane: 'ghost-lane' }],
            edges: [],
            lanes: [{ id: 'real-lane', label: 'Real' }],
            alt: 'A flowchart',
          },
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('invalid-node');
  });

  test('valid M4b fixtures pass semantic validation', () => {
    const fixtures = [
      'split-explanation-question.json',
      'split-reversed.json',
      'layout-change-animated.json',
      'group-flex-grid.json',
      'process-flowchart.json',
      'timeline.json',
      'compare.json',
      'list.json',
      'question-kinds.json',
      'assessment-practice.json',
      'assessment-exam.json',
      'assessment-review.json',
      'flashcards.json',
      'camera-tilt-path.json',
      'model3d-basic.json',
      'model3d-tour.json',
      'model3d-hotspot-question.json',
      'model3d-label-question.json',
      'scene3d-solids.json',
    ];
    for (const fixture of fixtures) {
      expect(validateFixture(fixture).valid, fixture).toBe(true);
    }
  });
});

describe('Model manifest and directives (§6.16)', () => {
  const manifest = ModelManifestSchema.parse(loadFixture('model-manifest.json'));

  test('the example manifest validates', () => {
    expect(manifest.id).toBe('assembly');
    expect(Object.keys(manifest.parts)).toContain('rotor');
  });

  test('a malformed manifest yields connector-error', () => {
    const result = parseModelManifest(loadFixture('invalid-model-manifest.json'));
    expect(result.error?.code).toBe('connector-error');
  });

  test('an over-budget manifest yields model-budget-exceeded', () => {
    const parsed = ModelManifestSchema.parse(loadFixture('invalid-model-over-budget.json'));
    const error = checkModelBudget(parsed);
    expect(error?.code).toBe('model-budget-exceeded');
  });

  test('a manifest within budget passes the budget check', () => {
    expect(checkModelBudget(manifest, DEFAULT_MODEL_BUDGET)).toBeUndefined();
  });

  test('unknown highlight part yields unknown-part', () => {
    const figure = figureOf('invalid-unknown-part.json');
    const errors = validateModelDirectives('unknown-part-figure', figure, manifest);
    expect(errors.map(error => error.code)).toContain('unknown-part');
  });

  test('unknown named view yields unknown-view', () => {
    const figure = figureOf('invalid-unknown-view.json');
    const errors = validateModelDirectives('unknown-view-figure', figure, manifest);
    expect(errors.map(error => error.code)).toContain('unknown-view');
  });

  test('a missing model yields model-not-found', () => {
    const result = findModelInManifests([manifest], 'demo:ghost-model');
    expect(result.error?.code).toBe('model-not-found');
  });

  test('a bare and a qualified model reference resolve to the same manifest', () => {
    expect(findModelInManifests([manifest], 'assembly').manifest?.id).toBe('assembly');
    expect(findModelInManifests([manifest], 'demo:assembly').manifest?.id).toBe('assembly');
    expect(parseModelRef('demo:assembly')).toEqual({ connectorId: 'demo', modelId: 'assembly' });
    expect(parseModelRef('assembly')).toEqual({ modelId: 'assembly' });
  });

  test('a valid tour has no directive errors', () => {
    const figure = figureOf('model3d-tour.json');
    expect(validateModelDirectives('model-tour', figure, manifest)).toEqual([]);
  });

  test('a valid model3d figure has no directive errors', () => {
    const figure = figureOf('model3d-basic.json');
    expect(validateModelDirectives('model-basic', figure, manifest)).toEqual([]);
  });

  test('hotspot and label questions reference the same model contract', () => {
    const hotspot = firstBlock('model3d-hotspot-question.json');
    const labelled = firstBlock('model3d-label-question.json');
    expect(validateModelDirectives(hotspot.id, hotspot.figure, manifest)).toEqual([]);
    expect(validateModelDirectives(labelled.id, labelled.figure, manifest)).toEqual([]);
  });

  test('the compact summary exposes part ids and named sections only', () => {
    const summary = toModelSummary(manifest);
    expect(summary.parts.map(part => part.id)).toEqual(['base', 'housing', 'rotor', 'seal']);
    expect(summary.views).toEqual(['top-down']);
    expect(summary.cutaways).toEqual(['half']);
    expect(summary).not.toHaveProperty('assets');
  });
});
