// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://ryguy0601.github.io',
  base: '/qr_image/',
  server: {
    port: 4321,
    host: true
  }
});
