import { z } from 'zod';

export const EnterSchema = z.object({ effect: z.string() });
export const EmphasisSchema = z.object({ effect: z.string() });
export const ExitSchema = z.object({ effect: z.string() });
