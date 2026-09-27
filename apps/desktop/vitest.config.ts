import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import Icons from 'unplugin-icons/vite';
import { defineConfig } from 'vitest/config';
import { ICONS_OPTIONS } from './electron.vite.config.ts';

export default defineConfig({
  // Slices export their .vue components through index.ts; tests that import a slice load them (and their icons) too.
  plugins: [vue(), Icons(ICONS_OPTIONS)],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
  // The renderer's aliases (electron.vite.config.ts), for tests that load its modules.
  resolve: {
    alias: {
      '@contract': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@': fileURLToPath(new URL('./src/renderer/src', import.meta.url)),
    },
  },
});
