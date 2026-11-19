import type { Preview } from '@storybook/react';
import '../styles/base.css';

const preview: Preview = {
  parameters: {
    controls: { expanded: true },
    layout: 'padded',
  },
};

export default preview;
