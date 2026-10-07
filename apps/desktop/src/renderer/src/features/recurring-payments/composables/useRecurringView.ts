import { computed } from 'vue';
import { colorVar, useParticipantStore } from '@/entities/participant';
import { useMonthStore } from '@/entities/period';
import type { UseRecurringReturn, UseRecurringViewReturn } from '../types.ts';
import { rowView, summaryView } from '../utils.ts';

/** The rows and the summary of the answer, in the screen's currency; the person shown only in a family of several. */
export function useRecurringView({ view, fmt }: Pick<UseRecurringReturn, 'view' | 'fmt'>): UseRecurringViewReturn {
  const participant = useParticipantStore();
  const monthStore = useMonthStore();
  const currentYear = computed(() => Number(monthStore.today.slice(0, 4)));

  const personOf = (id: number) => {
    if (!participant.multiple || participant.selectedId !== null) return null;
    const p = participant.people.find((x) => x.id === id);
    return p ? { name: p.label, color: colorVar(p.color) } : null;
  };
  const rows = (active: boolean) => {
    const v = view.value;
    if (!v) return [];
    return (active ? v.active : v.ended).map((p) =>
      rowView(p, { fmt: fmt.value, currentYear: currentYear.value, active, person: personOf(p.participantId) }),
    );
  };

  return {
    summary: computed(() => (view.value ? summaryView(view.value, fmt.value, currentYear.value) : null)),
    active: computed(() => rows(true)),
    ended: computed(() => rows(false)),
  };
}
