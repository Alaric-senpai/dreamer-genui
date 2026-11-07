import { z } from 'zod';
import { OpSchema } from './ops';

export const VersionSchema = z.literal(1);
export type Version = z.infer<typeof VersionSchema>;

export const ReplySchema = z.object({
  v: VersionSchema,
  ops: z.array(OpSchema),
});
export type Reply = z.infer<typeof ReplySchema>;
