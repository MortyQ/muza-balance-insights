import { onMounted, ref } from 'vue';
import type { Locale } from '@contract/locale.ts';
import { applyLocale, FAILED_TEXT } from '@/shared/lib';
import { useLocaleRequest } from '../api/useLocaleRequest.ts';
import type { UseLocaleReturn } from '../types.ts';

export function useLocale(): UseLocaleReturn {
  const request = useLocaleRequest();
  const locale = ref<Locale | null>(null);
  const error = ref('');
  let saving = false;

  onMounted(async () => {
    try {
      locale.value = await request.get();
    } catch {
      error.value = FAILED_TEXT;
    }
  });

  async function select(next: Locale): Promise<void> {
    if (saving || next === locale.value) return;
    const previous = locale.value;
    // Moves at once; rolled back if main could not save it.
    locale.value = next;
    error.value = '';
    saving = true;
    try {
      locale.value = await request.set(next);
      applyLocale(locale.value);
    } catch {
      locale.value = previous;
      error.value = FAILED_TEXT;
    } finally {
      saving = false;
    }
  }

  return { locale, error, select };
}
