import '@fontsource-variable/manrope/wght.css';
import './styles/main.css';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import { loadLocale } from '@/features/settings';
import { i18n } from '@/shared/lib';
import App from './App.vue';
import { listenToMain } from './listeners.ts';
import { createAppRouter } from './router/index.ts';

// The design tokens switch on data-theme; follow the system appearance.
const dark = window.matchMedia('(prefers-color-scheme: dark)');
const applyTheme = () => document.documentElement.setAttribute('data-theme', dark.matches ? 'dark' : 'light');
applyTheme();
dark.addEventListener('change', applyTheme);

const app = createApp(App);
const router = createAppRouter();
app.use(createPinia());
app.use(i18n);
app.use(router);
// Before the first navigation settles: main sends the current import state as soon as the page has loaded.
listenToMain(router);
void Promise.all([router.isReady(), loadLocale()]).then(() => app.mount('#app'));
