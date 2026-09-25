import '@fontsource-variable/manrope/wght.css';
import './styles/main.css';
import { createApp } from 'vue';
import App from './App.vue';

// The design tokens switch on data-theme; follow the system appearance.
const dark = window.matchMedia('(prefers-color-scheme: dark)');
const applyTheme = () => document.documentElement.setAttribute('data-theme', dark.matches ? 'dark' : 'light');
applyTheme();
dark.addEventListener('change', applyTheme);

createApp(App).mount('#app');
