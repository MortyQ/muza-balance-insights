import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { SearchOverview } from '@contract/api.ts';
import { SEARCH_TRANSACTIONS_MAX } from '@contract/search.ts';
import { moneyFormat, useCurrencyDisplayStore, useMoneyFormat } from '@/entities/currency-display';
import { useParticipantStore } from '@/entities/participant';
import { useMonthStore } from '@/entities/period';
import { parseSearch, t } from '@/shared/lib';
import { useSearchRequest } from '../api/useSearchRequest.ts';
import { SEARCH_DEBOUNCE_MS } from '../constants.ts';
import type { SearchItemView, UseGlobalSearchReturn } from '../types.ts';
import { categoryHits, searchGroups, searchQueryOf, understoodText } from '../utils.ts';

type State = { status: 'idle' } | { status: 'loading' } | { status: 'error' } | { status: 'done'; data: SearchOverview | null };

/**
 * The global search (spec desktop-global-search): Cmd+K / Ctrl+K opens it; the input is taken apart in the renderer
 * (dates, the amount in the main currency), main finds transactions, payees and regular payments of the global
 * filters' person and banks, the categories are found here by name. The answer is kept only while the sheet shows it.
 */
export function useGlobalSearch(): UseGlobalSearchReturn {
  const { fetchSearch } = useSearchRequest();
  const router = useRouter();
  const participant = useParticipantStore();
  const months = useMonthStore();
  const currency = useCurrencyDisplayStore();

  const open = ref(false);
  const input = ref('');
  const active = ref(-1);
  const state = shallowRef<State>({ status: 'idle' });
  const fmt = useMoneyFormat(() => (state.value.status === 'done' ? state.value.data?.rates : undefined));
  const parsed = computed(() => parseSearch(input.value, months.today));
  const thisYear = computed(() => Number(months.today.slice(0, 4)));

  let timer: ReturnType<typeof setTimeout> | null = null;
  let asked = 0;
  async function run(): Promise<void> {
    const main = moneyFormat(currency.rates ?? null, currency.choice).currency;
    const q = searchQueryOf(parsed.value, currency.rates ?? null, main, { participantId: participant.selectedId, ...participant.banksQuery() });
    const mine = ++asked;
    if (q === null) {
      state.value = { status: 'done', data: null };
      return;
    }
    try {
      const data = await fetchSearch(q);
      if (mine === asked) state.value = { status: 'done', data };
    } catch {
      if (mine === asked) state.value = { status: 'error' };
    }
  }
  watch([input, () => participant.selectedId, () => participant.banksKey], () => {
    if (timer) clearTimeout(timer);
    active.value = -1;
    if (input.value.trim() === '') {
      asked += 1;
      state.value = { status: 'idle' };
      return;
    }
    state.value = { status: 'loading' };
    timer = setTimeout(() => void run(), SEARCH_DEBOUNCE_MS);
  });
  // A closed sheet keeps no bank text.
  watch(open, (o) => {
    if (o) return;
    if (timer) clearTimeout(timer);
    asked += 1;
    input.value = '';
    state.value = { status: 'idle' };
  });

  const groups = computed(() => {
    const s = state.value;
    if (s.status !== 'done') return [];
    return searchGroups(s.data, categoryHits(parsed.value.text), fmt.value, thisYear.value);
  });
  const items = computed(() => groups.value.flatMap((g) => g.items));
  const status = computed(() => {
    const s = state.value.status;
    return s === 'done' && input.value.trim() === '' ? 'idle' : s;
  });
  const understood = computed(() => understoodText(parsed.value, fmt.value, thisYear.value));
  const more = computed(() => {
    const s = state.value;
    const total = s.status === 'done' ? (s.data?.total ?? 0) : 0;
    return total > SEARCH_TRANSACTIONS_MAX ? t('search.more', { shown: SEARCH_TRANSACTIONS_MAX, total }) : '';
  });

  function pick(item: SearchItemView): void {
    open.value = false;
    void router.push(item.to).then(() => {
      if (item.month !== null) months.set(item.month, null);
    });
  }

  function onKey(e: KeyboardEvent): void {
    const n = items.value.length;
    if (e.key === 'ArrowDown' && n > 0) {
      e.preventDefault();
      active.value = (active.value + 1) % n;
    } else if (e.key === 'ArrowUp' && n > 0) {
      e.preventDefault();
      active.value = active.value <= 0 ? n - 1 : active.value - 1;
    } else if (e.key === 'Enter') {
      const item = items.value[active.value < 0 ? 0 : active.value];
      if (item) {
        e.preventDefault();
        pick(item);
      }
    }
  }

  function onShortcut(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      open.value = true;
    }
  }
  onMounted(() => window.addEventListener('keydown', onShortcut));
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onShortcut);
    if (timer) clearTimeout(timer);
  });

  return { open, input, status, groups, items, active, understood, more, onKey, pick };
}
