// `~icons/lucide/<name>` components generated at build time by unplugin-icons.
/// <reference types="unplugin-icons/types/vue" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

// Stylesheets are side-effect imports handled by Vite (Tailwind, @fontsource).
declare module '*.css';


// Only the Vite env flags the renderer reads (vite/client types are not loaded: types: []).
interface ImportMetaEnv {
  readonly DEV: boolean;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
