/**
 * Plugin conformance suite (§8.9). Framework-free and side-effect-free: the
 * host or a test calls it with a plugin definition and gets a report.
 *
 * The checks here are the ones that can be made from the manifest alone:
 * naming, engine range, provided kinds and prompt-guide presence. Runtime
 * behaviour (lazy loading, fallbacks, reduced motion) is covered by the
 * component tests.
 */
import {
  ENGINE_VERSION,
  isCorePluginName,
  isNamespacedName,
  satisfiesEngine,
  type PluginDefinition,
  type PluginProvides,
} from '../core/plugin';

export interface ConformanceIssue {
  code:
    | 'plugin-name'
    | 'plugin-conflict'
    | 'plugin-incompatible'
    | 'plugin-empty'
    | 'missing-prompt-guide';
  message: string;
}

export interface ConformanceReport {
  ok: boolean;
  issues: ConformanceIssue[];
}

function providedKinds(provides: PluginProvides | undefined): string[] {
  if (!provides) return [];
  return Object.entries(provides)
    .filter(([, entries]) => entries && Object.keys(entries).length > 0)
    .map(([kind]) => kind);
}

/**
 * Check one plugin definition. Built-in plugins are core names; third-party
 * plugins must be namespaced `vendor:name`, and every plugin must declare a
 * compatible engine range and at least one provided entry.
 */
export function runPluginConformance(plugin: PluginDefinition): ConformanceReport {
  const issues: ConformanceIssue[] = [];
  const name = plugin.name?.trim() ?? '';

  if (!name) {
    issues.push({ code: 'plugin-name', message: 'Plugin name is empty.' });
  } else if (!isCorePluginName(name) && !isNamespacedName(name)) {
    issues.push({
      code: 'plugin-name',
      message: `Third-party plugin name "${name}" must be namespaced as "vendor:name".`,
    });
  }

  if (!plugin.version?.trim()) {
    issues.push({ code: 'plugin-incompatible', message: `Plugin "${name}" has no version.` });
  }

  const engine = plugin.engine ?? '^1.0.0';
  if (!satisfiesEngine(engine, ENGINE_VERSION)) {
    issues.push({
      code: 'plugin-incompatible',
      message: `Plugin "${name}" requires engine ${engine}; this engine is ${ENGINE_VERSION}.`,
    });
  }

  if (plugin.requires?.includes(name)) {
    issues.push({
      code: 'plugin-conflict',
      message: `Plugin "${name}" lists itself in requires.`,
    });
  }

  const kinds = providedKinds(plugin.provides);
  if (kinds.length === 0) {
    issues.push({ code: 'plugin-empty', message: `Plugin "${name}" provides nothing.` });
  }

  for (const block of Object.values(plugin.provides?.blocks ?? {})) {
    if (!block.promptGuide?.trim()) {
      issues.push({
        code: 'missing-prompt-guide',
        message: `Plugin "${name}" provides a block without a promptGuide.`,
      });
    }
  }

  return { ok: issues.length === 0, issues };
}
