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
]);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
