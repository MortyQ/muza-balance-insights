import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { RatesView } from '@contract/api.ts';
import { LEGACY_KEY, STORAGE_KEY } from '../constants.ts';
import type { CurrencyChoice, CurrencyKey, MainCurrency } from '../types.ts';
import { parseCurrencyChoice } from '../utils.ts';

function save(choice: CurrencyChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
  } catch {
    // Storage unavailable: the choice holds until the app restarts.
  }
}

function read(): CurrencyChoice {
  try {
    const own = localStorage.getItem(STORAGE_KEY);
    if (own !== null) return parseCurrencyChoice(own);
    const legacy = localStorage.getItem(LEGACY_KEY);
    const choice = parseCurrencyChoice(legacy);
    // Carried over once and saved at once: the spending block's store drops usd / eur from its key on its next write.
    if (legacy !== null) save(choice);
    return choice;
  } catch {
    return parseCurrencyChoice(null);
  }
}

/**
 * The home screen's currency choice (main + «≈»), remembered on this computer, and the newest rates any block's
 * answer carried — for the switch's footer (`undefined` until the first answer: not loaded yet, which is not «no rates»).
 */
export const useCurrencyDisplayStore = defineStore('currency-display', () => {
  const choice = ref<CurrencyChoice>(read());
  const rates = ref<RatesView | null | undefined>(undefined);

  function setMain(main: MainCurrency): void {
    choice.value = { ...choice.value, main };
    save(choice.value);
  }

  function setAlso(key: CurrencyKey, value: boolean): void {
    choice.value = { ...choice.value, also: { ...choice.value.also, [key]: value } };
    save(choice.value);
  }

  /** The newest snapshot wins; null (never fetched) only until a real one arrives. */
  function setRates(next: RatesView | null): void {
    const cur = rates.value;
    if (cur === undefined || cur === null || (next !== null && next.fetchedAt >= cur.fetchedAt)) rates.value = next ?? cur ?? null;
  }

  return { choice, rates, setMain, setAlso, setRates };
});
