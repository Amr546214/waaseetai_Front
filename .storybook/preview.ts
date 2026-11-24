
import '../src/styles.css';
import '../src/waseet-design-system.css';

import type { Preview } from '@storybook/angular-vite';

const preview: Preview = {
  globalTypes: {
    waseetTheme: {
      description: 'Waseet AI color theme',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        dynamicTitle: true,
        items: [
          { value: 'dark', title: 'Dark Mode' },
          { value: 'light', title: 'Light Mode' },
        ],
      },
    },
  },

  initialGlobals: {
    waseetTheme: 'dark',
  },

  decorators: [
    (story, context) => {
      const isLight = context.globals['waseetTheme'] === 'light';

      const html = document.documentElement;
      const body = document.body;

      html.classList.toggle('light-theme', isLight);
      body.classList.toggle('light-theme', isLight);

      html.classList.remove('theme-light');
      body.classList.remove('theme-light');

      html.classList.toggle('dark', !isLight);
      body.classList.toggle('dark', !isLight);

      html.style.colorScheme = isLight ? 'light' : 'dark';

      return story();
    },
  ],

  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      test: 'todo',
    },
  },
};

export default preview;
