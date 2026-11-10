/**
 * dreamer-genui Tailwind v3 preset (§7.6) — the same mapping as the v4
 * bridge for `tailwind.config` hosts. Secondary integration target; plain
 * CSS users can skip this file entirely.
 *
 * Usage:
 *   module.exports = { presets: [require('dreamer-genui/tailwind-preset')] }
 */
'use strict';

/** Tailwind theme extensions mirroring the `--dg-*` variable names. */
module.exports = {
  theme: {
    extend: {
      colors: {
        'board-bg': 'var(--dg-color-bg, #f7f7f5)',
        'board-surface': 'var(--dg-color-surface, #ffffff)',
        'board-ink': 'var(--dg-color-ink, #1f1f1d)',
        'board-muted': 'var(--dg-color-muted, #565650)',
        'board-accent': 'var(--dg-color-accent, #2e5dc4)',
        'board-info': 'var(--dg-color-info, #2563eb)',
        'board-success': 'var(--dg-color-success, #15803d)',
        'board-warn': 'var(--dg-color-warn, #b45309)',
        'board-danger': 'var(--dg-color-danger, #b91c1c)',
      },
      fontFamily: {
        'board-display': 'var(--dg-font-display, system-ui, -apple-system, sans-serif)',
        'board-body': 'var(--dg-font-body, system-ui, -apple-system, sans-serif)',
        'board-mono': 'var(--dg-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
      },
      borderRadius: {
        'board-sm': 'var(--dg-radius-sm, 4px)',
        'board-md': 'var(--dg-radius-md, 8px)',
        'board-lg': 'var(--dg-radius-lg, 16px)',
      },
    },
  },
};
