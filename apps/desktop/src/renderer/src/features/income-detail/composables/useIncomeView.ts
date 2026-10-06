import { computed, ref, watch } from 'vue';
import type { SortKey } from '@/entities/operations';
import { colorVar, useParticipantStore } from '@/entities/participant';
import type { UseIncomeDetailReturn, UseIncomeViewReturn } from '../types.ts';
import { lineRows, listTotal, monthsView, moreSendersText, noneText, peopleView, senderKey, sendersView, sourcesView, summaryView, whenView } from '../utils.ts';

/** Everything the screen shows for the loaded answer, plus the list's own filter, search and order. */
export function useIncomeView(base: UseIncomeDetailReturn): UseIncomeViewReturn {
  const { view, family, who, fmt } = base;
  const participant = useParticipantStore();
  const sender = ref<string | null>(null);
  const query = ref('');
  const sort = ref<SortKey>('date');
  // Another month or person is another list: the filter and the search start over.
  watch(() => [view.value?.month, participant.selectedId], () => {
    sender.value = null;
    query.value = '';
  });

  const people = computed(() => participant.people.map((p) => ({ id: p.id, name: p.label, color: colorVar(p.color) })));
  const summary = computed(() => (view.value ? summaryView(view.value, who.value, fmt.value) : null));
  const none = computed(() => (view.value ? noneText(view.value) : ''));
  const months = computed(() => (view.value ? monthsView(view.value, fmt.value) : null));
  const whoReceived = computed(() => (view.value && family.value ? peopleView(view.value, people.value, fmt.value) : []));
  const sources = computed(() => (view.value ? sourcesView(view.value, fmt.value) : []));
  const senders = computed(() => (view.value ? sendersView(view.value, sender.value, fmt.value) : []));
  const moreSenders = computed(() => (view.value ? moreSendersText(view.value) : ''));
  const list = computed(() =>
    view.value ? lineRows(view.value.lines, { sender: sender.value, query: query.value, sort: sort.value }, people.value, fmt.value) : { rows: [], shown: [] },
  );
  const total = computed(() =>
    view.value ? listTotal(view.value, list.value.shown, sender.value !== null || query.value.trim() !== '', fmt.value) : '',
  );
  const senderName = computed(() => senders.value.find((s) => s.key === sender.value)?.name ?? '');
  // «When» follows the sender filter like the list does (not the search: that is the list's own).
  const when = computed(() => {
    const v = view.value;
    if (!v) return null;
    const lines = sender.value === null ? v.lines : v.lines.filter((l) => senderKey(l.sender) === sender.value);
    return whenView(lines, v, senderName.value, fmt.value);
  });

  function pickSender(key: string): void {
    sender.value = sender.value === key ? null : key;
  }

  return {
    summary, none, months, people: whoReceived, sources, senders, moreSenders, when, rows: computed(() => list.value.rows), total, sender, senderName, query, sort, pickSender,
  };
}
