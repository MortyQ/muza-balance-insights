import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'electron-vite';
import Icons from 'unplugin-icons/vite';
import type { Plugin } from 'vite';
import { PROD_CSP } from './src/main/csp.ts';

/** Production build only: the CSP also goes into index.html as <meta> (the app:// handler sends it as a header too). */
export function cspMetaPlugin(csp: string): Plugin {
  return {
    name: 'balance-csp-meta',
    apply: 'build',
    transformIndexHtml(html: string) {
      return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`);
    },
  };
}

/**
 * Icons are compiled from the local @iconify-json/lucide set. autoInstall stays off: a missing icon set
 * must fail the build, never make the build download a package.
 */
export const ICONS_OPTIONS = { compiler: 'vue3', autoInstall: false } as const;

export default defineConfig({
  main: {
    build: {
      // Only `dependencies` stay external (@libsql/client + libsql load a native Node-API module, zod): electron-builder
      // packages them. @mono/* are TypeScript sources in devDependencies, so they are bundled; the exclude keeps that
      // true even if one is moved back to dependencies.
      externalizeDeps: { exclude: ['@mono/core', '@mono/db-libsql'] },
    },
  },
  preload: {
    build: {
      // A sandboxed preload can't require npm modules and must be CommonJS: bundle everything into one .cjs.
      externalizeDeps: false,
      rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } },
    },
  },
  renderer: {
    plugins: [vue(), tailwindcss(), Icons(ICONS_OPTIONS), cspMetaPlugin(PROD_CSP)],
    // `@/` = src/renderer/src: slices import each other by layer (`@/features/x`); `@contract/` = src/shared, the types and
    // constants shared with main and the preload. Layer rules: tests/architecture.test.ts.
    resolve: {
      alias: {
        '@contract': fileURLToPath(new URL('./src/shared', import.meta.url)),
        '@': fileURLToPath(new URL('./src/renderer/src', import.meta.url)),
      },
    },
    build: {
      // Never inline assets as data: URIs — the prod CSP allows fonts and images only from 'self'
      // (a 2.5 KB font subset would otherwise be inlined and silently blocked).
      assetsInlineLimit: 0,
    },
  },
});
