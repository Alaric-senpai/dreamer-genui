import { ErrorCodeSchema } from '../schema/errors';
import type { ErrorCode } from '../schema/errors';
import type { LibraryError } from './types';

export { ErrorCodeSchema };
export type { ErrorCode };

export function createError(
  code: ErrorCode,
  detail?: string,
  nodeId?: string,
  type?: string
): LibraryError {
  return {
    code,
    ...(nodeId !== undefined && { nodeId }),
    ...(type !== undefined && { type }),
    ...(detail !== undefined && { detail }),
  };
}
