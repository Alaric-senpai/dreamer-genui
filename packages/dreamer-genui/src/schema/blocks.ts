import { z } from 'zod';

export const BlockSchema = z.object({
  id: z.string(),
  type: z.string(),
});
