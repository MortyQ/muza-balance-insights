import { computed, type Ref } from 'vue';
import { monthName, t } from '@/shared/lib';
import type { SpendingPrefs, UseSpendingReturn, UseSpendingViewReturn } from '../types.ts';
import {
  centerChip, centerConv, comparePeriodText, familyShareText, leftOutLines, noCompareText, opsVs, peopleRows, prevInText, ringOf, rowsFor, totalFor,
} from '../utils.ts';

/** What the block shows for the loaded view, the in-block pick (family view only) and the menu choices. */
export function useSpendingView(base: UseSpendingReturn, prefs: Readonly<Ref<SpendingPrefs>>): UseSpendingViewReturn {
  const { month, thisMonth, view, family, member, people, selected, pick, fmt } = base;
  /** The in-block pick counts in the family view only, and only for a person still in the view (one removed meanwhile → the family). */
  const blockPick = computed(() => {
    const id = pick.value;
    if (!family.value || id === null) return null;
    return view.value?.people.some((p) => p.participantId === id) && people.value.some((p) => p.id === id) ? id : null;
  });

  const who = computed(() => {
    if (family.value) return blockPick.value === null ? t('home.spending.whole') : (people.value.find((p) => p.id === blockPick.value)?.name ?? '');
    return member.value ? (selected.value?.name ?? '') : '';
  });
  const subtitle = computed(() => [monthName(Number(month.value.slice(5, 7))), who.value].filter(Boolean).join(' · '));
  const hasData = computed(() => !!view.value && view.value.categories.some((c) => c.net > 0));
  const rows = computed(() => (view.value ? rowsFor(view.value, blockPick.value, people.value, prefs.value, fmt.value) : []));
  const noneBy = computed(() => (hasData.value && rows.value.length === 0 ? t('home.spending.noneBy', { name: who.value }) : ''));
  const total = computed(() => (view.value ? totalFor(view.value, blockPick.value) : null));
  const ring = computed(() => (view.value ? ringOf(rows.value, view.value, blockPick.value) : ''));
  const chip = computed(() => {
    const v = view.value;
    const tl = total.value;
    return v && tl ? centerChip(tl.net, tl.prev?.net ?? null, v.month, v.compare?.partial ?? false) : null;
  });
  const conv = computed(() => (total.value ? centerConv(total.value.net, fmt.value) : []));
  const perDay = computed(() => {
    const v = view.value;
    if (!v || !total.value || v.period.coveredDays === 0) return null;
    return t('home.spending.perDayShort', { amount: fmt.value.money(Math.round(total.value.net / v.period.coveredDays)) });
  });
  const whoRows = computed(() => (view.value && family.value ? peopleRows(view.value, blockPick.value, people.value, fmt.value) : []));
  const leftOut = computed(() => (view.value ? leftOutLines(view.value) : []));
  const noCompare = computed(() => (view.value && !view.value.compare ? noCompareText(view.value.month) : ''));
  const compared = computed(() => {
    const c = view.value?.compare;
    return c ? t('home.spending.compareFull', { period: comparePeriodText(c, Number(thisMonth.value.slice(0, 4))) }) : '';
  });
  const prevIn = computed(() => (view.value ? prevInText(view.value.month) : ''));
  const prevInTitle = computed(() => (view.value?.compare?.partial ? compared.value : ''));
  const opsVsText = computed(() => {
    const v = view.value;
    const tl = total.value;
    return v && tl ? opsVs(tl.purchases, tl.prev?.purchases ?? null, v.month, v.compare?.partial ?? false) : { text: '', tone: 'neutral' as const, sr: '' };
  });
  const memberCard = computed(() => {
    const v = view.value;
    const s = selected.value;
    if (!member.value || !s || !v || !total.value || v.familyTotal === null) return null;
    return {
      name: s.name,
      color: s.color,
      share: familyShareText(total.value.net, v.familyTotal),
      family: t('home.spending.familyTotal', { amount: fmt.value.money(v.familyTotal) }),
    };
  });

  const money = (kopecks: number): string => fmt.value.money(kopecks);

  function onPick(id: number | null): void {
    pick.value = id;
  }

  return {
    who, subtitle, hasData, rows, noneBy, total, ring, chip, conv, perDay, whoRows, leftOut, noCompare, compared, prevIn, prevInTitle, opsVs: opsVsText, memberCard, money, onPick,
  };
}
