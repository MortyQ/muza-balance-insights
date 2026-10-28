import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { ConnectionView, PeopleView, PersonView, ProviderId } from '@contract/api.ts';
import { t } from '@/shared/lib';
import { useParticipantsRequest } from '../api/useParticipantsRequest.ts';
import { BANKS_KEY, FAMILY, SELECTED_KEY } from '../constants.ts';
import { allAccountsOff, offeredBanks, shownBanks } from '../utils.ts';

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

function readBanks(): string[] | null {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(BANKS_KEY) ?? 'null');
    return Array.isArray(v) && v.every((x) => typeof x === 'string') ? v : null;
  } catch {
    return null;
  }
}

function writeBanks(banks: ReadonlyArray<ProviderId>): void {
  try {
    localStorage.setItem(BANKS_KEY, JSON.stringify(banks));
  } catch {
    // Storage unavailable: the filter just starts with every bank next time.
  }
}

/**
 * People, their connections and token statuses (never a token: it does not leave main); the view: the family or one
 * person, and which banks (spec desktop-bank-filter).
 */
export const useParticipantStore = defineStore('participant', () => {
  const { fetchPeople } = useParticipantsRequest();
  const view = ref<PeopleView | null>(null);
  const chosen = ref<number>(readSelected() ?? FAMILY);

  // A person still waiting for the bank's name reads «New person» in the app's language.
  const people = computed<ReadonlyArray<PersonView>>(() =>
    (view.value?.people ?? []).map((p) => (p.labelPending ? { ...p, label: t('entities.participant.pending') } : p)),
  );
  const connections = computed<ReadonlyArray<ConnectionView>>(() => people.value.flatMap((p) => p.connections));
  const hasConnections = computed(() => connections.value.length > 0);
  /** At least one connection can import now. */
  const anyToken = computed(() => connections.value.some((c) => c.token?.present === true));
  /** Token connections without a usable token (a file connection has none to miss). */
  const withoutToken = computed(() => connections.value.filter((c) => c.token !== null && !c.token.present));
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

  function select(id: number): void {
    chosen.value = id;
    writeSelected(id);
  }

  /** The bank filter's choice as remembered; null — never chosen (every bank). */
  const chosenBanks = ref<string[] | null>(readBanks());
  /** The banks the filter offers; it shows only with two or more. */
  const banks = computed<ProviderId[]>(() => offeredBanks(connections.value));
  /** The banks the screens show. */
  const shown = computed<ProviderId[]>(() => shownBanks(chosenBanks.value, banks.value));
  /**
   * For the data reads: the shown banks while some offered bank is off; undefined while every one is on — the same
   * request (and cache key) as without the filter.
   */
  const selectedProviders = computed<ProviderId[] | undefined>(() => (shown.value.length < banks.value.length ? shown.value : undefined));

  function selectBanks(next: ReadonlyArray<ProviderId>): void {
    const kept = banks.value.filter((p) => next.includes(p));
    if (kept.length === 0) return;
    chosenBanks.value = kept;
    writeBanks(kept);
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

  return {
    view,
    chosen,
    people,
    connections,
    hasConnections,
    anyToken,
    withoutToken,
    accountsOff,
    secureStorage,
    multiple,
    selectedId,
    select,
    chosenBanks,
    banks,
    shown,
    selectedProviders,
    selectBanks,
    labelOf,
    refresh,
  };
});
