import { defineStore } from 'pinia';
import { ref } from 'vue';
import { PREFS_KEY } from '../constants.ts';
import type { SpendingPrefs } from '../types.ts';
import { parsePrefs } from '../utils/index.ts';

function read(): SpendingPrefs {
  try {
    return parsePrefs(localStorage.getItem(PREFS_KEY));
  } catch {
    return parsePrefs(null);
  }
}

/** The block's menu choices, remembered on this computer (a convenience: defaults when storage is unavailable). */
export const useSpendingPrefsStore = defineStore('spending-prefs', () => {
  const prefs = ref<SpendingPrefs>(read());

  function set<K extends keyof SpendingPrefs>(key: K, value: SpendingPrefs[K]): void {
    prefs.value = { ...prefs.value, [key]: value };
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs.value));
    } catch {
      // Storage unavailable: the choice holds until the app restarts.
    }
  }

  return { prefs, set };
});
