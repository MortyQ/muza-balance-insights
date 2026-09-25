import { onMounted, onUnmounted } from 'vue';

/** Esc runs `action`, unless a text field has something typed in it (so typing is never lost by accident). */
export function useEscape(action: () => void): void {
  function onKey(e: KeyboardEvent) {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    const t = e.target;
    if (t instanceof HTMLInputElement && t.value !== '') return;
    action();
  }
  onMounted(() => window.addEventListener('keydown', onKey));
  onUnmounted(() => window.removeEventListener('keydown', onKey));
}
