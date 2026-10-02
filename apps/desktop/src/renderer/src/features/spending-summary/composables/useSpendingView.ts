import { computed, type Ref } from 'vue';
import { monthName, t } from '@/shared/lib';
import type { SpendingPrefs, UseSpendingReturn, UseSpendingViewReturn } from '../types.ts';
import {
  centerChip, centerConv, familyShareText, initial, leftOutLines, money, noCompareText, opsVs, peopleRows, prevInText, ringOf, rowsFor, totalFor,
} from '../utils.ts';

/** What the block shows for the loaded view, the in-block pick (family view only) and the menu choices. */
export function useSpendingView(base: UseSpendingReturn, prefs: Readonly<Ref<SpendingPrefs>>): UseSpendingViewReturn {
  const { month, view, family, member, people, selected, pick, open } = base;
  /** The in-block pick counts in the family view only. */
  const blockPick = computed(() => (family.value ? pick.value : null));

  const who = computed(() => {
    if (family.value) return pick.value === null ? t('home.spending.whole') : (people.value.find((p) => p.id === pick.value)?.name ?? '');
    return member.value ? (selected.value?.name ?? '') : '';
  });
  const subtitle = computed(() => [monthName(Number(month.value.slice(5, 7))), who.value].filter(Boolean).join(' · '));
  const hasData = computed(() => !!view.value && view.value.categories.some((c) => c.net > 0));
  const rows = computed(() => (view.value ? rowsFor(view.value, blockPick.value, people.value, prefs.value) : []));
  const noneBy = computed(() => (hasData.value && rows.value.length === 0 ? t('home.spending.noneBy', { name: who.value }) : ''));
  const total = computed(() => (view.value ? totalFor(view.value, blockPick.value) : null));
  const ring = computed(() => (view.value ? ringOf(rows.value, view.value, blockPick.value) : ''));
  const chip = computed(() => {
    const v = view.value;
    const tl = total.value;
    return v && tl ? centerChip(tl.net, tl.prev?.net ?? null, v.month, v.compare?.partial ?? false) : null;
  });
  const conv = computed(() => (view.value && total.value ? centerConv(total.value.net, total.value.prev?.net ?? null, view.value, prefs.value) : []));
  const perDay = computed(() => {
    const v = view.value;
    if (!v || !total.value || v.period.coveredDays === 0) return null;
    return t('home.spending.perDayShort', { amount: money(Math.round(total.value.net / v.period.coveredDays)) });
  });
  const whoRows = computed(() => (view.value && family.value ? peopleRows(view.value, pick.value, people.value) : []));
  const leftOut = computed(() => (view.value ? leftOutLines(view.value) : []));
  const noCompare = computed(() => (view.value && !view.value.compare ? noCompareText(view.value.month) : ''));
  const prevIn = computed(() => (view.value ? prevInText(view.value.month) : ''));
  const opsVsText = computed(() => (view.value && total.value ? opsVs(total.value.purchases, total.value.prev?.purchases ?? null, view.value.month) : ''));
  const memberCard = computed(() => {
    const v = view.value;
    const s = selected.value;
    if (!member.value || !s || !v || !total.value || v.familyTotal === null) return null;
    return {
      initial: initial(s.name),
      color: s.color,
      share: familyShareText(total.value.net, v.familyTotal),
      family: t('home.spending.familyTotal', { amount: money(v.familyTotal) }),
    };
  });

  function onPick(id: number | null): void {
    pick.value = id;
  }
  function onToggle(key: string): void {
    open.value = open.value === key ? null : key;
  }

  return {
    who, subtitle, hasData, rows, noneBy, total, ring, chip, conv, perDay, whoRows, leftOut, noCompare, prevIn, opsVs: opsVsText, memberCard, onPick, onToggle,
  };
}
