import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import Icons from 'unplugin-icons/vite';
import { defineConfig } from 'vitest/config';
import { ICONS_OPTIONS, VUE_I18N_FLAGS } from './electron.vite.config.ts';

export default defineConfig({
  // Slices export their .vue components through index.ts; tests that import a slice load them (and their icons) too.
  plugins: [vue(), Icons(ICONS_OPTIONS)],
  define: VUE_I18N_FLAGS,
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/renderer/setup-locale.ts'],
    environment: 'node',
    // The app follows the system time zone (src/shared/dates.ts): one fixed zone keeps the suite the same on every
    // machine. Fixtures are written in Kyiv time; tests of other zones switch it (tests/helpers/time-zone.ts).
    env: { TZ: 'Europe/Kyiv' },
  },
  // The renderer's aliases (electron.vite.config.ts), for tests that load its modules.
  resolve: {
    alias: {
      '@contract': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@': fileURLToPath(new URL('./src/renderer/src', import.meta.url)),
    },
  },
});
