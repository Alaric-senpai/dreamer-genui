import { z } from 'zod';

export const MotionFieldsSchema = z.object({
  order: z.number().optional(),
  delay: z.number().optional(),
  duration: z.number().optional(),
});
