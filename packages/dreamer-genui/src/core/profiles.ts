import type { ProfileDefinition } from './plugin';
import type { Registry } from './registry';

/**
 * Capability profiles (§9.4). Profiles keep the tutor prompt small: the
 * `lesson` profile omits the assessment shell, `assessment` keeps the test
 * surface and minimal content, `minimal` is text-and-choices only. Hosts add
 * their own with `defineProfile` and register it as a `profiles` entry.
 */

export const BUILT_IN_PROFILES: Record<string, ProfileDefinition> = {
  lesson: {
    description: 'Full lesson surface: content, figures, questions, layouts; no assessment shell.',
    exclude: ['assessment'],
  },
  assessment: {
    description: 'Assessment shell plus questions and minimal supporting content.',
    include: [
      'text',
      'callout',
      'list',
      'figure',
      'question',
      'flashcards',
      'assessment',
    ],
    exclude: [],
  },
  minimal: {
    description: 'Smallest guide: text, marks, choices and basic layout.',
    include: ['text', 'choices', 'callout', 'group'],
    exclude: [],
  },
};

export const DEFAULT_PROFILE = 'lesson';

export interface ResolvedProfile {
  name: string;
  definition: ProfileDefinition;
}

/** Resolve a profile name (registered first, then built-in) or a definition. */
export function resolveProfile(
  registry: Registry,
  profile?: string | ProfileDefinition,
): ResolvedProfile {
  if (profile && typeof profile === 'object') {
    return { name: 'custom', definition: profile };
  }
  const name = profile ?? DEFAULT_PROFILE;
  const registered = registry.get('profiles', name) as ProfileDefinition | undefined;
  const definition = registered ?? BUILT_IN_PROFILES[name] ?? BUILT_IN_PROFILES[DEFAULT_PROFILE]!;
  return { name: registered || BUILT_IN_PROFILES[name] ? name : DEFAULT_PROFILE, definition };
}

/**
 * Block types visible under a profile. Order follows the registry (stable and
 * deterministic), so prompt-guide snapshots only change when the registry does.
 */
export function profileBlockTypes(
  registry: Registry,
  profile?: string | ProfileDefinition,
): string[] {
  const { definition } = resolveProfile(registry, profile);
  const capabilities = registry.getCapabilities();
  const included = definition.include?.length
    ? capabilities.filter(type => definition.include!.includes(type))
    : capabilities;
  const excluded = new Set(definition.exclude ?? []);
  return included.filter(type => !excluded.has(type));
}

/** True when a profile includes a block/feature id. */
export function profileIncludes(
  registry: Registry,
  profile: string | ProfileDefinition | undefined,
  id: string,
): boolean {
  return profileBlockTypes(registry, profile).includes(id);
}
