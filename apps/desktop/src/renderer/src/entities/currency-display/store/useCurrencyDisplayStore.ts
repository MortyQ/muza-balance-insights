import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { SpendingFx } from '@contract/api.ts';
import { LEGACY_KEY, STORAGE_KEY } from '../constants.ts';
import type { CurrencyPrefs } from '../types.ts';
import { parseCurrencyPrefs } from '../utils.ts';

function save(prefs: CurrencyPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable: the choice holds until the app restarts.
  }
}

function read(): CurrencyPrefs {
  try {
    const own = localStorage.getItem(STORAGE_KEY);
    if (own !== null) return parseCurrencyPrefs(own);
    const legacy = localStorage.getItem(LEGACY_KEY);
    const prefs = parseCurrencyPrefs(legacy);
    // Carried over once and saved at once: the spending block's store drops usd / eur from its key on its next write.
    if (legacy !== null) save(prefs);
    return prefs;
  } catch {
    return parseCurrencyPrefs(null);
  }
}

/**
 * The home screen's «≈ $ / €» choice (the spending block, the now strip), remembered on this computer, and the rates
 * of the month the spending block shows — it publishes each answer's `fx`, so the switch knows which currency has one.
 */
export const useCurrencyDisplayStore = defineStore('currency-display', () => {
  const prefs = ref<CurrencyPrefs>(read());
  const fx = ref<ReadonlyArray<SpendingFx>>([]);

  function set(key: keyof CurrencyPrefs, value: boolean): void {
    prefs.value = { ...prefs.value, [key]: value };
    save(prefs.value);
  }

  function setFx(next: ReadonlyArray<SpendingFx>): void {
    fx.value = next;
  }

  return { prefs, fx, set, setFx };
});
