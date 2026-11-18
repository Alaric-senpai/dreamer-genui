import { describe, expect, test } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ReplySchema } from '../../packages/dreamer-genui/src/schema/envelope';
import { OpSchema } from '../../packages/dreamer-genui/src/schema/ops';

const FIXTURE_DIR = new URL('../../fixtures', import.meta.url).pathname;

function loadFixture(name: string) {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf-8'));
}

const VALID = [
  'define-term.json',
  'attach-explainer.json',
  'replace-new-topic.json',
  'cued-narration.json',
  'cue-before-node.json',
  'theme-mood-shift.json',
  'replace-with-theme.json',
  'camera-moves.json',
  'diagram-radial.json',
  'diagram-cycle.json',
  'labeled-art.json',
  'chart-bar.json',
  'math-chem.json',
  'lottie-basic.json',
  'streaming-partial.json',
  // M4b additions (v2.1 / v2.2 protocol surface).
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
  // M4c additions (v3 protocol surface).
  'lesson-turn-narration.json',
  'text-morph.json',
  'scene-transitions.json',
  'pointer-tour.json',
  'reference-saas-explainer.json',
];

const INVALID = [
  'invalid-duplicate-id.json',        // duplicate node id (detected at board reducer)
  'invalid-unknown-type.json',        // unknown block type
  'invalid-depth-exceeded.json',      // attach depth exceeded
  'invalid-cue-cycle.json',           // mutual `after` trigger cycle (cue engine, M2)
  'invalid-disallowed-mood.json',     // unregistered mood (theme policy, M2)
  'invalid-unreadable-palette.json',  // dark ink on dark bg (contrast guardrail, M2)
  'invalid-cue-orphan.json',          // cue no beat mentions (resolver warning)
  'invalid-duplicate-beat.json',      // duplicate beat id (parseBeats)
  'invalid-unknown-transition.json',  // unregistered transition kind
  'invalid-malformed-turn.json',      // beat without text (schema)
];

describe('Valid fixtures parse correctly', () => {
  test.each(VALID)('%s parses as valid Reply', (file) => {
    const fixture = loadFixture(file);
    expect(() => ReplySchema.parse(fixture)).not.toThrow();
  });

  test.each(VALID)('%s ops parse correctly', (file) => {
    const fixture = loadFixture(file);
    for (const op of fixture.ops) {
      expect(() => OpSchema.parse(op)).not.toThrow();
    }
  });
});

describe('Invalid fixtures are rejected', () => {
  test('invalid-unknown-type.json — unknown block type is rejected', () => {
    const fixture = loadFixture('invalid-unknown-type.json');
    expect(() => ReplySchema.parse(fixture)).toThrow();
  });

  test('invalid-depth-exceeded.json — last attach creates depth 3', () => {
    const fixture = loadFixture('invalid-depth-exceeded.json');
    // Schema accepts it; depth check is at board-reducer level
    // But the test verifies it parses at schema level (depth is a business-logic rule)
    expect(() => ReplySchema.parse(fixture)).not.toThrow();
    // The 4th op is depth 3, which the reducer should reject with 'depth-exceeded'
  });

  test('invalid-duplicate-id.json — duplicate ids pass schema (checked at reducer)', () => {
    const fixture = loadFixture('invalid-duplicate-id.json');
    // Schema doesn't catch duplicate ids (that's a board-state concern)
    expect(() => ReplySchema.parse(fixture)).not.toThrow();
  });

  test('invalid-malformed-turn.json — beat without text is rejected by the schema', () => {
    const fixture = loadFixture('invalid-malformed-turn.json');
    expect(() => ReplySchema.parse(fixture)).toThrow();
  });

  test('invalid-duplicate-beat.json — duplicate ids pass schema (checked by parseBeats)', () => {
    const fixture = loadFixture('invalid-duplicate-beat.json');
    expect(() => ReplySchema.parse(fixture)).not.toThrow();
  });

  test('invalid-cue-orphan.json — an orphan cue still parses (resolver warns)', () => {
    const fixture = loadFixture('invalid-cue-orphan.json');
    expect(() => ReplySchema.parse(fixture)).not.toThrow();
  });

  test('invalid-unknown-transition.json — unknown kinds pass schema (registry rejects)', () => {
    const fixture = loadFixture('invalid-unknown-transition.json');
    expect(() => ReplySchema.parse(fixture)).not.toThrow();
  });

  test.each(INVALID)('%s is present and non-empty', (file) => {
    expect(loadFixture(file).ops.length).toBeGreaterThan(0);
  });
});
