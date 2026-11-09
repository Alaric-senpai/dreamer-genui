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
  'labeled-art.json',
  'chart-bar.json',
  'math-chem.json',
  'lottie-basic.json',
  'streaming-partial.json',
];

const INVALID = [
  'invalid-duplicate-id.json',        // duplicate node id (detected at board reducer)
  'invalid-unknown-type.json',        // unknown block type
  'invalid-depth-exceeded.json',      // attach depth exceeded
  'invalid-cue-cycle.json',           // mutual `after` trigger cycle (cue engine, M2)
  'invalid-disallowed-mood.json',     // unregistered mood (theme policy, M2)
  'invalid-unreadable-palette.json',  // dark ink on dark bg (contrast guardrail, M2)
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
});
