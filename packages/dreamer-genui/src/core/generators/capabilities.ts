import type { Registry } from '../registry';
import { createRegistry } from '../registry';

const FIGURE_KINDS = ['image', 'icon', 'diagram', 'labeled', 'chart', 'lottie'] as const;

/** Extend registry types with figure kinds (figure.image, figure.tree, ...). */
export function getCapabilities(registry: Registry): string[] {
  const caps: string[] = [...registry.getCapabilities()];
  for (const kind of FIGURE_KINDS) {
    caps.push(`figure.${kind}`);
  }
  return caps;
}

/** Default capabilities using the built-ins registry. */
export function getDefaultCapabilities(): string[] {
  return getCapabilities(createRegistry());
}
