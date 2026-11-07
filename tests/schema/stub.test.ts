import { test, expect } from 'vitest';
import { NodeIdSchema } from '../../packages/dreamer-genui/src/schema/common';

test('NodeIdSchema parses valid id', () => {
  expect(NodeIdSchema.parse('intro')).toBe('intro');
});

test('NodeIdSchema rejects empty string', () => {
  expect(() => NodeIdSchema.parse('')).toThrow();
});
