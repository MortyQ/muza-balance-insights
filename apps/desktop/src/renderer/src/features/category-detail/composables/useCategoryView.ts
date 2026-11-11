import { computed, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue';
import type { Scope } from '@contract/api.ts';
import type { SortKey } from '@/entities/operations';
import { colorVar, useParticipantStore } from '@/entities/participant';
import { t } from '@/shared/lib';
import type { ListOpen, UseCategoryDetailReturn, UseCategoryViewReturn } from '../types.ts';
import { banksView, lineRows, listTotal, merchantKey, merchantsView, monthsView, moreMerchantsText, noneText, peopleView, spentLabel, summaryView, whenView } from '../utils.ts';

/**
 * Everything the screen shows for the loaded answer, plus the list's own filter, search and order. `open` — what the
 * link asked the list to open with (the global search: a search text or a payee); every new list starts from it.
 */
export function useCategoryView(base: UseCategoryDetailReturn, scope: Readonly<Ref<Scope>>, open: MaybeRefOrGetter<ListOpen> = { q: '', merchant: null }): UseCategoryViewReturn {
  const { view, family, who, fmt } = base;
  const participant = useParticipantStore();
  const merchant = ref<string | null>(toValue(open).merchant);
  const query = ref(toValue(open).q);
  const sort = ref<SortKey>('date');
  function restart(): void {
    const o = toValue(open);
    merchant.value = o.merchant;
    query.value = o.q;
  }
  // Another period, person or category is another list: the filter and the search start over (from the link's).
  watch(() => [JSON.stringify(view.value?.range), view.value?.categoryId, participant.selectedId, participant.banksKey], restart);
  watch(() => JSON.stringify(toValue(open)), restart);

  const people = computed(() => participant.people.map((p) => ({ id: p.id, name: p.label, color: colorVar(p.color) })));
  const summary = computed(() => (view.value ? summaryView(view.value, who.value, t(`home.spending.scope.${scope.value}`), fmt.value) : null));
  const label = computed(() => (view.value ? spentLabel(view.value.range) : ''));
  const none = computed(() => (view.value ? noneText(view.value) : ''));
  const months = computed(() => (view.value ? monthsView(view.value, fmt.value) : null));
  const whoSpent = computed(() => (view.value && family.value ? peopleView(view.value, people.value, fmt.value) : []));
  const banks = computed(() => (view.value ? banksView(view.value, fmt.value) : []));
  const merchants = computed(() => (view.value ? merchantsView(view.value, merchant.value, fmt.value) : []));
  const moreMerchants = computed(() => (view.value ? moreMerchantsText(view.value) : ''));
  const list = computed(() =>
    view.value ? lineRows(view.value.lines, { merchant: merchant.value, query: query.value, sort: sort.value }, people.value, fmt.value) : { rows: [], shown: [] },
  );
  const total = computed(() =>
    view.value ? listTotal(view.value, list.value.shown, merchant.value !== null || query.value.trim() !== '', fmt.value) : '',
  );
  // A payee beyond «Where»'s top ones (a link's filter) is named by its own lines.
  const merchantName = computed(
    () => merchants.value.find((m) => m.key === merchant.value)?.name ?? view.value?.lines.find((l) => merchant.value !== null && merchantKey(l.merchant) === merchant.value)?.merchant ?? '',
  );
  // «When» follows the merchant filter like the list does (not the search: that is the list's own).
  const when = computed(() => {
    const v = view.value;
    if (!v) return null;
    const lines = merchant.value === null ? v.lines : v.lines.filter((l) => merchantKey(l.merchant) === merchant.value);
    return whenView(lines, v, merchantName.value, fmt.value);
  });

  function pickMerchant(key: string): void {
    merchant.value = merchant.value === key ? null : key;
  }

  return {
    summary, label, none, months, people: whoSpent, banks, merchants, moreMerchants, when, rows: computed(() => list.value.rows), total, merchant, merchantName, query, sort, pickMerchant,
  };
}
