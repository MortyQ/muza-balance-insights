import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { ConnectionView, PeopleView, PersonView } from '@contract/api.ts';
import { useParticipantsRequest } from '../api/useParticipantsRequest.ts';
import { FAMILY, SELECTED_KEY } from '../constants.ts';

function readSelected(): number | null {
  try {
    const v = Number(localStorage.getItem(SELECTED_KEY));
    return Number.isInteger(v) && v >= 0 ? v : null;
  } catch {
    return null;
  }
}

function writeSelected(id: number): void {
  try {
    localStorage.setItem(SELECTED_KEY, String(id));
  } catch {
    // Storage unavailable: the switch just starts at «Вся семья» next time.
  }
}

/** People, their connections and token statuses (never a token: it does not leave main); the family / person view. */
export const useParticipantStore = defineStore('participant', () => {
  const { fetchPeople } = useParticipantsRequest();
  const view = ref<PeopleView | null>(null);
  const chosen = ref<number>(readSelected() ?? FAMILY);

  const people = computed<ReadonlyArray<PersonView>>(() => view.value?.people ?? []);
  const connections = computed<ReadonlyArray<ConnectionView>>(() => people.value.flatMap((p) => p.connections));
  const hasConnections = computed(() => connections.value.length > 0);
  /** At least one connection can import now. */
  const anyToken = computed(() => connections.value.some((c) => c.token.present));
  const withoutToken = computed(() => connections.value.filter((c) => !c.token.present));
  const secureStorage = computed(() => view.value?.secureStorage ?? true);
  const multiple = computed(() => people.value.length > 1);
  /** The participant the data screens show; null = the whole family (also when there is only one person). */
  const selectedId = computed<number | null>(() =>
    multiple.value && people.value.some((p) => p.id === chosen.value) ? chosen.value : null,
  );

  function select(id: number): void {
    chosen.value = id;
    writeSelected(id);
  }

  /** «Имя · Monobank» of a connection, for messages about it. */
  function labelOf(connectionId: number): string {
    for (const p of people.value) {
      const c = p.connections.find((x) => x.id === connectionId);
      if (c) return `${p.label} · ${c.bank}`;
    }
    return 'Подключение';
  }

  async function refresh(): Promise<void> {
    view.value = await fetchPeople();
  }

  return { view, chosen, people, connections, hasConnections, anyToken, withoutToken, secureStorage, multiple, selectedId, select, labelOf, refresh };
});
