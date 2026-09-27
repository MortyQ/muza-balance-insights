import { onMounted, ref } from 'vue';
import type { ThemePref } from '@contract/theme.ts';
import { FAILED_TEXT } from '@/shared/lib';
import { useThemeRequest } from '../api/useThemeRequest.ts';
import type { UseThemeReturn } from '../types.ts';

// Main applies the theme; the page repaints by itself (prefers-color-scheme → data-theme in app/main.ts).
export function useTheme(): UseThemeReturn {
  const request = useThemeRequest();
  const theme = ref<ThemePref | null>(null);
  const error = ref('');
  let saving = false;

  onMounted(async () => {
    try {
      theme.value = await request.get();
    } catch {
      error.value = FAILED_TEXT;
    }
  });

  async function select(next: ThemePref): Promise<void> {
    if (saving || next === theme.value) return;
    const previous = theme.value;
    // Moves at once; rolled back if main could not save it.
    theme.value = next;
    error.value = '';
    saving = true;
    try {
      theme.value = await request.set(next);
    } catch {
      theme.value = previous;
      error.value = FAILED_TEXT;
    } finally {
      saving = false;
    }
  }

  return { theme, error, select };
}
