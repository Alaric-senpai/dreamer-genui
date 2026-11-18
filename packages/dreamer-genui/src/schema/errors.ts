import { z } from 'zod';

export const ErrorCodeSchema = z.enum([
  'invalid-node',
  'unknown-type',
  'load-failed',
  'duplicate-id',
  'bad-target',
  'depth-exceeded',
  'version-mismatch',
  'theme-rejected',
  'cue-cycle',
  'layout-invalid',
  'assessment-invalid',
  'key-in-exam',
  'plugin-conflict',
  'plugin-incompatible',
  'middleware-error',
  'model-not-found',
  'model-load-failed',
  'unknown-part',
  'unknown-view',
  'webgl-unavailable',
  'connector-error',
  'model-budget-exceeded',
  'cue-orphan',
  'turn-invalid',
  'tutor-connector-error',
  'voice-error',
  'voice-unsupported',
  'transition-unknown',
]);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
