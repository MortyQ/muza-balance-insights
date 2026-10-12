import { defineStore } from 'pinia';
import { ref } from 'vue';
import { PREFS_KEY } from '../constants.ts';
import type { NowPrefs } from '../types.ts';
import { parsePrefs } from '../utils.ts';

function read(): NowPrefs {
  try {
    return parsePrefs(localStorage.getItem(PREFS_KEY));
  } catch {
    return parsePrefs(null);
  }
}

/** The category panel: open or closed, today or the week — remembered on this computer (a convenience). */
export const useNowPrefsStore = defineStore('now-prefs', () => {
  const prefs = ref<NowPrefs>(read());

  function set<K extends keyof NowPrefs>(key: K, value: NowPrefs[K]): void {
    prefs.value = { ...prefs.value, [key]: value };
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs.value));
    } catch {
      // Storage unavailable: the choice holds until the app restarts.
    }
  }

  return { prefs, set };
});
