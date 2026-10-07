import { computed } from 'vue';
import { t } from '@/shared/lib';
import type { UsePickReturn, UseSpendingReturn } from '../types.ts';
import { peopleRows } from '../utils/index.ts';

/** The block's own person pick (family view only) and the people list it is made in. */
export function usePick(base: UseSpendingReturn): UsePickReturn {
  const { view, family, member, people, selected, pick, fmt } = base;
  const blockPick = computed(() => {
    const id = pick.value;
    if (!family.value || id === null) return null;
    return view.value?.people.some((p) => p.participantId === id) && people.value.some((p) => p.id === id) ? id : null;
  });

  const who = computed(() => {
    if (family.value) return blockPick.value === null ? t('home.spending.whole') : (people.value.find((p) => p.id === blockPick.value)?.name ?? '');
    return member.value ? (selected.value?.name ?? '') : '';
  });
  const list = computed(() => (view.value && family.value ? peopleRows(view.value, blockPick.value, people.value, fmt.value) : []));

  function onPick(id: number | null): void {
    pick.value = id;
  }

  return { blockPick, who, people: list, onPick };
}
