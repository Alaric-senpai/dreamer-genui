import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  AppendOpSchema,
  AttachOpSchema,
  ReplaceOpSchema,
  UpdateOpSchema,
  RemoveOpSchema,
  ThemeOpSchema,
  CameraOpSchema,
} from '../../schema/ops';
import { ThemeSpecSchema } from '../../schema/theme';
import type { Registry } from '../registry';
import type { ZodType } from 'zod';

/**
 * Registry-aware JSON Schema for the reply envelope (§8.1): the registered
 * mood, ambience and surface names appear as enums, so a tutor constrained to
 * this JSON Schema can only name registries that actually exist on the host.
 * Plugins that register new entries extend the enums by re-calling this.
 */
export function registryToJsonSchema(registry: Registry): ReturnType<typeof zodToJsonSchema> {
  const moods = registry.listMoods().map(m => m.name);
  const ambience = registry.listAmbience().map(a => a.name);
  const surfaces = registry.listSurfaces().map(s => s.name);

  const base = ThemeSpecSchema.shape;

  const theme = ThemeSpecSchema.extend({
    mood: moods.length ? z.enum(moods as [string, ...string[]]) : base.mood,
    ambience:
      ambience.length
        ? z.union([
            z.enum(ambience as [string, ...string[]]),
            z.object({
              preset: z.enum(ambience as [string, ...string[]]),
              intensity: z.number().min(0).max(1).optional(),
            }),
          ])
        : base.ambience,
    surface: surfaces.length ? z.enum(surfaces as [string, ...string[]]) : base.surface,
  });

  const ops: ZodType[] = [
    AppendOpSchema,
    AttachOpSchema.extend({ theme: theme.optional() }),
    ReplaceOpSchema.extend({ theme: theme.optional() }),
    UpdateOpSchema,
    RemoveOpSchema,
    ThemeOpSchema.extend({ theme }),
    CameraOpSchema,
  ];
  const opUnion = z.discriminatedUnion('op', ops as never);

  const Reply = z.object({ v: z.literal(1), ops: z.array(opUnion) });
  return zodToJsonSchema(Reply, { name: 'DreamerGenuiReply' } as never);
}
