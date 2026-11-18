import { defineConfig } from 'tsup';

/**
 * Every host-kit component is its own entry point. `splitting: false` is
 * deliberate: it guarantees that importing `dreamer-genui/ui/button` never
 * pulls in the rest of the kit, which is an M4d acceptance criterion.
 */
const uiComponents = [
  'accordion',
  'alert',
  'alert-dialog',
  'aspect-ratio',
  'avatar',
  'badge',
  'breadcrumb',
  'button',
  'button-group',
  'calendar',
  'card',
  'checkbox',
  'collapsible',
  'combobox',
  'command',
  'context-menu',
  'date-picker',
  'dialog',
  'drawer',
  'dropdown-menu',
  'empty',
  'field',
  'hover-card',
  'input',
  'input-group',
  'input-otp',
  'item',
  'kbd',
  'label',
  'menubar',
  'native-select',
  'navigation-menu',
  'pagination',
  'popover',
  'progress',
  'radio-group',
  'resizable',
  'scroll-area',
  'select',
  'separator',
  'sheet',
  'sidebar',
  'skeleton',
  'slider',
  'spinner',
  'switch',
  'table',
  'tabs',
  'textarea',
  'toast',
  'toggle',
  'toggle-group',
  'tooltip',
  'typography',
] as const;

const uiEntries = Object.fromEntries(
  uiComponents.map((name) => [`ui/${name}`, `./src/ui/${name}.tsx`]),
);

export default defineConfig({
  // Figure rendering is a separate lazy chunk (M5). With `splitting: false`
  // the dynamic import must stay external or tsup would inline it into the
  // React entry and defeat the initial-bundle budget.
  external: ['dreamer-genui/figures'],
  entry: {
    'figures/index': './src/figures/index.tsx',
    index: './src/index.ts',
    'schema/index': './src/schema/index.ts',
    'core/index': './src/core/index.ts',
    'react/index': './src/react/index.ts',
    'headless/index': './src/headless/index.ts',
    'devtools/index': './src/devtools/index.ts',
    'ui/index': './src/ui/index.ts',
    ...uiEntries,
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  clean: true,
});
