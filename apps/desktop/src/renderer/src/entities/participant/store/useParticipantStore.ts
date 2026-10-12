import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { ConnectionView, PeopleView, PersonView, ProviderKey } from '@contract/api.ts';
import { t } from '@/shared/lib';
import { useParticipantsRequest } from '../api/useParticipantsRequest.ts';
import { FAMILY, SELECTED_KEY, SELECTED_PROVIDER_KEY } from '../constants.ts';
import { allAccountsOff } from '../utils.ts';

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
    // Storage unavailable: the switch just starts at «Whole family» next time.
  }
}

function readProvider(): string | null {
  try {
    return localStorage.getItem(SELECTED_PROVIDER_KEY);
  } catch {
    return null;
  }
}

function writeProvider(provider: string | null): void {
  try {
    if (provider === null) localStorage.removeItem(SELECTED_PROVIDER_KEY);
    else localStorage.setItem(SELECTED_PROVIDER_KEY, provider);
  } catch {
    // Storage unavailable: the filter just starts at «All banks» next time.
  }
}

/** People, their connections and token statuses (never a token: it does not leave main); the family / person view. */
export const useParticipantStore = defineStore('participant', () => {
  const { fetchPeople } = useParticipantsRequest();
  const view = ref<PeopleView | null>(null);
  const chosen = ref<number>(readSelected() ?? FAMILY);
  const chosenProvider = ref<string | null>(readProvider());

  // A person still waiting for the bank's name reads «New person» in the app's language.
  const people = computed<ReadonlyArray<PersonView>>(() =>
    (view.value?.people ?? []).map((p) => (p.labelPending ? { ...p, label: t('entities.participant.pending') } : p)),
  );
  const connections = computed<ReadonlyArray<ConnectionView>>(() => people.value.flatMap((p) => p.connections));
  const hasConnections = computed(() => connections.value.length > 0);
  /** At least one connection can import now. */
  const anyToken = computed(() => connections.value.some((c) => c.token.present));
  const withoutToken = computed(() => connections.value.filter((c) => !c.token.present));
  /** Every account is turned off in «Accounts»: home says so instead of showing nothing. */
  const accountsOff = computed(() => allAccountsOff(connections.value));
  const secureStorage = computed(() => view.value?.secureStorage ?? true);
  const multiple = computed(() => people.value.length > 1);
  /**
   * The participant the data screens show; null = the whole family. The only person is always shown as themself: a
   * family of one would repeat their card (and hide their accounts).
   */
  const selectedId = computed<number | null>(() => {
    if (!multiple.value) return people.value[0]?.id ?? null;
    return people.value.some((p) => p.id === chosen.value) ? chosen.value : null;
  });

  /** The banks that have a connection, each once, in the order the connections come. */
  const providers = computed<ProviderKey[]>(() => [...new Set(connections.value.map((c) => c.provider))]);
  const multipleBanks = computed(() => providers.value.length > 1);
  /** The bank the data screens show; null = every bank. With one bank there is nothing to narrow. */
  const selectedProvider = computed<ProviderKey | null>(() =>
    multipleBanks.value ? (providers.value.find((p) => p === chosenProvider.value) ?? null) : null,
  );

  function selectProvider(provider: ProviderKey | null): void {
    chosenProvider.value = provider;
    writeProvider(provider);
  }

  function select(id: number): void {
    chosen.value = id;
    writeSelected(id);
  }

  /** «Name · Monobank» of a connection, for messages about it. */
  function labelOf(connectionId: number): string {
    for (const p of people.value) {
      const c = p.connections.find((x) => x.id === connectionId);
      if (c) return `${p.label} · ${c.bank}`;
    }
    return t('entities.participant.connection');
  }

  async function refresh(): Promise<void> {
    view.value = await fetchPeople();
  }

  return { view, chosen, people, connections, hasConnections, anyToken, withoutToken, accountsOff, secureStorage, multiple, selectedId, select, providers, multipleBanks, selectedProvider, selectProvider, labelOf, refresh };
});
