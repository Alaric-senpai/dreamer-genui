import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export function schemaToJsonSchema(schema: z.ZodType) {
  return zodToJsonSchema(schema);
}
