import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  // Update this to your GitHub Pages URL: https://<username>.github.io/<repo-name>/
  // For example: site: 'https://yourusername.github.io/cycling-watch-guide'
  site: 'https://yourusername.github.io/cycling-watch-guide',
  base: '/cycling-watch-guide',
});
